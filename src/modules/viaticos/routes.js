// src/modules/viaticos/routes.js
// Montado en /api/viaticos detrás de requireAuth y viaticos.ver.
const express = require('express');
const multer = require('multer');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');
const { PERMISOS, RECURSOS, ARCHIVOS } = require('./constantes');
const contextoController = require('./controllers/contextoController');
const configController = require('./controllers/configController');
const solicitudController = require('./controllers/solicitudController');
const gestionController = require('./controllers/gestionController');
const liquidacionController = require('./controllers/liquidacionController');
const borradorController = require('./controllers/borradorController');
const { crearCrud } = require('./controllers/crudController');
const catalogoService = require('./services/catalogoService');
const tramoService = require('./services/tramoService');
const vehiculoService = require('./services/vehiculoService');

// En memoria y con el tope duro: el tipo y el tamaño efectivos los valida el servicio contra viaticos_ajustes.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: ARCHIVOS.MAX_MB_DURO * 1024 * 1024 } });
const fotosDefectos = upload.fields([{ name: ARCHIVOS.CAMPO_DEFECTOS, maxCount: ARCHIVOS.MAX_DEFECTOS }]);
const archivoComprobante = upload.single(ARCHIVOS.CAMPO_ARCHIVO);

const router = express.Router();
router.get('/contexto', contextoController.obtener);

// Solicitudes del propio usuario (solo exigen viaticos.ver, el permiso de montaje).
router.get('/catalogos/solicitud', solicitudController.catalogos);
router.post('/solicitudes/calcular', solicitudController.calcular);
// Borradores del propio usuario (solo exigen viaticos.ver).
router.get('/borradores', borradorController.listar);
router.get('/borradores/:id', borradorController.obtener);
router.post('/borradores', borradorController.crear);
router.put('/borradores/:id', borradorController.actualizar);
router.delete('/borradores/:id', borradorController.eliminar);

router.get('/solicitudes', solicitudController.listar);
router.get('/solicitudes/:id', solicitudController.obtener);
router.post('/solicitudes', fotosDefectos, solicitudController.crear);
router.put('/solicitudes/:id', fotosDefectos, solicitudController.modificar);
router.delete('/solicitudes/:id', solicitudController.darDeBaja);
router.get('/solicitudes/:id/documentos', solicitudController.documentos);

// Liquidación del solicitante (más de 1 día): comprobantes y liquidar; también solo exigen viaticos.ver.
router.get('/solicitudes/:id/liquidacion', liquidacionController.obtener);
router.post('/solicitudes/:id/comprobantes', archivoComprobante, liquidacionController.agregarComprobante);
router.delete('/solicitudes/:id/comprobantes/:comprobanteId', liquidacionController.quitarComprobante);
router.post('/solicitudes/:id/liquidar', liquidacionController.liquidar);

// Gestiones: ver todo exige viaticos.gestionar; autorizar y rechazar, viaticos.autorizar; la vista de liquidación (solo lectura), viaticos.liquidar.
router.get('/gestiones', requirePermission(PERMISOS.GESTIONAR), gestionController.listar);
router.get('/gestiones/:id', requirePermission(PERMISOS.GESTIONAR), gestionController.obtener);
router.get('/gestiones/:id/documentos', requirePermission(PERMISOS.GESTIONAR), gestionController.documentos);
router.post('/gestiones/:id/autorizar', requirePermission(PERMISOS.AUTORIZAR), gestionController.autorizar);
router.post('/gestiones/:id/rechazar', requirePermission(PERMISOS.AUTORIZAR), gestionController.rechazar);
router.get('/gestiones/:id/liquidacion', requirePermission(PERMISOS.LIQUIDAR), gestionController.liquidacion);

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
// Combustibles: catálogo del sistema de solo lectura (lo necesita el formulario de vehículos).
config.get(`/${RECURSOS.COMBUSTIBLES}`, configController.listarCombustibles);

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
