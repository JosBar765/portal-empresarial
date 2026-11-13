// src/modules/incidencias/configRoutes.js
// Montado en /api/incidencias/configuracion. Todo exige incidencias.configurar.
const express = require('express');
const router = express.Router();
const configController = require('./controllers/configController');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');
const { PERMISO } = require('./constantes');

router.use(requirePermission(PERMISO.CONFIGURAR));

router.get('/estado', configController.estado);
router.get('/historial', configController.historial);

router.get('/paises', configController.paises);
router.put('/paises/:id', configController.actualizarPais);

router.get('/catalogos/:catalogo', configController.listarCatalogo);
router.post('/catalogos/:catalogo', configController.crearEnCatalogo);
router.put('/catalogos/:catalogo/:id', configController.actualizarEnCatalogo);

router.get('/prioridades', configController.prioridades);
router.post('/prioridades', configController.crearPrioridad);
router.put('/prioridades/reglas', configController.guardarReglas);
router.put('/prioridades/:id', configController.actualizarPrioridad);

router.get('/parametros', configController.parametros);
router.put('/parametros', configController.guardarParametros);

router.get('/tecnicos', configController.tecnicos);
router.get('/tecnicos/candidatos', configController.candidatos);
router.post('/tecnicos', configController.agregarTecnico);
router.put('/tecnicos/:usuarioId', configController.actualizarTecnico);

router.get('/verificadores', configController.verificadores);
router.get('/verificadores/candidatos', configController.candidatosVerificador);
router.post('/verificadores', configController.agregarVerificador);
router.delete('/verificadores/:id', configController.quitarVerificador);

router.get('/roles', configController.roles);
router.put('/roles/:rolId', configController.actualizarRol);

module.exports = router;
