// src/modules/vales/repositories/valeTallerRepository.js
// Progreso de un vale de arte DENTRO de cada taller al que fue enviado: una
// fila por (vale, taller), con su propio estado
// (PENDIENTE_ASIGNACION/ASIGNADO/EN_PROCESO/EN_REVISION/APROBADO)
// independiente del estado general del vale.
const db = require('../../../config/database');

// `estado` vive en el catálogo `estados_taller` (ver
// analisis_correcciones_24.md #5) — se alias de vuelta a `estado` para que
// el resto del código no note el cambio.
const SELECT_VALE_TALLER = `
  SELECT vt.*, et.nombre AS estado
  FROM vale_talleres vt
  LEFT JOIN estados_taller et ON et.id = vt.estado_id
`;

class ValeTallerRepository {
  async crear(valeId, tallerId) {
    const result = await db.query(
      "INSERT INTO vale_talleres (vale_id, taller_id, estado_id, activo) VALUES (?, ?, (SELECT id FROM estados_taller WHERE nombre = 'VERIFICANDO_ADJUNTOS'), 1)",
      [valeId, tallerId],
      'vale_taller:insert'
    );
    return result.insertId;
  }

  async obtenerPorId(id) {
    const rows = await db.query(`${SELECT_VALE_TALLER} WHERE vt.id = ?`, [id], 'vale_taller:find_by_id');
    return rows[0] || null;
  }

  async listarTodos() {
    return db.query(`${SELECT_VALE_TALLER} WHERE vt.activo = 1`, [], 'vale_taller:list_all');
  }

  async listarPorVale(valeId) {
    return db.query(`${SELECT_VALE_TALLER} WHERE vt.vale_id = ? AND vt.activo = 1 ORDER BY vt.id ASC`, [valeId], 'vale_taller:list_by_vale');
  }

  async listarActivasPorDisenador(disenadorId) {
    return db.query(`${SELECT_VALE_TALLER} WHERE vt.disenador_id = ? AND vt.activo = 1`, [disenadorId], 'vale_taller:list_activas_by_disenador');
  }

  async listarActivasPorTaller(tallerId) {
    return db.query(`${SELECT_VALE_TALLER} WHERE vt.taller_id = ? AND vt.activo = 1`, [tallerId], 'vale_taller:list_activas_by_taller');
  }

  async asignar(id, disenadorId, fechaAsignacion) {
    await db.query(
      "UPDATE vale_talleres SET disenador_id = ?, estado_id = (SELECT id FROM estados_taller WHERE nombre = 'ASIGNADO'), fecha_asignacion = ? WHERE id = ?",
      [disenadorId, fechaAsignacion, id],
      'vale_taller:asignar'
    );
  }

  async actualizarEstado(id, estado) {
    await db.query(
      'UPDATE vale_talleres SET estado_id = (SELECT id FROM estados_taller WHERE nombre = ?) WHERE id = ?',
      [estado, id],
      'vale_taller:update_estado'
    );
  }

  // Rechazo de adjuntos: el plazo de 24 h se fija solo la primera vez (COALESCE) y el aviso se limpia solo entonces.
  async rechazarAdjuntos(id, venceEn) {
    await db.query(
      `UPDATE vale_talleres SET estado_id = (SELECT id FROM estados_taller WHERE nombre = 'ADJUNTOS_RECHAZADOS'),
         adjuntos_aviso_en = IF(adjuntos_vence_en IS NULL, NULL, adjuntos_aviso_en),
         adjuntos_vence_en = COALESCE(adjuntos_vence_en, ?),
         adjuntos_mensaje = NULL, adjuntos_respondido_en = NULL
       WHERE id = ?`,
      [venceEn, id],
      'vale_taller:rechazar_adjuntos'
    );
  }

  // Filas esperando al asesor cuyo plazo ya venció (de un vale, o de todos).
  async listarAdjuntosVencidos(valeId = null) {
    return db.query(
      `${SELECT_VALE_TALLER}
       WHERE vt.activo = 1 AND et.nombre = 'ADJUNTOS_RECHAZADOS' AND vt.adjuntos_vence_en <= NOW()
         ${valeId ? 'AND vt.vale_id = ?' : ''}`,
      valeId ? [valeId] : [], 'vale_taller:list_adjuntos_vencidos'
    );
  }

  // Filas esperando al asesor a las que les quedan `horas` o menos y aún sin aviso.
  async listarAdjuntosPorVencer(horas) {
    return db.query(
      `SELECT vt.id, vt.vale_id, vt.taller_id, TIMESTAMPDIFF(MINUTE, NOW(), vt.adjuntos_vence_en) AS minutos_restantes
       FROM vale_talleres vt
       JOIN estados_taller et ON et.id = vt.estado_id
       WHERE vt.activo = 1 AND et.nombre = 'ADJUNTOS_RECHAZADOS' AND vt.adjuntos_aviso_en IS NULL
         AND vt.adjuntos_vence_en > NOW() AND vt.adjuntos_vence_en <= DATE_ADD(NOW(), INTERVAL ? HOUR)`,
      [horas], 'vale_taller:list_adjuntos_por_vencer'
    );
  }

  // true si esta llamada fue la que marcó el aviso (evita avisar dos veces).
  async marcarAvisoAdjuntos(id) {
    const result = await db.query(
      'UPDATE vale_talleres SET adjuntos_aviso_en = NOW() WHERE id = ? AND adjuntos_aviso_en IS NULL',
      [id], 'vale_taller:marcar_aviso_adjuntos'
    );
    return result.affectedRows > 0;
  }

  async responderAdjuntos(id, mensaje) {
    await db.query(
      `UPDATE vale_talleres SET estado_id = (SELECT id FROM estados_taller WHERE nombre = 'ADJUNTOS_RESPONDIDOS'),
         adjuntos_mensaje = ?, adjuntos_respondido_en = NOW()
       WHERE id = ?`,
      [mensaje, id],
      'vale_taller:responder_adjuntos'
    );
  }
}

module.exports = new ValeTallerRepository();
