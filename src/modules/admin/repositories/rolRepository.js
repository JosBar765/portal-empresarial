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

  async obtenerPorId(id) {
    const rows = await db.query('SELECT id, nombre, hereda_de_rol_id FROM roles WHERE id = ?', [id], 'rol:find_by_id');
    return rows[0] || null;
  }

  async listarIdsHijos(padreId) {
    const rows = await db.query('SELECT id FROM roles WHERE hereda_de_rol_id = ?', [padreId], 'rol:list_hijos');
    return rows.map(r => r.id);
  }

  // Reemplaza los permisos del rol y, en la misma transacción, quita de los
  // roles hijos los que ya no estén en `permisoIds` (no agrega nada a los hijos).
  async establecerPermisosEnCascada(rolId, permisoIds, hijoIds) {
    return db.transaccion(async (tx) => {
      await tx.query('DELETE FROM rol_permisos WHERE rol_id = ?', [rolId], 'rol_permiso:delete_todos');
      if (permisoIds.length) {
        const placeholders = permisoIds.map(() => '(?, ?)').join(', ');
        const params = permisoIds.flatMap(id => [rolId, id]);
        await tx.query(`INSERT INTO rol_permisos (rol_id, permiso_id) VALUES ${placeholders}`, params, 'rol_permiso:insertar_todos');
      }
      if (!hijoIds.length) return;
      if (permisoIds.length) {
        await tx.query('DELETE FROM rol_permisos WHERE rol_id IN (?) AND permiso_id NOT IN (?)', [hijoIds, permisoIds], 'rol_permiso:cascada_quitar');
      } else {
        await tx.query('DELETE FROM rol_permisos WHERE rol_id IN (?)', [hijoIds], 'rol_permiso:cascada_quitar_todos');
      }
    });
  }

  async establecerPermisos(rolId, permisoIds) {
    await db.query('DELETE FROM rol_permisos WHERE rol_id = ?', [rolId], 'rol_permiso:delete_todos');
    if (!permisoIds.length) return;
    const placeholders = permisoIds.map(() => '(?, ?)').join(', ');
    const params = permisoIds.flatMap(id => [rolId, id]);
    return db.query(`INSERT INTO rol_permisos (rol_id, permiso_id) VALUES ${placeholders}`, params, 'rol_permiso:insertar_todos');
  }
}

module.exports = new RolRepository();
