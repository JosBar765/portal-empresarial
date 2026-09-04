// src/core/auth/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('./authController');

// Enrutado compatible con consultas estilo PHP (?action=...)
router.route('/')
  .get((req, res) => authController.handleQueryAction(req, res))
  .post((req, res) => {
    if (req.query.action === 'login') {
      return authController.loginPost(req, res);
    }
    return authController.handleQueryAction(req, res);
  });

// Rutas modernas alternativas de Express
router.get('/session', (req, res) => authController.sessionCheck(req, res));
router.post('/login', (req, res) => authController.loginPost(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));
// analisis_correcciones_17.md #2/#3: refresco de JWT en caliente y latido de presencia.
router.post('/refresh', (req, res) => authController.refreshToken(req, res));
router.get('/heartbeat', (req, res) => authController.heartbeat(req, res));

module.exports = router;
