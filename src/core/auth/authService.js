// src/core/auth/authService.js
const bcrypt = require('bcryptjs');
const db = require('../../config/database');

class AuthService {
  // Carga permisos + nombre del rol para un rol_id — compartido entre
  // authenticate (login) y reautorizar (refresco de JWT en caliente cuando
  // cambian los permisos de un rol).
  async _cargarPermisosYRol(rolId) {
    const permissionsRows = await db.query(
      `SELECT p.codigo, p.modulo
       FROM permisos p
       INNER JOIN rol_permisos rp ON p.id = rp.permiso_id
       WHERE rp.rol_id = ?`,
      [rolId]
    );
    const rolesRows = await db.query(
      'SELECT nombre FROM roles WHERE id = ?',
      [rolId]
    );
    const rolNombre = rolesRows.length > 0 ? rolesRows[0].nombre : 'Usuario';
    const permissions = permissionsRows.map(row => row.codigo);
    const modules = [...new Set(permissionsRows.map(row => row.modulo))];
    return { rolNombre, permissions, modules };
  }

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

    const { rolNombre, permissions, modules } = await this._cargarPermisosYRol(user.rol_id);

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

  // Relee rol/permisos vigentes de un usuario YA autenticado (sin
  // contraseña) para reemitir su JWT cuando el admin cambia los permisos de
  // su rol. Si lo desactivaron mientras tenía sesión abierta, la sesión cae
  // en el próximo refresco.
  async reautorizar(usuarioId) {
    const users = await db.query(
      'SELECT id, nombre, email, rol_id, activo FROM usuarios WHERE id = ?',
      [usuarioId],
      'usuario:find_by_id'
    );
    const user = users[0];
    if (!user) {
      throw new Error('Usuario no encontrado.');
    }
    if (!user.activo) {
      throw new Error('Esta cuenta de usuario está desactivada.');
    }

    const { rolNombre, permissions, modules } = await this._cargarPermisosYRol(user.rol_id);

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
