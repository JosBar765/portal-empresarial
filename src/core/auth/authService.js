// src/core/auth/authService.js
const bcrypt = require('bcryptjs');
const db = require('../../config/database');

class AuthService {
  /**
   * Autentica un usuario con email y contraseña.
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<{user: object, permissions: Array}>}
   */
  async authenticate(email, password) {
    if (!email || !password) {
      throw new Error('Email y contraseña son requeridos.');
    }

    // Obtener usuario
    const users = await db.query(
      'SELECT id, nombre, email, password_hash, rol_id, activo FROM usuarios WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      throw new Error('Usuario no encontrado.');
    }

    const user = users[0];

    if (!user.activo) {
      throw new Error('Esta cuenta de usuario está desactivada.');
    }

    // Validar contraseña
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new Error('Contraseña incorrecta.');
    }

    // Obtener permisos asociados al rol
    const permissionsRows = await db.query(
      `SELECT p.codigo, p.modulo 
       FROM permisos p
       INNER JOIN rol_permisos rp ON p.id = rp.permiso_id
       WHERE rp.rol_id = ?`,
      [user.rol_id]
    );

    // Obtener detalles del rol
    const rolesRows = await db.query(
      'SELECT nombre FROM roles WHERE id = ?',
      [user.rol_id]
    );
    const rolNombre = rolesRows.length > 0 ? rolesRows[0].nombre : 'Usuario';

    // Formatear permisos
    const permissions = permissionsRows.map(row => row.codigo);
    const modules = [...new Set(permissionsRows.map(row => row.modulo))];

    // Quitar hash de la contraseña por seguridad
    const userClean = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rolId: user.rol_id,
      rolNombre: rolNombre,
      modulosPermitidos: modules
    };

    return {
      user: userClean,
      permissions
    };
  }
}

module.exports = new AuthService();
