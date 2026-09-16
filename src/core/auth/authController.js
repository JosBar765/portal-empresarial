// src/core/auth/authController.js
const crypto = require('crypto');
const authService = require('./authService');
const jwtHelper = require('./jwtHelper');
const sesionRepository = require('./sesionRepository');
const config = require('../../config/env');

// La cookie debe durar lo mismo que el JWT real que contiene — antes
// quedaba fija en 24h sin importar JWT_EXPIRES_IN, así que con un valor más
// corto (ej. las 12h actuales) el navegador seguía mandando un token ya
// vencido durante horas de más (rechazado igual por verifyToken, pero
// confuso: el usuario "parece" seguir logueado hasta que hace una acción).
function duracionEnMs(expresion) {
  if (typeof expresion === 'number') return expresion * 1000;
  const match = /^(\d+)(s|m|h|d)$/.exec(String(expresion).trim());
  if (!match) return 24 * 60 * 60 * 1000; // formato no reconocido: fallback conservador
  const unidadEnMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return Number(match[1]) * unidadEnMs[match[2]];
}
const COOKIE_MAX_AGE = duracionEnMs(config.jwtExpiresIn);

class AuthController {
  async handleQueryAction(req, res) {
    const action = req.query.action;
    
    switch (action) {
      case 'session_check':
        return this.sessionCheck(req, res);
      case 'csrf':
        return this.getCsrfToken(req, res);
      case 'login':
        return this.loginPost(req, res);
      case 'logout':
        return this.logout(req, res);
      default:
        return res.status(400).json({ error: 'Acción no válida o no especificada.' });
    }
  }

  async sessionCheck(req, res) {
    // Leer token de cookies o header
    let token = req.cookies ? req.cookies.token : null;
    
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return res.json({ autenticado: false });
    }

    const decoded = jwtHelper.verifyToken(token);
    if (!decoded) {
      return res.json({ autenticado: false });
    }

