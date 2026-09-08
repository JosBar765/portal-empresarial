// src/core/auth/authController.js
const authService = require('./authService');
const jwtHelper = require('./jwtHelper');
const config = require('../../config/env');

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
      const payload = {
        id: authData.user.id,
        nombre: authData.user.nombre,
        email: authData.user.email,
        rolId: authData.user.rolId,
        rolNombre: authData.user.rolNombre,
        modulosPermitidos: authData.user.modulosPermitidos,
        permissions: authData.permissions
      };
      const newToken = jwtHelper.generateToken(payload);
      res.cookie('token', newToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
      });
      return res.json({ ok: true, user: authData.user });
    } catch (error) {
      return res.status(401).json({ error: error.message || 'No se pudo renovar la sesión.' });
    }
  }

  async logout(req, res) {
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
