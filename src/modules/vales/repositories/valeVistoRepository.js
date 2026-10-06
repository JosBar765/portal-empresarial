// src/modules/vales/repositories/valeVistoRepository.js
// Qué supervisor ya abrió "Ver" en un vale pendiente de autorización.
const db = require('../../../config/database');

class ValeVistoRepository {
  async registrar(valeId, usuarioId) {
    await db.query(
      'INSERT INTO vale_vistos (vale_id, usuario_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE visto_en = NOW()',
      [valeId, usuarioId],
      'vale_visto:upsert'
    );
  }

  async existe(valeId, usuarioId) {
    const rows = await db.query(
      'SELECT 1 FROM vale_vistos WHERE vale_id = ? AND usuario_id = ?',
      [valeId, usuarioId],
      'vale_visto:exists'
    );
    return rows.length > 0;
  }

  async listarIdsPorUsuario(usuarioId) {
    const rows = await db.query('SELECT vale_id FROM vale_vistos WHERE usuario_id = ?', [usuarioId], 'vale_visto:list_by_usuario');
    return rows.map(r => r.vale_id);
  }
}

module.exports = new ValeVistoRepository();