    return res.json({
      autenticado: true,
      user: {
        id: decoded.id,
        nombre: decoded.nombre,
        email: decoded.email,
        rolId: decoded.rolId,
        rolNombre: decoded.rolNombre,
        modulosPermitidos: decoded.modulosPermitidos,
        permissions: decoded.permissions
      }
    });
  }

  // Este endpoint y el `csrf_token` que el login manda en su body son
  // decorativos — ningún middleware lo valida en ningún lado (el valor es
  // el mismo string fijo para cualquiera). Se conserva sin tocar porque
  // `public/login/index.html` todavía lo consume, pero la protección CSRF
  // REAL de este proyecto es `sameSite: 'strict'` en la cookie del JWT
  // (ver loginPost/refreshToken) — suficiente dado que la app solo usa esa
  // cookie, sin formularios cross-site relevantes que dependan de ella.
  async getCsrfToken(req, res) {
    return res.json({ csrf_token: 'munditrofeos_csrf_token_jwt_secure' });
  }

  async loginPost(req, res) {
    const { email, password } = req.body;

    try {
      const authData = await authService.authenticate(email, password);

      // La sesión única se revisa DESPUÉS de validar la contraseña, nunca
      // antes — si se revisara primero, la respuesta ("ya hay una sesión
      // activa" vs "credenciales inválidas") delataría qué correos existen
      // y cuáles tienen sesión abierta ahora mismo, sin necesidad de
      // acertar la contraseña (mismo criterio que el mensaje genérico de
      // authService.authenticate).
      const sesionExistente = await sesionRepository.obtenerActiva(authData.user.id);
      if (sesionExistente) {
        return res.status(409).json({
          ok: false,
          error: 'ACTIVE_SESSION_EXISTS',
          message: 'Ya tienes una sesión activa en otro dispositivo o navegador.'
        });
      }

      // `sid`: identifica ESTA sesión (no el usuario) — sin esto, un socket
      // o un logout de una sesión ya reemplazada podría pisar/borrar la fila
      // de la sesión más nueva que la reemplazó (ver sesionRepository).
      const sid = crypto.randomUUID();

      // Construir payload seguro a encriptar en el JWT.
      // El payload contiene toda la identidad y privilegios del usuario.
      const payload = {
        id: authData.user.id,
        nombre: authData.user.nombre,
        email: authData.user.email,
        rolId: authData.user.rolId,
        rolNombre: authData.user.rolNombre,
        modulosPermitidos: authData.user.modulosPermitidos,
        permissions: authData.permissions,
        sid
      };

      // Generar JWT
      const token = jwtHelper.generateToken(payload);
      await sesionRepository.crear(authData.user.id, sid, new Date(Date.now() + COOKIE_MAX_AGE));

      // Guardar token en cookie segura HttpOnly
      res.cookie('token', token, {
        httpOnly: true,                               // Protege contra ataques XSS
        secure: config.nodeEnv === 'production',      // Requiere HTTPS en producción
        sameSite: 'strict',                           // Protege contra ataques CSRF
        maxAge: COOKIE_MAX_AGE,
      });

      return res.json({
        ok: true,
        message: 'Autenticación exitosa',
        user: authData.user
      });
    } catch (error) {
      return res.status(401).json({
        ok: false,
        error: error.message || 'Credenciales incorrectas.'
      });
    }
  }

  // Reemite la cookie con el rol/permisos vigentes de un usuario ya
  // autenticado — se dispara cuando el socket le avisa que los permisos de
  // su rol cambiaron, sin pedirle credenciales.
  async refreshToken(req, res) {
    const token = req.cookies ? req.cookies.token : null;
    const decoded = token ? jwtHelper.verifyToken(token) : null;
    if (!decoded) {
      return res.status(401).json({ error: 'Sesión no válida.' });
    }

    try {
      const authData = await authService.reautorizar(decoded.id);
      // Mismo `sid` — esto es un refresco del token de la sesión YA activa
      // (cambio de permisos), no un login nuevo; conservarlo es lo que deja
      // a sesionRepository asociar los sockets ya abiertos con el token
      // reemitido en vez de tratarlos como huérfanos de una sesión distinta.
      const sid = decoded.sid;
      const payload = {
        id: authData.user.id,
        nombre: authData.user.nombre,
        email: authData.user.email,
        rolId: authData.user.rolId,
        rolNombre: authData.user.rolNombre,
        modulosPermitidos: authData.user.modulosPermitidos,
        permissions: authData.permissions,
        sid
      };
      const newToken = jwtHelper.generateToken(payload);
      if (sid) await sesionRepository.extenderExpiracion(authData.user.id, sid, new Date(Date.now() + COOKIE_MAX_AGE));
      res.cookie('token', newToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: COOKIE_MAX_AGE,
      });
      return res.json({ ok: true, user: authData.user });
    } catch (error) {
      return res.status(401).json({ error: error.message || 'No se pudo renovar la sesión.' });
    }
  }

  async logout(req, res) {
    // Libera la sesión única de inmediato — sin esto, el usuario tendría
    // que esperar a que el socket se desconecte (o a que expire el techo)
    // para poder volver a iniciar sesión, aunque haya cerrado sesión
    // explícitamente. `eliminarSiCoincide` exige el mismo `sid` para nunca
    // borrar por error la fila de una sesión más nueva (ej. este logout
    // llega tarde desde una pestaña de una sesión ya reemplazada).
    const token = req.cookies ? req.cookies.token : null;
    const decoded = token ? jwtHelper.verifyToken(token) : null;
    if (decoded && decoded.sid) {
      await sesionRepository.eliminarSiCoincide(decoded.id, decoded.sid);
    }

    // Eliminar la cookie limpiando su valor y estableciendo expiración inmediata
    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0),
      path: '/'
    });

    return res.json({ ok: true, message: 'Sesión cerrada correctamente.' });
  }
}

module.exports = new AuthController();
