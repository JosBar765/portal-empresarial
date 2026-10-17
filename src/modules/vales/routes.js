// src/modules/vales/routes.js
const express = require('express');
const multer = require('multer');
const router = express.Router();
const valeController = require('./controllers/valeController');
const { rateLimit } = require('express-rate-limit');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');

const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  // Un tipo no permitido se rechaza con error (antes se descartaba en silencio y el vale se creaba sin ese archivo).
  fileFilter: (req, file, cb) => {
    if (TIPOS_PERMITIDOS.has(file.mimetype)) return cb(null, true);
    const error = new multer.MulterError('TIPO_NO_PERMITIDO', file.fieldname);
    error.archivo = String(file.originalname || '').replace(/[<>"'&]/g, '').slice(0, 80);
    return cb(error);
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
const verReportes = requirePermission('vales.ver_reportes');
const trabajarVale = requirePermission('vales.trabajar');
const revisarVale = requirePermission('vales.revisar');
const aprobacionGeneralVale = requirePermission('vales.aprobar_general');
const confirmarVale = requirePermission('vales.confirmar');
const darDeBajaVale = requirePermission('vales.dar_de_baja');
const verificarAdjuntosVale = requirePermission('vales.verificar_adjuntos');
const corregirVale =requirePermission('vales.corregir');
const escribirConversacion = (req, res, next) => {
  const permisos = req.user.permissions || [];
  return permisos.includes('vales.verificar_adjuntos') || permisos.includes('vales.corregir')
    ? next()
    : res.status(403).json({ error: 'No tienes permiso para escribir en esta conversación.' });
};
const solicitarModificacionVale = requirePermission('vales.solicitar_modificacion');
const responderModificacionBasica = requirePermission('vales.responder_modificacion_basica');
// La conversación de una modificación básica la escribe el asesor (vales.solicitar_modificacion) o el taller (vales.responder_modificacion_basica).
const escribirModificacionBasica = (req, res, next) => {
  const permisos = req.user.permissions || [];
  return permisos.includes('vales.responder_modificacion_basica') || permisos.includes('vales.solicitar_modificacion')
    ? next()
    : res.status(403).json({ error: 'No tienes permiso para escribir en esta conversación.' });
};
const aprobarModificacionVale = requirePermission('vales.aprobar_modificacion');
// Un reporte recorre el historial del período: se acota por usuario (ya autenticado).
const limitarReportes = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `reportes:${req.user.id}`,
  handler: (req, res) => {
    res.status(429).json({ error: 'Demasiados reportes seguidos. Espera un momento e inténtalo de nuevo.' });
  }
});

router.get('/catalogos', verVales, (req, res) => valeController.catalogos(req, res));
router.get('/talleres', verVales, (req, res) => valeController.talleres(req, res));
router.get('/capacidad-entrega', crearVale, (req, res) => valeController.capacidadEntrega(req, res));
router.get('/fechas-entrega', crearVale, (req, res) => valeController.fechasEntrega(req, res));
router.get('/calendario-buzon', verVales, (req, res) => valeController.calendarioBuzon(req, res));
router.get('/disenadores', asignarVale, (req, res) => valeController.disenadores(req, res));
router.get('/carga-trabajo', asignarVale, (req, res) => valeController.cargaTrabajo(req, res));
router.get('/carga-trabajo/:disenadorId', asignarVale, (req, res) => valeController.cargaTrabajoDisenador(req, res));

router.get('/', verVales, (req, res) => valeController.buzon(req, res));
router.get('/reportes', verReportes, limitarReportes, (req, res) => valeController.reportes(req, res));
router.get('/reportes/pdf', verReportes, limitarReportes, (req, res) => valeController.reportePdf(req, res));
router.post('/', crearVale, camposAdjuntos, (req, res) => valeController.crear(req, res));

router.get('/:id', verVales, (req, res) => valeController.detalle(req, res));
router.get('/:id/pdf', verVales, (req, res) => valeController.descargarPdf(req, res));
router.get('/:id/propuesta', verVales, (req, res) => valeController.propuesta(req, res));

router.post('/:id/asignar', asignarVale, (req, res) => valeController.asignar(req, res));
router.post('/:id/comenzar', trabajarVale, (req, res) => valeController.comenzar(req, res));
router.post('/:id/entregar', trabajarVale, campoPropuesta, (req, res) => valeController.entregar(req, res));
router.post('/:id/cancelar-proceso', trabajarVale, (req, res) => valeController.cancelarProceso(req, res));
router.post('/:id/pausar', trabajarVale, (req, res) => valeController.pausar(req, res));
router.post('/:id/reanudar', trabajarVale, (req, res) => valeController.reanudar(req, res));
router.post('/:id/revisar', revisarVale, (req, res) => valeController.revisar(req, res));
router.post('/:id/aprobar-general', aprobacionGeneralVale, campoFusion, (req, res) => valeController.aprobarGeneral(req, res));
router.post('/:id/confirmar', confirmarVale, (req, res) => valeController.confirmar(req, res));
router.post('/:id/solicitar-modificacion', solicitarModificacionVale, camposAdjuntos, (req, res) => valeController.solicitarModificacion(req, res));
router.get('/:id/modificaciones-basicas', verVales, (req, res) => valeController.listarModificacionesBasicas(req, res));
router.post('/:id/modificaciones-basicas', solicitarModificacionVale, (req, res) => valeController.solicitarModificacionBasica(req, res));
router.get('/:id/modificaciones-basicas/:modId/mensajes', verVales, (req, res) => valeController.conversacionModificacionBasica(req, res));
router.post('/:id/modificaciones-basicas/:modId/mensajes', escribirModificacionBasica, (req, res) => valeController.enviarMensajeModificacionBasica(req, res));
router.post('/:id/modificaciones-basicas/:modId/aceptar', responderModificacionBasica, (req, res) => valeController.aceptarModificacionBasica(req, res));
router.post('/:id/modificaciones-basicas/:modId/rechazar', responderModificacionBasica, (req, res) => valeController.rechazarModificacionBasica(req, res));
router.post('/:id/modificaciones-basicas/:modId/cancelar', solicitarModificacionVale, (req, res) => valeController.cancelarModificacionBasica(req, res));
router.post('/:id/aprobar-modificacion', aprobarModificacionVale, (req, res) => valeController.aprobarModificacion(req, res));
router.post('/:id/rechazar-modificacion', aprobarModificacionVale, (req, res) => valeController.rechazarModificacion(req, res));
router.post('/:id/autorizar-creacion', autorizarCreacionVale, (req, res) => valeController.autorizarCreacion(req, res));
router.post('/:id/rechazar-creacion', autorizarCreacionVale, (req, res) => valeController.rechazarCreacion(req, res));
router.post('/:id/verificar-adjuntos', verificarAdjuntosVale, (req, res) => valeController.verificarAdjuntos(req, res));
router.post('/:id/rechazar-adjuntos', verificarAdjuntosVale, (req, res) => valeController.rechazarAdjuntos(req, res));
router.post('/:id/responder-adjuntos', corregirVale, (req, res) => valeController.responderAdjuntos(req, res));
// Conversación del rechazo: la leen quienes ven el vale y escribe el taller (vales.verificar_adjuntos) o el asesor (vales.corregir).
router.get('/:id/mensajes', verVales, (req, res) => valeController.conversacion(req, res));
router.post('/:id/mensajes', escribirConversacion, (req, res) => valeController.enviarMensaje(req, res));
router.post('/:id/reenviar', corregirVale, (req, res) => valeController.reenviar(req, res));
router.post('/:id/visto', requirePermission('vales.supervisar'), (req, res) => valeController.marcarVisto(req, res));
router.post('/:id/dar-de-baja', darDeBajaVale, (req, res) => valeController.darDeBaja(req, res));
router.post('/:id/corregir', corregirVale, camposAdjuntos, (req, res) => valeController.corregir(req, res));

module.exports = router;
