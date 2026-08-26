// src/modules/vales/routes.js
const express = require('express');
const multer = require('multer');
const router = express.Router();
const valeController = require('./controllers/valeController');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');

// Buffer en memoria: fileStorage.saveFile() escribe a disco desde el buffer;
// el binario nunca se guarda en la base de datos, solo la ruta resultante.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }
});

const camposAdjuntos = upload.fields([
  { name: 'imagenes', maxCount: 10 },
  { name: 'documentos', maxCount: 5 }
]);
const campoPropuesta = upload.fields([{ name: 'propuesta', maxCount: 1 }]);
// El Encargado General adjunta manualmente su propio documento de fusión al aprobar
// (analisis_correcciones_4.md #11: la fusión no la hace el sistema).
const campoFusion = upload.fields([{ name: 'fusion', maxCount: 1 }]);

router.get('/catalogos', requirePermission('vales.ver'), (req, res) => valeController.catalogos(req, res));
router.get('/talleres', requirePermission('vales.ver'), (req, res) => valeController.talleres(req, res));
// analisis_correcciones_10.md #11: el límite diario dejó de ser individual del
// asesor (/limite-restante) y pasa a ser colectivo del Supervisor.
router.get('/limite-colectivo', requirePermission('vales.autorizar_creacion'), (req, res) => valeController.limiteColectivo(req, res));
router.get('/tecnicos', requirePermission('vales.asignar'), (req, res) => valeController.tecnicos(req, res));
router.get('/carga-trabajo', requirePermission('vales.asignar'), (req, res) => valeController.cargaTrabajo(req, res));
router.get('/carga-trabajo/:tecnicoId', requirePermission('vales.asignar'), (req, res) => valeController.cargaTrabajoTecnico(req, res));

router.get('/', requirePermission('vales.ver'), (req, res) => valeController.buzon(req, res));
// Vista Gerencia (analisis_correcciones_7.md): panel de métricas de solo lectura.
router.get('/dashboard-gerencia', requirePermission('vales.ver_gerencia'), (req, res) => valeController.dashboardGerencia(req, res));
router.post('/', requirePermission('vales.crear'), camposAdjuntos, (req, res) => valeController.crear(req, res));

router.get('/:id', requirePermission('vales.ver'), (req, res) => valeController.detalle(req, res));
router.get('/:id/pdf', requirePermission('vales.ver'), (req, res) => valeController.descargarPdf(req, res));

router.post('/:id/asignar', requirePermission('vales.asignar'), (req, res) => valeController.asignar(req, res));
router.post('/:id/comenzar', requirePermission('vales.trabajar'), (req, res) => valeController.comenzar(req, res));
router.post('/:id/entregar', requirePermission('vales.trabajar'), campoPropuesta, (req, res) => valeController.entregar(req, res));
router.post('/:id/cancelar-proceso', requirePermission('vales.trabajar'), (req, res) => valeController.cancelarProceso(req, res));
router.post('/:id/revisar', requirePermission('vales.revisar'), (req, res) => valeController.revisar(req, res));
router.post('/:id/aprobar-general', requirePermission('vales.aprobar_general'), campoFusion, (req, res) => valeController.aprobarGeneral(req, res));
router.post('/:id/confirmar', requirePermission('vales.confirmar'), (req, res) => valeController.confirmar(req, res));
// El formulario de modificación es el mismo de creación (todos los campos editables,
// boceto/descripción en blanco) — ya no admite adjuntar archivos nuevos, el
// documento de referencia es automáticamente la última propuesta del vale original.
// Ya no existe una acción de "rechazar"/"solicitar corrección" separada
// (analisis_correcciones_5.md #5) — un vale PENDIENTE_CONFIRMACION que el asesor no
// acepta usa esta misma ruta de solicitar modificación.
router.post('/:id/solicitar-modificacion', requirePermission('vales.solicitar_modificacion'), (req, res) => valeController.solicitarModificacion(req, res));
router.post('/:id/aprobar-modificacion', requirePermission('vales.aprobar_modificacion'), (req, res) => valeController.aprobarModificacion(req, res));
// analisis_correcciones_10.md #5: Supervisor autoriza el envío a talleres de un
// vale recién creado (nace ESPERANDO_AUTORIZACION, sin filas en vale_talleres).
router.post('/:id/autorizar-creacion', requirePermission('vales.autorizar_creacion'), (req, res) => valeController.autorizarCreacion(req, res));
// Encargado General: elige a qué taller reenviar un vale MODIFICADO recién aprobado
// (analisis_correcciones_5.md #6). Mismo permiso que ya tiene el rol 8/9 para fusionar.
router.post('/:id/reenviar-modificacion', requirePermission('vales.aprobar_general'), (req, res) => valeController.reenviarModificacion(req, res));

module.exports = router;
