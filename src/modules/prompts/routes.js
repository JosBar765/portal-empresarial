// src/modules/prompts/routes.js
// Montado en /api/prompts detrás de requireAuth y prompts.ver.
const express = require('express');
const router = express.Router();
const promptsController = require('./controllers/promptsController');
const adminController = require('./controllers/adminProductoController');
const ajustesController = require('./controllers/ajustesController');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');

const generar = requirePermission('prompts.generar');
const administrar = requirePermission('prompts.administrar');

// Asesor
router.get('/productos', generar, (req, res) => promptsController.listarProductos(req, res));
router.get('/config', generar, (req, res) => promptsController.obtenerConfig(req, res));
router.get('/contacto', generar, (req, res) => promptsController.obtenerContacto(req, res));
router.get('/recursos/:productoId/:clave', generar, (req, res) => promptsController.obtenerRecurso(req, res));
router.post('/generar', generar, (req, res) => promptsController.generar(req, res));

// Administración de productos
router.get('/admin/productos', administrar, (req, res) => adminController.listar(req, res));
router.post('/admin/productos', administrar, (req, res) => adminController.crear(req, res));
router.get('/admin/productos/:id', administrar, (req, res) => adminController.obtener(req, res));
router.post('/admin/productos/:id/borrador', administrar, (req, res) => adminController.crearBorrador(req, res));
router.put('/admin/productos/:id/borrador', administrar, (req, res) => adminController.guardarBorrador(req, res));
router.delete('/admin/productos/:id/borrador', administrar, (req, res) => adminController.descartarBorrador(req, res));
router.post('/admin/productos/:id/publicar', administrar, (req, res) => adminController.publicar(req, res));
router.patch('/admin/productos/:id/estado', administrar, (req, res) => adminController.cambiarEstado(req, res));
router.post('/admin/previsualizar', administrar, (req, res) => adminController.previsualizar(req, res));

// Ajustes globales
router.get('/admin/ajustes', administrar, (req, res) => ajustesController.listar(req, res));
router.put('/admin/ajustes/:clave', administrar, (req, res) => ajustesController.guardar(req, res));

module.exports = router;
