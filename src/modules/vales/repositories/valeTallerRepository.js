// src/modules/vales/repositories/valeTallerRepository.js
// Progreso de un vale de arte DENTRO de cada taller al que fue enviado: una
// fila por (vale, taller), con su propio estado
// (PENDIENTE_ASIGNACION/ASIGNADO/EN_PROCESO/EN_REVISION/APROBADO)
// independiente del estado general del vale.
const db = require('../../../config/database');

class ValeTallerRepository {
  async crear(valeId, tallerId) {
    const result = await db.query(
      'INSERT INTO vale_talleres (vale_id, taller_id, estado, activo) VALUES (?, ?, \'PENDIENTE_ASIGNACION\', 1)',
      [valeId, tallerId],
      'vale_taller:insert'
    );
    return result.insertId;
  }

  async obtenerPorId(id) {
    const rows = await db.query('SELECT * FROM vale_talleres WHERE id = ?', [id], 'vale_taller:find_by_id');
    return rows[0] || null;
  }

  async listarTodos() {
    return db.query('SELECT * FROM vale_talleres WHERE activo = 1', [], 'vale_taller:list_all');
  }

  async listarPorVale(valeId) {
    return db.query('SELECT * FROM vale_talleres WHERE vale_id = ? AND activo = 1 ORDER BY id ASC', [valeId], 'vale_taller:list_by_vale');
  }

  async listarActivasPorTecnico(tecnicoId) {
    return db.query('SELECT * FROM vale_talleres WHERE tecnico_id = ? AND activo = 1', [tecnicoId], 'vale_taller:list_activas_by_tecnico');
  }

  async listarActivasPorTaller(tallerId) {
    return db.query('SELECT * FROM vale_talleres WHERE taller_id = ? AND activo = 1', [tallerId], 'vale_taller:list_activas_by_taller');
  }

  async asignar(id, tecnicoId, fechaAsignacion) {
    await db.query(
      "UPDATE vale_talleres SET tecnico_id = ?, estado = 'ASIGNADO', fecha_asignacion = ? WHERE id = ?",
      [tecnicoId, fechaAsignacion, id],
      'vale_taller:asignar'
    );
  }

  async actualizarEstado(id, estado) {
    await db.query('UPDATE vale_talleres SET estado = ? WHERE id = ?', [estado, id], 'vale_taller:update_estado');
  }
}

module.exports = new ValeTallerRepository();
