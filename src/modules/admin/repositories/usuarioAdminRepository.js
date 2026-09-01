// src/modules/admin/repositories/usuarioAdminRepository.js
const db = require('../../../config/database');

class UsuarioAdminRepository {
  async listarConDetalle() {
    return db.query(
      `SELECT u.*, r.nombre AS rol_nombre, t.nombre AS tienda_nombre, p.nombre AS paises_asignados
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       LEFT JOIN tiendas t ON t.id = u.tienda_id
       LEFT JOIN paises p ON p.id = t.pais_id
       ORDER BY u.nombre`,
      [],
      'usuario_admin:list'
    );
  }

  async obtenerPorId(id) {
    const rows = await db.query('SELECT * FROM usuarios WHERE id = ?', [id], 'usuario:find_by_id');
    return rows[0] || null;
  }

  async obtenerPorEmail(email) {
    const rows = await db.query('SELECT * FROM usuarios WHERE email = ?', [email], 'usuario_admin:find_by_email');
    return rows[0] || null;
  }

  async crear({ nombre, email, telefono, passwordHash, rolId, tiendaId }) {
    const result = await db.query(
      'INSERT INTO usuarios (nombre, email, telefono, password_hash, rol_id, tienda_id) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, email, telefono || null, passwordHash, rolId, tiendaId || null],
      'usuario_admin:insert'
    );
    return result.insertId;
  }

  async actualizar(id, { nombre, email, telefono, rolId, tiendaId }) {
    return db.query(
      'UPDATE usuarios SET nombre = ?, email = ?, telefono = ?, rol_id = ?, tienda_id = ? WHERE id = ?',
      [nombre, email, telefono || null, rolId, tiendaId || null, id],
      'usuario_admin:update'
    );
  }

  async actualizarPassword(id, passwordHash) {
    return db.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [passwordHash, id], 'usuario_admin:update_password');
  }

  async establecerActivo(id, activo) {
    return db.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo ? 1 : 0, id], 'usuario_admin:set_activo');
  }
}

module.exports = new UsuarioAdminRepository();
