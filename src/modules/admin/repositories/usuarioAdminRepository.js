// src/modules/admin/repositories/usuarioAdminRepository.js
const db = require('../../../config/database');

class UsuarioAdminRepository {
  async listarConDetalle() {
    return db.query(
      `SELECT u.*, r.nombre AS rol_nombre,
              a.tienda_id AS tienda_id,
              CONCAT(e.nombre, IF(s.nombre IS NOT NULL, CONCAT(', ', s.nombre), '')) AS tienda_nombre,
              p.nombre AS paises_asignados,
              COALESCE(tt.taller_id, td.id) AS taller_id
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       LEFT JOIN asesores a ON a.usuario_id = u.id
       LEFT JOIN tiendas t ON t.id = a.tienda_id
       LEFT JOIN empresas e ON e.id = t.empresa_id
       LEFT JOIN subdivisiones s ON s.id = t.subdivision_id
       LEFT JOIN paises p ON p.id = e.pais_id
       LEFT JOIN taller_tecnicos tt ON tt.usuario_id = u.id
       LEFT JOIN talleres td ON td.encargado_id = u.id
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

  async crear({ nombre, email, passwordHash, rolId }) {
    const result = await db.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES (?, ?, ?, ?)',
      [nombre, email, passwordHash, rolId],
      'usuario_admin:insert'
    );
    return result.insertId;
  }

  async actualizar(id, { nombre, email, rolId }) {
    return db.query(
      'UPDATE usuarios SET nombre = ?, email = ?, rol_id = ? WHERE id = ?',
      [nombre, email, rolId, id],
      'usuario_admin:update'
    );
  }

  async actualizarPassword(id, passwordHash) {
    return db.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [passwordHash, id], 'usuario_admin:update_password');
  }

  async establecerActivo(id, activo) {
    return db.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo ? 1 : 0, id], 'usuario_admin:set_activo');
  }

  // -------------------------------------------------------------------
  // Filas satélite de Asesor de Ventas / Supervisor de Ventas — `usuarios`
  // no guarda su tienda/teléfono.
  // -------------------------------------------------------------------
  async obtenerAsesorPorUsuarioId(usuarioId) {
    const rows = await db.query('SELECT * FROM asesores WHERE usuario_id = ?', [usuarioId], 'asesor:find_by_usuario');
    return rows[0] || null;
  }

  async crearAsesor(usuarioId, tiendaId, telefono) {
    const result = await db.query(
      'INSERT INTO asesores (usuario_id, tienda_id, telefono) VALUES (?, ?, ?)',
      [usuarioId, tiendaId || null, telefono || null],
      'asesor:insert'
    );
    return result.insertId;
  }

  async actualizarAsesor(usuarioId, tiendaId, telefono) {
    return db.query(
      'UPDATE asesores SET tienda_id = ?, telefono = ? WHERE usuario_id = ?',
      [tiendaId || null, telefono || null, usuarioId],
      'asesor:update'
    );
  }

  async eliminarAsesor(usuarioId) {
    return db.query('DELETE FROM asesores WHERE usuario_id = ?', [usuarioId], 'asesor:delete');
  }

  async obtenerSupervisorPorUsuarioId(usuarioId) {
    const rows = await db.query('SELECT * FROM supervisores WHERE usuario_id = ?', [usuarioId], 'supervisor:find_by_usuario');
    return rows[0] || null;
  }

  async crearSupervisor(usuarioId, telefono) {
    const result = await db.query(
      'INSERT INTO supervisores (usuario_id, telefono) VALUES (?, ?)',
      [usuarioId, telefono || null],
      'supervisor:insert'
    );
    return result.insertId;
  }

  async actualizarSupervisor(usuarioId, telefono) {
    return db.query('UPDATE supervisores SET telefono = ? WHERE usuario_id = ?', [telefono || null, usuarioId], 'supervisor:update');
  }

  async eliminarSupervisor(usuarioId) {
    return db.query('DELETE FROM supervisores WHERE usuario_id = ?', [usuarioId], 'supervisor:delete');
  }
}

module.exports = new UsuarioAdminRepository();
