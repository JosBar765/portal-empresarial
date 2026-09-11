// src/core/auth/authRoutes.js
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const router = express.Router();
const authController = require('./authController');

// Sin esto, un atacante podía probar contraseñas sin ningún límite contra
// cualquier cuenta (fuerza bruta) o probar credenciales filtradas de otros
// sitios contra todos los correos del sistema (credential stuffing). Clave
// combinada IP+correo: acota por cuenta atacada sin que un ataque contra UN
// correo bloquee a todo el resto de una misma oficina/NAT compartiendo IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${(req.body && req.body.email) || ''}`,
  handler: (req, res) => {
    res.status(429).json({ ok: false, error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' });
  }
});

// Solo se aplica a intentos de login reales — el resto de acciones de esta
// misma ruta estilo PHP (?action=...) no debe verse afectado.
function limitarSoloLogin(req, res, next) {
  if (req.query.action === 'login') return loginLimiter(req, res, next);
  return next();
}

// Enrutado compatible con consultas estilo PHP (?action=...)
router.route('/')
  .get((req, res) => authController.handleQueryAction(req, res))
  .post(limitarSoloLogin, (req, res) => {
    if (req.query.action === 'login') {
      return authController.loginPost(req, res);
    }
    return authController.handleQueryAction(req, res);
  });

// Rutas modernas alternativas de Express
router.get('/session', (req, res) => authController.sessionCheck(req, res));
router.post('/login', loginLimiter, (req, res) => authController.loginPost(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));
// Refresco de JWT en caliente cuando cambian los permisos del rol.
router.post('/refresh', (req, res) => authController.refreshToken(req, res));

module.exports = router;
