// src/modules/admin/repositories/actividadRepository.js
const db = require('../../../config/database');

class ActividadRepository {
  async listar() {
    return db.query(
      `SELECT u.id, u.nombre, r.nombre AS rol_nombre, u.ultima_ciudad, u.sesion_iniciada_en, u.ultima_actividad_en
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.activo = 1
       ORDER BY u.ultima_actividad_en DESC`,
      [],
      'actividad:list'
    );
  }
}

module.exports = new ActividadRepository();
