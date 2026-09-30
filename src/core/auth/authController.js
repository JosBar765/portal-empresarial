// src/core/auth/authController.js
const authService = require('./authService');
const jwtHelper = require('./jwtHelper');
const sesionRepository = require('./sesionRepository');
const tokenService = require('./tokenService');
const { responderError } = require('../utils/erroresHttp');

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
    // Con el access token vencido, la sesión sigue viva mientras el refresh
    // token sea válido: autenticar() lo renueva y fija las cookies nuevas.
    let decoded = await tokenService.autenticar(req, res);

    // Cabecera Bearer: solo para clientes no-navegador; no se renueva.
    if (!decoded && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        decoded = jwtHelper.verifyToken(parts[1]);
      }
    }

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

      // La sesión se identifica por su `sid` (dentro del JWT y en
      // sesiones_activas): sin eso, un socket o un logout de una sesión ya
      // reemplazada podría pisar/borrar la de la sesión más nueva.
      const sesion = await tokenService.emitirSesion(authData);
      tokenService.fijarCookies(res, sesion);

      return res.json({
        ok: true,
        message: 'Autenticación exitosa',
        user: authData.user
      });
    } catch (error) {
      // Credenciales malas → 401 con el mensaje genérico; cualquier fallo
      // interno (BD caída, bug) → 500 genérico, nunca el texto de MySQL.
      return responderError(res, error, 401, { ok: false });
    }
  }

  // Cambia el refresh token por un par nuevo con el rol/permisos vigentes de
  // la base. Lo usa el socket cuando el admin cambia los permisos del rol
  // (refresco inmediato) y cualquier cliente que quiera renovar a propósito;
  // el resto de renovaciones ocurren solas en authenticateJWT.
  async refreshToken(req, res) {
    const refresh = req.cookies ? req.cookies[tokenService.REFRESH_COOKIE] : null;
    const resultado = await tokenService.renovar(refresh);
    if (!resultado.ok) {
      tokenService.limpiarCookies(res);
      return res.status(401).json({ error: 'Sesión no válida.' });
    }
    tokenService.fijarCookies(res, resultado);
    return res.json({ ok: true, user: resultado.user });
  }

  async logout(req, res) {
    // Libera la sesión única de inmediato — sin esto, el usuario tendría
    // que esperar a que el socket se desconecte (o a que expire el techo)
    // para poder volver a iniciar sesión, aunque haya cerrado sesión
    // explícitamente. `eliminarSiCoincide` exige el mismo `sid` para nunca
    // borrar por error la fila de una sesión más nueva (ej. este logout
    // llega tarde desde una pestaña de una sesión ya reemplazada).
    // Se acepta un access token ya vencido (solo se exige su firma): cerrar
    // sesión debe funcionar aunque hayan pasado más de 15 min desde la última
    // renovación. El refresh token también se busca por hash como respaldo.
    const token = req.cookies ? req.cookies[tokenService.ACCESS_COOKIE] : null;
    const decoded = token ? jwtHelper.verifyTokenIgnoreExpiry(token) : null;
    if (decoded && decoded.sid) {
      await sesionRepository.eliminarSiCoincide(decoded.id, decoded.sid);
    }
    const refresh = req.cookies ? req.cookies[tokenService.REFRESH_COOKIE] : null;
    if (typeof refresh === 'string' && refresh) {
      await sesionRepository.eliminarPorRefresh(tokenService.hashDe(refresh));
    }

    tokenService.limpiarCookies(res);

    return res.json({ ok: true, message: 'Sesión cerrada correctamente.' });
  }
}

module.exports = new AuthController();
