// src/core/notifications/notificacionRoutes.js
const express = require('express');
const router = express.Router();
const notificacionController = require('./notificacionController');

router.get('/resumen', (req, res) => notificacionController.resumen(req, res));
router.get('/', (req, res) => notificacionController.listar(req, res));
router.post('/leer-todas', (req, res) => notificacionController.marcarTodasLeidas(req, res));
router.post('/:id/leer', (req, res) => notificacionController.marcarLeida(req, res));

module.exports = router;
