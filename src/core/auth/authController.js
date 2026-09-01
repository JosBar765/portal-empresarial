// src/core/auth/authController.js
const authService = require('./authService');
const jwtHelper = require('./jwtHelper');
const config = require('../../config/env');
const presenciaTracker = require('./presenciaTracker');

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
        modulosPermitidos: decoded.modulosPermitidos
      }
    });
  }

  async getCsrfToken(req, res) {
    // Retornar un token CSRF estático en desarrollo para compatibilidad con la interfaz
    return res.json({ csrf_token: 'munditrofeos_csrf_token_jwt_secure' });
  }

  async loginPost(req, res) {
    const { email, password } = req.body;

    try {
      const authData = await authService.authenticate(email, password);
      
      // Construir payload seguro a encriptar en el JWT. 
      // El payload contiene toda la identidad y privilegios del usuario.
      const payload = {
        id: authData.user.id,
        nombre: authData.user.nombre,
        email: authData.user.email,
        rolId: authData.user.rolId,
        rolNombre: authData.user.rolNombre,
        modulosPermitidos: authData.user.modulosPermitidos,
        permissions: authData.permissions
      };

      // Generar JWT
      const token = jwtHelper.generateToken(payload);

      // analisis_correcciones_13.md #6: sella el inicio de sesión para la
      // pestaña "Actividad de Usuarios" — no bloquea el login si falla.
      presenciaTracker.sellarLogin(authData.user.id, req.ip).catch(err => console.error('[Presencia] No se pudo sellar el login:', err));

      // Guardar token en cookie segura HttpOnly
      res.cookie('token', token, {
        httpOnly: true,                               // Protege contra ataques XSS
        secure: config.nodeEnv === 'production',      // Requiere HTTPS en producción
        sameSite: 'strict',                           // Protege contra ataques CSRF
        maxAge: 24 * 60 * 60 * 1000                   // 24 horas de expiración
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

  async logout(req, res) {
    // analisis_correcciones_13.md #6: limpia "conectado desde" — logout corre
    // antes de authenticateJWT (rutas de /api/auth montadas antes del gate
    // global), así que la identidad se lee directo de la cookie.
    const token = req.cookies ? req.cookies.token : null;
    const decoded = token ? jwtHelper.verifyToken(token) : null;
    if (decoded) {
      presenciaTracker.limpiarSesion(decoded.id).catch(err => console.error('[Presencia] No se pudo limpiar la sesión:', err));
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
