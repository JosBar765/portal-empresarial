// src/modules/vales/repositories/historialRepository.js
const db = require('../../../config/database');

class HistorialRepository {
  async registrar(valeId, usuarioId, estadoAnterior, estadoNuevo, accion) {
    await db.query(
      'INSERT INTO vale_historial (vale_id, usuario_id, estado_anterior, estado_nuevo, accion) VALUES (?, ?, ?, ?, ?)',
      [valeId, usuarioId, estadoAnterior, estadoNuevo, accion],
      'historial:insert'
    );
  }

  async listarPorVale(valeId) {
    return db.query('SELECT * FROM vale_historial WHERE vale_id = ? ORDER BY id ASC', [valeId], 'historial:list_by_vale');
  }
}

module.exports = new HistorialRepository();
