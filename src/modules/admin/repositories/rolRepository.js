// src/modules/admin/repositories/rolRepository.js
const db = require('../../../config/database');

class RolRepository {
  async listarConConteo() {
    return db.query(
      `SELECT r.*, COUNT(DISTINCT u.id) AS usuarios_count, COUNT(DISTINCT rp.permiso_id) AS permisos_count
       FROM roles r
       LEFT JOIN usuarios u ON u.rol_id = r.id AND u.activo = 1
       LEFT JOIN rol_permisos rp ON rp.rol_id = r.id
       GROUP BY r.id
       ORDER BY r.nombre`,
      [],
      'rol:list'
    );
  }

  async crear({ nombre, descripcion }) {
    const result = await db.query('INSERT INTO roles (nombre, descripcion) VALUES (?, ?)', [nombre, descripcion || null], 'rol:insert');
    return result.insertId;
  }

  async actualizar(id, { nombre, descripcion }) {
    return db.query('UPDATE roles SET nombre = ?, descripcion = ? WHERE id = ?', [nombre, descripcion || null, id], 'rol:update');
  }

  async establecerActivo(id, activo) {
    return db.query('UPDATE roles SET activo = ? WHERE id = ?', [activo ? 1 : 0, id], 'rol:set_activo');
  }

  async listarPermisoIds(rolId) {
    const rows = await db.query('SELECT permiso_id FROM rol_permisos WHERE rol_id = ?', [rolId], 'rol_permiso:list_by_rol');
    return rows.map(r => r.permiso_id);
  }

  async contarUsuarios(id) {
    const rows = await db.query('SELECT COUNT(*) AS total FROM usuarios WHERE rol_id = ?', [id], 'rol:count_usuarios');
    return rows[0].total;
  }

  async establecerPermisos(rolId, permisoIds) {
    return db.query(
      'DELETE FROM rol_permisos WHERE rol_id = ?; INSERT INTO rol_permisos (rol_id, permiso_id) VALUES ...',
      [rolId, permisoIds],
      'rol_permiso:set'
    );
  }
}

module.exports = new RolRepository();
