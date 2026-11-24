// src/modules/tiempos/routes.js
// Montado en /api/tiempos detrás de requireAuth y tiempos.ver (ver src/app.js). La identidad sale siempre de req.user.
const express = require('express');
const router = express.Router();
const tiemposController = require('./controllers/tiemposController');
const adminController = require('./controllers/adminController');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');

const administrar = requirePermission('tiempos.administrar');

router.get('/tabla', (req, res) => tiemposController.tabla(req, res));
router.get('/festivos', (req, res) => tiemposController.festivos(req, res));
router.post('/calcular', (req, res) => tiemposController.calcular(req, res));

// Administración de la tabla (solo tiempos.administrar): todo se guarda en un borrador hasta publicar una versión.
router.get('/admin/estado', administrar, adminController.estado);
router.get('/admin/tabla', administrar, adminController.tabla);
router.post('/admin/productos', administrar, adminController.crearProducto);
router.put('/admin/productos/:clave', administrar, adminController.guardarProducto);
router.put('/admin/extras', administrar, adminController.guardarExtras);
router.put('/admin/avisos-generales', administrar, adminController.guardarAvisos);
router.put('/admin/catalogos', administrar, adminController.guardarCatalogos);
router.get('/admin/cambios', administrar, adminController.cambios);
router.post('/admin/publicar', administrar, adminController.publicar);
router.delete('/admin/borrador', administrar, adminController.descartar);
router.get('/admin/versiones', administrar, adminController.versiones);
router.get('/admin/versiones/:id/cambios', administrar, adminController.cambiosDeVersion);
router.post('/admin/versiones/:id/usar-como-borrador', administrar, adminController.usarComoBorrador);
router.get('/admin/actividad', administrar, adminController.actividad);

module.exports = router;
