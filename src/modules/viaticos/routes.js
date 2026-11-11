// src/modules/viaticos/routes.js
// Montado en /api/viaticos detrás de requireAuth y viaticos.ver.
const express = require('express');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');
const { PERMISOS, RECURSOS } = require('./constantes');
const contextoController = require('./controllers/contextoController');
const configController = require('./controllers/configController');
const solicitudController = require('./controllers/solicitudController');
const { crearCrud } = require('./controllers/crudController');
const catalogoService = require('./services/catalogoService');
const tramoService = require('./services/tramoService');
const vehiculoService = require('./services/vehiculoService');

const router = express.Router();
router.get('/contexto', contextoController.obtener);

// Solicitudes del propio usuario (solo exigen viaticos.ver, el permiso de montaje).
router.get('/catalogos/solicitud', solicitudController.catalogos);
router.post('/solicitudes/calcular', solicitudController.calcular);
router.get('/solicitudes', solicitudController.listar);
router.get('/solicitudes/:id', solicitudController.obtener);

// Configuración: todo el subárbol exige viaticos.configurar.
const config = express.Router();

// Recursos con la misma forma: GET lista, POST crea, PUT /:id edita, PATCH /:id/activo activa o desactiva.
function registrarCrud(recurso, servicio) {
  const crud = crearCrud(servicio);
  config.get(`/${recurso}`, crud.listar);
  config.post(`/${recurso}`, crud.crear);
  config.put(`/${recurso}/:id`, crud.editar);
  config.patch(`/${recurso}/:id/activo`, crud.cambiarActivo);
}

config.get(`/${RECURSOS.PAISES}`, configController.listarPaises);

Object.entries(catalogoService.servicios).forEach(([recurso, servicio]) => registrarCrud(recurso, servicio));
registrarCrud(RECURSOS.TRAMOS, tramoService);
registrarCrud(RECURSOS.VEHICULOS, vehiculoService);

config.get(`/${RECURSOS.VALORES_COMIDA}`, configController.obtenerValoresComida);
config.put(`/${RECURSOS.VALORES_COMIDA}`, configController.guardarValoresComida);

// La regla no tiene `activo` ni id propio: su clave es (país, tipo de licencia, tipo de placa).
config.get(`/${RECURSOS.REGLAS_LICENCIA}`, configController.listarReglas);
config.post(`/${RECURSOS.REGLAS_LICENCIA}`, configController.crearRegla);
config.put(`/${RECURSOS.REGLAS_LICENCIA}/:paisId/:tipoLicenciaId/:tipoPlacaId`, configController.editarRegla);
config.delete(`/${RECURSOS.REGLAS_LICENCIA}/:paisId/:tipoLicenciaId/:tipoPlacaId`, configController.eliminarRegla);

config.get(`/${RECURSOS.PERSONAS}`, configController.listarPersonas);
config.put(`/${RECURSOS.PERSONAS}/:usuarioId`, configController.guardarPersona);

config.get(`/${RECURSOS.AJUSTES}`, configController.listarAjustes);
config.put(`/${RECURSOS.AJUSTES}/:clave`, configController.guardarAjuste);

router.use('/config', requirePermission(PERMISOS.CONFIGURAR), config);

module.exports = router;
