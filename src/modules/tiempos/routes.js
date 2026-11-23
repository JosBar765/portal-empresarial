// src/modules/tiempos/routes.js
// Montado en /api/tiempos detrás de requireAuth y tiempos.ver (ver src/app.js). La identidad sale siempre de req.user.
const express = require('express');
const router = express.Router();
const tiemposController = require('./controllers/tiemposController');

router.get('/tabla', (req, res) => tiemposController.tabla(req, res));
router.post('/calcular', (req, res) => tiemposController.calcular(req, res));

module.exports = router;
