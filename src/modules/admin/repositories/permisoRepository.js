// src/modules/admin/repositories/permisoRepository.js
const db = require('../../../config/database');

class PermisoRepository {
  async listarTodos() {
    return db.query('SELECT * FROM permisos ORDER BY modulo, codigo', [], 'permiso:list');
  }
}

module.exports = new PermisoRepository();
