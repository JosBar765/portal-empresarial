// src/modules/vales/routes.js
const express = require('express');
const multer = require('multer');
const router = express.Router();
const valeController = require('./controllers/valeController');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');

const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, TIPOS_PERMITIDOS.has(file.mimetype));
  }
});

const camposAdjuntos = upload.fields([
  { name: 'imagenes', maxCount: 10 },
  { name: 'documentos', maxCount: 5 }
]);
const campoPropuesta = upload.fields([{ name: 'propuesta', maxCount: 1 }]);
const campoFusion = upload.fields([{ name: 'fusion', maxCount: 1 }]);

// Permisos
const verVales = requirePermission('vales.ver');
const autorizarCreacionVale = requirePermission('vales.autorizar_creacion');
const crearVale = requirePermission('vales.crear');
const asignarVale = requirePermission('vales.asignar');
const verPanelGerencia = requirePermission('vales.ver_gerencia');
const trabajarVale = requirePermission('vales.trabajar');
const revisarVale = requirePermission('vales.revisar');
const aprobacionGeneralVale = requirePermission('vales.aprobar_general');
const confirmarVale = requirePermission('vales.confirmar');
const solicitarModificacionVale = requirePermission('vales.solicitar_modificacion');
const aprobarModificacionVale = requirePermission('vales.aprobar_modificacion'); 

router.get('/catalogos', verVales, (req, res) => valeController.catalogos(req, res));
router.get('/talleres', verVales, (req, res) => valeController.talleres(req, res));
router.get('/limite-colectivo', autorizarCreacion, (req, res) => valeController.limiteColectivo(req, res));
router.get('/capacidad-entrega', crearVale, (req, res) => valeController.capacidadEntrega(req, res));
router.get('/tecnicos', asignarVale, (req, res) => valeController.tecnicos(req, res));
router.get('/carga-trabajo', asignarVale, (req, res) => valeController.cargaTrabajo(req, res));
router.get('/carga-trabajo/:tecnicoId', asignarVale, (req, res) => valeController.cargaTrabajoTecnico(req, res));

router.get('/', verVales, (req, res) => valeController.buzon(req, res));
router.get('/dashboard-gerencia', verPanelGerencia, (req, res) => valeController.dashboardGerencia(req, res));
router.post('/', crearVale, camposAdjuntos, (req, res) => valeController.crear(req, res));

router.get('/:id', verVales, (req, res) => valeController.detalle(req, res));
router.get('/:id/pdf', verVales, (req, res) => valeController.descargarPdf(req, res));

router.post('/:id/asignar', asignarVale, (req, res) => valeController.asignar(req, res));
router.post('/:id/comenzar', trabajarVale, (req, res) => valeController.comenzar(req, res));
router.post('/:id/entregar', trabajarVale, campoPropuesta, (req, res) => valeController.entregar(req, res));
router.post('/:id/cancelar-proceso', trabajarVale, (req, res) => valeController.cancelarProceso(req, res));
router.post('/:id/pausar', trabajarVale, (req, res) => valeController.pausar(req, res));
router.post('/:id/reanudar', trabajarVale, (req, res) => valeController.reanudar(req, res));
router.post('/:id/revisar', revisarVale, (req, res) => valeController.revisar(req, res));
router.post('/:id/aprobar-general', aprobacionGeneralVale, campoFusion, (req, res) => valeController.aprobarGeneral(req, res));
router.post('/:id/confirmar', confirmarVale, (req, res) => valeController.confirmar(req, res));
router.post('/:id/solicitar-modificacion', solicitarModificacionVale, (req, res) => valeController.solicitarModificacion(req, res));
router.post('/:id/aprobar-modificacion', aprobarModificacionVale, (req, res) => valeController.aprobarModificacion(req, res));
router.post('/:id/rechazar-modificacion', aprobarModificacionVale, (req, res) => valeController.rechazarModificacion(req, res));
router.post('/:id/autorizar-creacion', autorizarCreacionVale, (req, res) => valeController.autorizarCreacion(req, res));
router.post('/:id/rechazar-creacion', autorizarCreacionVale, (req, res) => valeController.rechazarCreacion(req, res));

module.exports = router;
