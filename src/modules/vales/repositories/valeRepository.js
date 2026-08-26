// src/modules/vales/repositories/valeRepository.js
const db = require('../../../config/database');

class ValeRepository {
  // Nota (analisis_correcciones_10.md #11): el límite diario dejó de ser
  // individual del asesor (`asesor_limites`) — ahora es colectivo del
  // Supervisor, ver contarAutorizacionesCreacionPorSupervisorYFecha más abajo.

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
        correlativo, asesor_id, localidad_id, vale_original_id, fecha_creacion, hora_creacion, fecha_entrega, fecha_evento, urgente,
        cliente_empresa, cliente_nombre, cliente_telefono, cliente_correo,
        producto_id, material_id, tecnica, acabado, cantidad, cotizacion, descripcion, estado,
        talleres_solicitados, autorizado_por, autorizado_en, autorizacion_tipo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.correlativo, data.asesorId, data.localidadId, data.valeOriginalId || null, data.fechaCreacion, data.horaCreacion,
        data.fechaEntrega, data.fechaEvento, data.urgente ? 1 : 0,
        data.clienteEmpresa || null, data.clienteNombre, data.clienteTelefono, data.clienteCorreo,
        data.productoId || null, data.materialId || null, data.tecnica, data.acabado,
        data.cantidad, data.cotizacion, data.descripcion || null, data.estado || 'CREADO',
        // analisis_correcciones_10.md #5/#6: talleres solicitados por el asesor (en
        // espera de autorización) y, cuando el vale ya nace autorizado (el MOD- que
        // crea aprobarModificacion), quién y cuándo lo autorizó.
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
  // cuando el original ya fue modificado (analisis_correcciones_5.md #4).
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

  async actualizarTieneAdjuntos(id, valor) {
    await db.query('UPDATE vales SET tiene_adjuntos = ? WHERE id = ?', [valor ? 1 : 0, id], 'vale:update_tiene_adjuntos');
  }

  async marcarModificado(id) {
    await db.query('UPDATE vales SET modificado = 1 WHERE id = ?', [id], 'vale:marcar_modificado');
  }

  // Congela el atraso de forma permanente (analisis_correcciones_8.md #7) —
  // se llama exactamente en los dos puntos donde un vale queda "entregado":
  // confirmarRecibido() y aprobarModificacion() (al devolver el original a
  // RECIBIDO). El `IS NULL` evita pisar el primer congelamiento si por
  // cualquier motivo se volviera a llamar sobre el mismo vale.
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

  // analisis_correcciones_10.md #5/#6: sella quién y cuándo autorizó (creación o
  // modificación) — usado por la firma roja del PDF y por el cupo colectivo del
  // Supervisor (#11) y su "Trabajo Realizado" (#7).
  async sellarAutorizacion(id, { autorizadoPor, autorizadoEn, autorizacionTipo }) {
    await db.query(
      'UPDATE vales SET autorizado_por = ?, autorizado_en = ?, autorizacion_tipo = ? WHERE id = ?',
      [autorizadoPor, autorizadoEn, autorizacionTipo, id],
      'vale:sellar_autorizacion'
    );
  }

  // analisis_correcciones_10.md #7: sella cuándo el asesor confirmó de recibido
  // — el Supervisor ordena por esta fecha en su "Trabajo Realizado".
  async sellarConfirmacion(id, fechaHora) {
    await db.query('UPDATE vales SET confirmado_en = ? WHERE id = ?', [fechaHora, id], 'vale:sellar_confirmacion');
  }

  // analisis_correcciones_10.md #11: cuenta cuántas autorizaciones de CREACIÓN
  // hizo este Supervisor hoy — el denominador (cantidad de asesores a su cargo)
  // se resuelve aparte, vía usuarioValeRepository.listarAsesoresPorSupervisor.
  async contarAutorizacionesCreacionPorSupervisorYFecha(supervisorId, fecha) {
    const rows = await db.query(
      "SELECT COUNT(*) AS total FROM vales WHERE autorizado_por = ? AND autorizacion_tipo = 'CREACION' AND DATE(autorizado_en) = ?",
      [supervisorId, fecha],
      'vale:count_autorizaciones_creacion_por_supervisor'
    );
    return rows[0] ? Number(rows[0].total) : 0;
  }

  // analisis_correcciones_10.md #10: vales que acaban de cruzar su fecha_entrega
  // y todavía no fueron notificados — usado por atrasoWatcher. Excluye vales con
  // el atraso ya congelado (RECIBIDO/etc. — ver calcularAtraso en valeService):
  // su atraso ya no corre en vivo, así que "acaban de atrasarse" no aplica.
  async listarAtrasadosSinNotificar() {
    return db.query(
      "SELECT * FROM vales WHERE atraso_notificado_en IS NULL AND atraso_congelado_en IS NULL AND estado <> 'RECIBIDO' AND fecha_entrega < NOW()",
      [],
      'vale:list_atrasados_sin_notificar'
    );
  }

  async marcarAtrasoNotificado(id, fechaHora) {
    await db.query('UPDATE vales SET atraso_notificado_en = ? WHERE id = ?', [fechaHora, id], 'vale:marcar_atraso_notificado');
  }
}

module.exports = new ValeRepository();
