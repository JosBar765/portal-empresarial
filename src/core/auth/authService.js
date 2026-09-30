// src/core/auth/authService.js
const bcrypt = require('bcryptjs');
const db = require('../../config/database');
const { paraLog } = require('../utils/logs');

// Cuentas: tras MAX_INTENTOS contraseñas malas seguidas la cuenta se bloquea
// BLOQUEO_MINUTOS (se reinicia al acertar). Usa las columnas ya existentes
// usuarios.intentos_fallidos / bloqueado_hasta.
const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;
// Hash de una contraseña inventada, con el mismo coste que los reales: cuando
// el correo no existe, la cuenta está inactiva o bloqueada, se compara contra
// él para que la respuesta tarde lo mismo que con una cuenta real y la
// latencia no delate qué correos existen.
const HASH_FICTICIO = bcrypt.hashSync('contrasena-ficticia-que-nadie-usa', 10);

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
    // Un módulo cuenta como "permitido" solo con su permiso "ver" — tener otras
    // acciones sueltas (crear, asignar…) sin "ver" no da acceso al módulo.
    const modules = [...new Set(permissionsRows.filter(row => row.codigo === `${row.modulo}.ver`).map(row => row.modulo))];
    return { rolNombre, permissions, modules };
  }

  /**
   * Autentica un usuario con email y contraseña.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{user: object, permissions: Array}>}
   */
  async authenticate(email, password) {
    // Un solo mensaje genérico para los 3 casos de rechazo (correo
    // inexistente, contraseña incorrecta, cuenta desactivada) — mensajes
    // distintos permitían confirmar qué correos existen y cuáles están
    // desactivados, facilitando credential stuffing dirigido. El motivo
    // real queda solo en el log del servidor para diagnóstico.
    const MENSAJE_GENERICO = 'Correo o contraseña incorrectos.';
    const rechazarConTiempoConstante = async () => {
      await bcrypt.compare(typeof password === 'string' ? password.slice(0, 72) : 'x', HASH_FICTICIO);
      throw new Error(MENSAJE_GENERICO);
    };

    // Solo se aceptan textos de largo razonable: un objeto/arreglo en `email`
    // llegaría al SQL (pool.query los expande) y un `password` enorme solo
    // sirve para gastar CPU. Se rechaza igual que unas credenciales malas.
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password
        || email.length > 150 || password.length > 128) {
      console.log('[Auth] Intento de login con datos de entrada inválidos.');
      return rechazarConTiempoConstante();
    }
    // MySQL compara el correo sin distinguir mayúsculas: se normaliza aquí para
    // que también el limitador de intentos vea una sola cuenta.
    const correo = email.trim().toLowerCase();

    // Obtener usuario
    const users = await db.query(
      `SELECT id, nombre, email, password_hash, rol_id, activo,
              (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS bloqueado
       FROM usuarios WHERE email = ?`,
      [correo]
    );

    if (users.length === 0) {
      console.log(`[Auth] Intento de login con correo inexistente: ${paraLog(correo)}`);
      return rechazarConTiempoConstante();
    }

    const user = users[0];

    if (!user.activo) {
      console.log(`[Auth] Intento de login de cuenta desactivada: ${paraLog(correo)}`);
      return rechazarConTiempoConstante();
    }

    if (user.bloqueado) {
      console.log(`[Auth] Intento de login en cuenta bloqueada temporalmente: ${paraLog(correo)}`);
      return rechazarConTiempoConstante();
    }

    // Validar contraseña
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      console.log(`[Auth] Intento de login con contraseña incorrecta: ${paraLog(correo)}`);
      // En un UPDATE de MySQL cada asignación ve el valor ya actualizado de las
      // anteriores: suma el fallo, bloquea al llegar al tope y reinicia el contador.
      await db.query(
        `UPDATE usuarios
         SET intentos_fallidos = intentos_fallidos + 1,
             bloqueado_hasta = IF(intentos_fallidos >= ?, NOW() + INTERVAL ? MINUTE, bloqueado_hasta),
             intentos_fallidos = IF(intentos_fallidos >= ?, 0, intentos_fallidos)
         WHERE id = ?`,
        [MAX_INTENTOS, BLOQUEO_MINUTOS, MAX_INTENTOS, user.id],
        'usuario:registrar_fallo_login'
      );
      throw new Error(MENSAJE_GENERICO);
    }
    await db.query(
      'UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ? AND (intentos_fallidos > 0 OR bloqueado_hasta IS NOT NULL)',
      [user.id],
      'usuario:reiniciar_fallos_login'
    );

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
