// src/modules/proyectos/routes.js
// Montado en /api/proyectos detrás de requireAuth y proyectos.ver.
const express = require('express');
const router = express.Router();
const configController = require('./controllers/configController');
const catalogoController = require('./controllers/catalogoController');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');

const administrar = requirePermission('proyectos.administrar');

// Centro de configuración: inicio (A0), parámetros (A3), reglas e interruptores (A5), historial (A10) y país
router.get('/config/parametros', administrar, configController.listar('parametros'));
router.put('/config/parametros', administrar, configController.guardar('parametros'));
router.get('/config/reglas', administrar, configController.listar('reglas'));
router.put('/config/reglas', administrar, configController.guardar('reglas'));
router.post('/config/ajustes/:clave/restaurar', administrar, (req, res) => configController.restaurar(req, res));
router.get('/config/resumen', administrar, (req, res) => configController.resumen(req, res));
router.get('/config/historial', administrar, (req, res) => configController.historial(req, res));
router.post('/config/historial/:id/restaurar', administrar, (req, res) => configController.restaurarCambio(req, res));
router.get('/config/paises', administrar, (req, res) => configController.listarPaises(req, res));
router.put('/config/paises/:id', administrar, (req, res) => configController.guardarPais(req, res));

// Catálogos (A1): nichos, artículos, áreas, canales, resultados, motivos, estructuras y monedas
router.get('/catalogos/:catalogo', administrar, (req, res) => catalogoController.listar(req, res));
router.post('/catalogos/:catalogo', administrar, (req, res) => catalogoController.crear(req, res));
router.put('/catalogos/:catalogo/:id', administrar, (req, res) => catalogoController.editar(req, res));
router.patch('/catalogos/:catalogo/:id/activo', administrar, (req, res) => catalogoController.cambiarActivo(req, res));

module.exports = router;
