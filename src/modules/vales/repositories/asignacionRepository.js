// src/modules/vales/repositories/asignacionRepository.js
const db = require('../../../config/database');

class AsignacionRepository {
  async desactivarPorVale(valeId) {
    await db.query('UPDATE vale_asignaciones SET activo = 0 WHERE vale_id = ?', [valeId], 'asignacion:deactivate_by_vale');
  }

  async crear(valeId, tecnicoId, encargadoId, fechaAsignacion) {
    const result = await db.query(
      'INSERT INTO vale_asignaciones (vale_id, tecnico_id, encargado_id, fecha_asignacion, activo) VALUES (?, ?, ?, ?, 1)',
      [valeId, tecnicoId, encargadoId, fechaAsignacion],
      'asignacion:insert'
    );
    return result.insertId;
  }

  async listarPorVale(valeId) {
    return db.query('SELECT * FROM vale_asignaciones WHERE vale_id = ? ORDER BY id ASC', [valeId], 'asignacion:list_by_vale');
  }

  async obtenerActivaPorVale(valeId) {
    const rows = await this.listarPorVale(valeId);
    return rows.filter(a => a.activo).sort((a, b) => b.id - a.id)[0] || null;
  }

  async listarActivasPorTecnico(tecnicoId) {
    return db.query('SELECT * FROM vale_asignaciones WHERE tecnico_id = ? AND activo = 1', [tecnicoId], 'asignacion:list_activas_by_tecnico');
  }

  async listarActivasPorEncargado(encargadoId) {
    return db.query('SELECT * FROM vale_asignaciones WHERE encargado_id = ? AND activo = 1', [encargadoId], 'asignacion:list_activas_by_encargado');
  }
}

module.exports = new AsignacionRepository();
