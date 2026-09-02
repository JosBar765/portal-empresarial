// src/modules/vales/repositories/historialRepository.js
const db = require('../../../config/database');

class HistorialRepository {
  // `tallerId` es NULL para eventos de nivel de vale (visibles para todos) y el taller
  // correspondiente para eventos internos de un taller (analisis_correcciones_4.md #12).
  // `tecnicoId` (analisis_correcciones_15.md #7) solo se llena en eventos donde el
  // actor NO es el propio técnico (asignación/reasignación/aprobación) — permite que
  // un técnico filtre su historial sin depender del texto de `accion`.
  async registrar(valeId, usuarioId, tallerId, estadoAnterior, estadoNuevo, accion, tecnicoId) {
    await db.query(
      'INSERT INTO vale_historial (vale_id, usuario_id, taller_id, estado_anterior, estado_nuevo, accion, tecnico_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [valeId, usuarioId, tallerId || null, estadoAnterior, estadoNuevo, accion, tecnicoId || null],
      'historial:insert'
    );
  }

  async listarPorVale(valeId) {
    return db.query('SELECT * FROM vale_historial WHERE vale_id = ? ORDER BY id ASC', [valeId], 'historial:list_by_vale');
  }
}

module.exports = new HistorialRepository();
