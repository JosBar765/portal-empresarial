// src/core/notifications/notificacionRoutes.js
const express = require('express');
const router = express.Router();
const notificacionController = require('./notificacionController');

router.get('/resumen', (req, res) => notificacionController.resumen(req, res));
router.get('/push/config', (req, res) => notificacionController.pushConfig(req, res));
router.post('/push/suscripcion', (req, res) => notificacionController.pushSuscribir(req, res));
router.delete('/push/suscripcion', (req, res) => notificacionController.pushDesuscribir(req, res));
router.get('/push/preferencias', (req, res) => notificacionController.listarPreferencias(req, res));
router.put('/push/preferencias', (req, res) => notificacionController.guardarPreferencia(req, res));
router.get('/', (req, res) => notificacionController.listar(req, res));
router.get('/:id', (req, res) => notificacionController.obtener(req, res));
router.post('/leer-todas', (req, res) => notificacionController.marcarTodasLeidas(req, res));
router.post('/:id/leer', (req, res) => notificacionController.marcarLeida(req, res));

module.exports = router;
