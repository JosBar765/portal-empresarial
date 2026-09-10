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
      "INSERT INTO vale_talleres (vale_id, taller_id, estado_id, activo) VALUES (?, ?, (SELECT id FROM estados_taller WHERE nombre = 'PENDIENTE_ASIGNACION'), 1)",
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

  async listarActivasPorTecnico(tecnicoId) {
    return db.query(`${SELECT_VALE_TALLER} WHERE vt.tecnico_id = ? AND vt.activo = 1`, [tecnicoId], 'vale_taller:list_activas_by_tecnico');
  }

  async listarActivasPorTaller(tallerId) {
    return db.query(`${SELECT_VALE_TALLER} WHERE vt.taller_id = ? AND vt.activo = 1`, [tallerId], 'vale_taller:list_activas_by_taller');
  }

  async asignar(id, tecnicoId, fechaAsignacion) {
    await db.query(
      "UPDATE vale_talleres SET tecnico_id = ?, estado_id = (SELECT id FROM estados_taller WHERE nombre = 'ASIGNADO'), fecha_asignacion = ? WHERE id = ?",
      [tecnicoId, fechaAsignacion, id],
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
}

module.exports = new ValeTallerRepository();
