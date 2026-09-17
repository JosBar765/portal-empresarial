// src/modules/vales/repositories/tallerRepository.js
const db = require('../../../config/database');

class TallerRepository {
  async listarActivos() {
    return db.query('SELECT id, nombre, encargado_id, tienda_id, limite_diario FROM talleres WHERE activo = 1 ORDER BY nombre', [], 'taller:list');
  }

  async obtenerPorId(id) {
    const rows = await db.query('SELECT id, nombre, encargado_id, tienda_id, activo, limite_diario FROM talleres WHERE id = ?', [id], 'taller:find_by_id');
    return rows[0] || null;
  }
}

module.exports = new TallerRepository();
