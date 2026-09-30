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
const normalizarCorreo = (email) => (typeof email === 'string' ? email.trim().toLowerCase().slice(0, 150) : '(no-texto)');

// Por (IP + correo NORMALIZADO): sin normalizar, "Admin@x" y "ADMIN@x" (que
// MySQL trata como la misma cuenta) tendrían cada uno su propio contador.
// `skipSuccessfulRequests`: solo cuentan los intentos fallidos, así un usuario
// legítimo nunca se bloquea a sí mismo por iniciar sesión varias veces.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${normalizarCorreo(req.body && req.body.email)}`,
  handler: (req, res) => {
    res.status(429).json({ ok: false, error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' });
  }
});

// Segundo límite, por IP solamente: frena el credential stuffing (un intento
// por cada uno de muchos correos) que el límite por correo no ve. Cifra
// generosa porque varias personas de una misma oficina comparten IP; solo
// cuentan los fallos.
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip)}`,
  handler: (req, res) => {
    res.status(429).json({ ok: false, error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' });
  }
});

// Ambos límites en cadena.
const limitarLogin = [loginIpLimiter, loginLimiter];

// Solo se aplica a intentos de login reales — el resto de acciones de esta
// misma ruta estilo PHP (?action=...) no debe verse afectado.
function limitarSoloLogin(req, res, next) {
  if (req.query.action === 'login') {
    return loginIpLimiter(req, res, (err) => (err ? next(err) : loginLimiter(req, res, next)));
  }
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
router.post('/login', ...limitarLogin, (req, res) => authController.loginPost(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));
// Refresco de JWT en caliente cuando cambian los permisos del rol.
router.post('/refresh', (req, res) => authController.refreshToken(req, res));

module.exports = router;
