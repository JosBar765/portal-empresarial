// src/modules/vales/repositories/propuestaRepository.js
const db = require('../../../config/database');

class PropuestaRepository {
  async crear(valeId, disenadorId, url) {
    const result = await db.query(
      'INSERT INTO vale_propuestas (vale_id, disenador_id, url) VALUES (?, ?, ?)',
      [valeId, disenadorId, url || null],
      'propuesta:insert'
    );
    return result.insertId;
  }

  async listarPorVale(valeId) {
    return db.query('SELECT * FROM vale_propuestas WHERE vale_id = ? ORDER BY id ASC', [valeId], 'propuesta:list_by_vale');
  }

  async obtenerUltimaPorVale(valeId) {
    const rows = await db.query('SELECT * FROM vale_propuestas WHERE vale_id = ? ORDER BY id DESC LIMIT 1', [valeId], 'propuesta:latest_by_vale');
    return rows[0] || null;
  }

  // La última propuesta de UN taller específico (identificado por el diseñador que la
  // subió) — necesario porque con varios talleres puede haber varias propuestas vivas
  // para el mismo vale al mismo tiempo, una por taller.
  async obtenerUltimaPorValeYDisenador(valeId, disenadorId) {
    const rows = await db.query(
      'SELECT * FROM vale_propuestas WHERE vale_id = ? AND disenador_id = ? ORDER BY id DESC LIMIT 1',
      [valeId, disenadorId],
      'propuesta:latest_by_vale_disenador'
    );
    return rows[0] || null;
  }
}

module.exports = new PropuestaRepository();
