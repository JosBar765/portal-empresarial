// src/modules/vales/repositories/valeRepository.js
const db = require('../../../config/database');

class ValeRepository {
  async contarValesPorAsesor(asesorId) {
    const rows = await db.query(
      'SELECT COUNT(*) AS total FROM vales WHERE asesor_id = ?',
      [asesorId],
      'vale:count_por_asesor'
    );
    return rows[0] ? Number(rows[0].total) : 0;
  }

  async crear(data) {
    const result = await db.query(
      `INSERT INTO vales (
        correlativo, asesor_id, tienda_id, vale_original_id, fecha_creacion, hora_creacion, fecha_entrega, fecha_evento, urgente,
        cliente_empresa, cliente_nombre, cliente_telefono, cliente_correo,
        producto, material, tecnica, acabado, cantidad, cotizacion, descripcion, estado,
        talleres_solicitados, autorizado_por, autorizado_en, autorizacion_tipo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.correlativo, data.asesorId, data.tiendaId, data.valeOriginalId || null, data.fechaCreacion, data.horaCreacion,
        data.fechaEntrega, data.fechaEvento, data.urgente ? 1 : 0,
        data.clienteEmpresa || null, data.clienteNombre, data.clienteTelefono, data.clienteCorreo,
        data.producto, data.material, data.tecnica, data.acabado,
        data.cantidad, data.cotizacion, data.descripcion || null, data.estado || 'CREADO',
        // `talleresSolicitados` es el CSV que eligió el asesor mientras el vale
        // espera autorización; `autorizadoPor`/`autorizadoEn`/`autorizacionTipo`
        // solo vienen poblados cuando el vale nace ya autorizado (el MOD- que
        // crea aprobarModificacion).
        data.talleresSolicitados || null, data.autorizadoPor || null, data.autorizadoEn || null, data.autorizacionTipo || null
      ],
      'vale:insert'
    );
    return result.insertId;
  }

  async obtenerPorId(id) {
    const rows = await db.query('SELECT * FROM vales WHERE id = ?', [id], 'vale:find_by_id');
    return rows[0] || null;
  }

  async listarTodos() {
    return db.query('SELECT * FROM vales', [], 'vale:list_all');
  }

  // El vale MOD- que reemplaza a este (a lo sumo uno, solo se permite una
  // modificación por vale) — usado para resolver "Ver PDF" al vale vigente
  // cuando el original ya fue modificado.
  async obtenerPorValeOriginalId(valeOriginalId) {
    const rows = await db.query(
      'SELECT * FROM vales WHERE vale_original_id = ? LIMIT 1',
      [valeOriginalId],
      'vale:find_by_original_id'
    );
    return rows[0] || null;
  }

  async actualizarEstado(id, estado) {
    await db.query('UPDATE vales SET estado = ? WHERE id = ?', [estado, id], 'vale:update_estado');
  }

  async actualizarPdfUrl(id, pdfUrl) {
    await db.query('UPDATE vales SET pdf_url = ? WHERE id = ?', [pdfUrl, id], 'vale:update_pdf_url');
  }

  async marcarModificado(id) {
    await db.query('UPDATE vales SET modificado = 1 WHERE id = ?', [id], 'vale:marcar_modificado');
  }

  // Congela el atraso de forma permanente — se llama exactamente en los dos
  // puntos donde un vale queda "entregado": confirmarRecibido() y
  // aprobarModificacion() (al devolver el original a RECIBIDO). El `IS NULL`
  // evita pisar el primer congelamiento si por cualquier motivo se volviera a
  // llamar sobre el mismo vale.
  async congelarAtraso(id, fechaHora) {
    await db.query(
      'UPDATE vales SET atraso_congelado_en = ? WHERE id = ? AND atraso_congelado_en IS NULL',
      [fechaHora, id],
      'vale:congelar_atraso'
    );
  }

  async actualizarPropuestaGeneral(id, url) {
    await db.query('UPDATE vales SET propuesta_general_url = ? WHERE id = ?', [url, id], 'vale:update_propuesta_general');
  }

  // Deja rastro de quién fusionó y cuándo — sin esto sería imposible acotar
  // "Trabajo Realizado" a quien realmente fusionó, ni fecharlo sin pisarse con
  // transiciones posteriores del vale (RECIBIDO, CONFIRMADO...).
  async sellarFusion(id, { fusionadoPor, fusionadoEn }) {
    await db.query(
      'UPDATE vales SET fusionado_por = ?, fusionado_en = ? WHERE id = ?',
      [fusionadoPor, fusionadoEn, id],
      'vale:sellar_fusion'
    );
  }

  // Sella quién y cuándo autorizó (creación o modificación) — usado por la
  // firma roja del PDF y por el cupo colectivo del Supervisor y su
  // "Trabajo Realizado".
  async sellarAutorizacion(id, { autorizadoPor, autorizadoEn, autorizacionTipo }) {
    await db.query(
      'UPDATE vales SET autorizado_por = ?, autorizado_en = ?, autorizacion_tipo = ? WHERE id = ?',
      [autorizadoPor, autorizadoEn, autorizacionTipo, id],
      'vale:sellar_autorizacion'
    );
  }

  // Sella cuándo el asesor confirmó de recibido — el Supervisor ordena por
  // esta fecha en su "Trabajo Realizado".
  async sellarConfirmacion(id, fechaHora) {
    await db.query('UPDATE vales SET confirmado_en = ? WHERE id = ?', [fechaHora, id], 'vale:sellar_confirmacion');
  }

  // Cuenta cuántas autorizaciones de CREACIÓN hizo este Supervisor hoy — el
  // denominador (cantidad de asesores a su cargo) se resuelve aparte, vía
  // usuarioValeRepository.listarAsesoresPorSupervisor.
  async contarAutorizacionesCreacionPorSupervisorYFecha(supervisorId, fecha) {
    const rows = await db.query(
      "SELECT COUNT(*) AS total FROM vales WHERE autorizado_por = ? AND autorizacion_tipo = 'CREACION' AND DATE(autorizado_en) = ?",
      [supervisorId, fecha],
      'vale:count_autorizaciones_creacion_por_supervisor'
    );
    return rows[0] ? Number(rows[0].total) : 0;
  }

  // Vales que acaban de cruzar su fecha_entrega y todavía no fueron
  // notificados — usado por atrasoWatcher. Excluye vales con el atraso ya
  // congelado (RECIBIDO/etc. — ver calcularAtraso en valeService): su atraso
  // ya no corre en vivo, así que "acaban de atrasarse" no aplica. El margen de
  // 1 día es intencional: "atraso" real empieza a las 24h de cruzar
  // fecha_entrega, no en el instante mismo (eso es "vence hoy", diasAtraso
  // === 0 en valeService.calcularAtraso) — la alerta roja solo debe sonar una
  // vez que el vale cumple >= 1 día de atraso.
  async listarAtrasadosSinNotificar() {
    return db.query(
      "SELECT * FROM vales WHERE atraso_notificado_en IS NULL AND atraso_congelado_en IS NULL AND estado NOT IN ('RECIBIDO', 'CONFIRMADO') AND fecha_entrega < NOW() - INTERVAL 1 DAY",
      [],
      'vale:list_atrasados_sin_notificar'
    );
  }

  async marcarAtrasoNotificado(id, fechaHora) {
    await db.query('UPDATE vales SET atraso_notificado_en = ? WHERE id = ?', [fechaHora, id], 'vale:marcar_atraso_notificado');
  }
}

module.exports = new ValeRepository();
