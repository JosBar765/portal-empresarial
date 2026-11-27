// src/modules/vales/routes.js
const express = require('express');
const multer = require('multer');
const router = express.Router();
const valeController = require('./controllers/valeController');
const borradorController = require('./controllers/borradorController');
const ventaController = require('./controllers/ventaController');
const { rateLimit } = require('express-rate-limit');
const { nuevaReferencia, lineaLog, exigirPermisoReporte } = require('./utils/reporteErrores');
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
const autorizarCreacionVale = requirePermission('vales.supervisar');
const crearVale = requirePermission('vales.crear');
const asignarVale = requirePermission('vales.gestionar_taller');
const verReporteActividadTienda = exigirPermisoReporte('vales.reporte_actividad_tienda', 'actividad-tienda', requirePermission('vales.reporte_actividad_tienda'));
const verReporteActividadTaller = exigirPermisoReporte('vales.reporte_actividad_taller', 'actividad-taller', requirePermission('vales.reporte_actividad_taller'));
const verReporteActividadDisenador = exigirPermisoReporte('vales.reporte_actividad_disenador', 'actividad-disenador', requirePermission('vales.reporte_actividad_disenador'));
const verReporteActividadAsesor = exigirPermisoReporte('vales.reporte_actividad_asesor', 'actividad-asesor', requirePermission('vales.reporte_actividad_asesor'));
const trabajarVale = requirePermission('vales.trabajar');
const revisarVale = requirePermission('vales.gestionar_taller');
const aprobacionGeneralVale = requirePermission('vales.aprobar_general');
const confirmarVale = requirePermission('vales.crear');
const darDeBajaVale = requirePermission('vales.dar_de_baja');
const verificarAdjuntosVale = requirePermission('vales.gestionar_taller');
const corregirVale = requirePermission('vales.crear');
const escribirConversacion = (req, res, next) => {
  const permisos = req.user.permissions || [];
  return permisos.includes('vales.gestionar_taller') || permisos.includes('vales.crear')
    ? next()
    : res.status(403).json({ error: 'No tienes permiso para escribir en esta conversación.' });
};
const solicitarModificacionVale = requirePermission('vales.crear');
const rechazarPropuesta = requirePermission('vales.crear');
const responderRechazoPropuesta = requirePermission('vales.gestionar_taller');
// La conversación del rechazo de propuesta la escribe el asesor dueño (vales.crear) o el taller (vales.gestionar_taller).
const escribirRechazoPropuesta = (req, res, next) => {
  const permisos = req.user.permissions || [];
  return permisos.includes('vales.gestionar_taller') || permisos.includes('vales.crear')
    ? next()
    : res.status(403).json({ error: 'No tienes permiso para escribir en esta conversación.' });
};
const aprobarModificacionVale = requirePermission('vales.supervisar');
const decidirVenta = requirePermission('vales.supervisar');
// Un reporte recorre el historial del período: se acota por usuario (ya autenticado).
const limitarReportes = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `reportes:${req.user.id}`,
  handler: (req, res) => {
    const referencia = nuevaReferencia();
    const reporte = req.path.replace(/^\/reportes\//, '').replace(/\/pdf$/, '') || '-';
    const etapa = 'limite';
    const mensaje = 'Demasiados reportes seguidos. Espera un momento e inténtalo de nuevo.';
    console.warn(lineaLog({ referencia, reporte, etapa, req, estado: 429, codigo: 'REPORTE_LIMITE', mensaje }));
    // resetTime es una fecha; el cliente solo necesita los segundos de espera.
    const reset = req.rateLimit && req.rateLimit.resetTime;
    const reintentarEnSegundos = reset ? Math.max(1, Math.ceil((new Date(reset).getTime() - Date.now()) / 1000)) : 60;
    res.status(429).json({ error: mensaje, codigo: 'REPORTE_LIMITE', referencia, etapa, reintentarEnSegundos });
  }
});

// Las opciones de los filtros no recorren vales: tope más holgado, con su propio contador.
const limitarOpciones = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `reportes-opciones:${req.user.id}`,
  handler: (req, res) => {
    const referencia = nuevaReferencia();
    const reporte = req.path.replace(/^\/reportes\//, '').replace(/\/opciones$/, '') || '-';
    const etapa = 'limite';
    const mensaje = 'Demasiadas consultas seguidas. Espera un momento e inténtalo de nuevo.';
    console.warn(lineaLog({ referencia, reporte, etapa, req, estado: 429, codigo: 'REPORTE_LIMITE', mensaje }));
    const reset = req.rateLimit && req.rateLimit.resetTime;
    const reintentarEnSegundos = reset ? Math.max(1, Math.ceil((new Date(reset).getTime() - Date.now()) / 1000)) : 60;
    res.status(429).json({ error: mensaje, codigo: 'REPORTE_LIMITE', referencia, etapa, reintentarEnSegundos });
  }
});

router.get('/catalogos', verVales, (req, res) => valeController.catalogos(req, res));
// Tiendas que la campana de Vales muestra a un supervisor (la misma selección del Buzón).
router.get('/filtro-avisos', verVales, (req, res) => valeController.filtroAvisos(req, res));
router.put('/filtro-avisos', verVales, (req, res) => valeController.guardarFiltroAvisos(req, res));
router.get('/talleres', verVales, (req, res) => valeController.talleres(req, res));
router.get('/capacidad-entrega', crearVale, (req, res) => valeController.capacidadEntrega(req, res));
router.get('/fechas-entrega', crearVale, (req, res) => valeController.fechasEntrega(req, res));
router.get('/calendario-buzon', verVales, (req, res) => valeController.calendarioBuzon(req, res));
router.get('/disenadores', asignarVale, (req, res) => valeController.disenadores(req, res));
router.get('/carga-trabajo', asignarVale, (req, res) => valeController.cargaTrabajo(req, res));
router.get('/carga-trabajo/:disenadorId', asignarVale, (req, res) => valeController.cargaTrabajoDisenador(req, res));

router.get('/', verVales, (req, res) => valeController.buzon(req, res));
router.get('/reportes/actividad-tienda/opciones', verReporteActividadTienda, limitarOpciones, (req, res) => valeController.opcionesActividadTienda(req, res));
router.get('/reportes/actividad-taller/opciones', verReporteActividadTaller, limitarOpciones, (req, res) => valeController.opcionesActividadEquipo(req, res, 'taller'));
router.get('/reportes/actividad-disenador/opciones', verReporteActividadDisenador, limitarOpciones, (req, res) => valeController.opcionesActividadEquipo(req, res, 'disenador'));
router.get('/reportes/actividad-asesor/opciones', verReporteActividadAsesor, limitarOpciones, (req, res) => valeController.opcionesActividadEquipo(req, res, 'asesor'));
router.get('/reportes/actividad-tienda', verReporteActividadTienda, limitarReportes, (req, res) => valeController.reporteActividadTienda(req, res));
router.get('/reportes/actividad-tienda/pdf', verReporteActividadTienda, limitarReportes, (req, res) => valeController.reporteActividadTiendaPdf(req, res));
router.get('/reportes/actividad-taller', verReporteActividadTaller, limitarReportes, (req, res) => valeController.reporteActividadEquipo(req, res, 'taller'));
router.get('/reportes/actividad-taller/pdf', verReporteActividadTaller, limitarReportes, (req, res) => valeController.reporteActividadEquipoPdf(req, res, 'taller'));
router.get('/reportes/actividad-disenador', verReporteActividadDisenador, limitarReportes, (req, res) => valeController.reporteActividadEquipo(req, res, 'disenador'));
router.get('/reportes/actividad-disenador/pdf', verReporteActividadDisenador, limitarReportes, (req, res) => valeController.reporteActividadEquipoPdf(req, res, 'disenador'));
router.get('/reportes/actividad-asesor', verReporteActividadAsesor, limitarReportes, (req, res) => valeController.reporteActividadEquipo(req, res, 'asesor'));
router.get('/reportes/actividad-asesor/pdf', verReporteActividadAsesor, limitarReportes, (req, res) => valeController.reporteActividadEquipoPdf(req, res, 'asesor'));
router.post('/', crearVale, camposAdjuntos, (req, res) => valeController.crear(req, res));

// Borradores: privados de su dueño; van antes de /:id para que "borradores" no se lea como un id.
router.get('/borradores', crearVale, (req, res) => borradorController.listar(req, res));
router.post('/borradores/vistos', crearVale, (req, res) => borradorController.marcarVistos(req, res));
router.get('/borradores/:id', crearVale, (req, res) => borradorController.obtener(req, res));
router.post('/borradores', crearVale, camposAdjuntos, (req, res) => borradorController.crear(req, res));
router.put('/borradores/:id', crearVale, camposAdjuntos, (req, res) => borradorController.actualizar(req, res));
router.delete('/borradores/:id', crearVale, (req, res) => borradorController.eliminar(req, res));

router.get('/:id', verVales, (req, res) => valeController.detalle(req, res));
router.get('/:id/ubicacion', verVales, (req, res) => valeController.ubicacion(req, res));
router.get('/:id/pdf', verVales, (req, res) => valeController.descargarPdf(req, res));
router.get('/:id/propuesta', verVales, (req, res) => valeController.propuesta(req, res));
router.post('/:id/propuestas-otros/:tallerId/visto', verVales, (req, res) => valeController.propuestaOtroTallerVista(req, res));

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
router.get('/:id/rechazos-propuesta', verVales, (req, res) => valeController.listarRechazosPropuesta(req, res));
router.post('/:id/rechazos-propuesta', rechazarPropuesta, (req, res) => valeController.solicitarRechazoPropuesta(req, res));
router.get('/:id/rechazos-propuesta/:rechazoId/mensajes', verVales, (req, res) => valeController.conversacionRechazoPropuesta(req, res));
router.post('/:id/rechazos-propuesta/:rechazoId/mensajes', escribirRechazoPropuesta, (req, res) => valeController.enviarMensajeRechazoPropuesta(req, res));
router.post('/:id/rechazos-propuesta/:rechazoId/aceptar', responderRechazoPropuesta, (req, res) => valeController.aceptarRechazoPropuesta(req, res));
router.post('/:id/rechazos-propuesta/:rechazoId/rechazar', responderRechazoPropuesta, (req, res) => valeController.rechazarRechazoPropuesta(req, res));
router.post('/:id/rechazos-propuesta/:rechazoId/cancelar', rechazarPropuesta, (req, res) => valeController.cancelarRechazoPropuesta(req, res));
router.post('/:id/aprobar-modificacion', aprobarModificacionVale, (req, res) => valeController.aprobarModificacion(req, res));
router.post('/:id/rechazar-modificacion', aprobarModificacionVale, (req, res) => valeController.rechazarModificacion(req, res));
router.post('/:id/autorizar-creacion', autorizarCreacionVale, (req, res) => valeController.autorizarCreacion(req, res));
router.post('/:id/rechazar-creacion', autorizarCreacionVale, (req, res) => valeController.rechazarCreacion(req, res));
router.post('/:id/verificar-adjuntos', verificarAdjuntosVale, (req, res) => valeController.verificarAdjuntos(req, res));
router.post('/:id/rechazar-adjuntos', verificarAdjuntosVale, (req, res) => valeController.rechazarAdjuntos(req, res));
router.post('/:id/responder-adjuntos', corregirVale, (req, res) => valeController.responderAdjuntos(req, res));
// Conversación del rechazo: la leen quienes ven el vale y escribe el taller (vales.gestionar_taller) o el asesor (vales.crear).
router.get('/:id/mensajes', verVales, (req, res) => valeController.conversacion(req, res));
router.post('/:id/mensajes', escribirConversacion, (req, res) => valeController.enviarMensaje(req, res));
router.post('/:id/reenviar', corregirVale, (req, res) => valeController.reenviar(req, res));
router.post('/:id/visto', requirePermission('vales.supervisar'), (req, res) => valeController.marcarVisto(req, res));
router.post('/:id/dar-de-baja', darDeBajaVale, (req, res) => valeController.darDeBaja(req, res));
router.post('/:id/talleres/:tallerId/baja', darDeBajaVale, (req, res) => valeController.darDeBajaTaller(req, res));
router.post('/:id/corregir', corregirVale, camposAdjuntos, (req, res) => valeController.corregir(req, res));
// Venta por orden de venta: la gestiona el dueño y la decide el supervisor del asesor.
router.post('/:id/venta', crearVale, (req, res) => ventaController.registrar(req, res));
router.put('/:id/venta', crearVale, (req, res) => ventaController.corregir(req, res));
router.delete('/:id/venta', crearVale, (req, res) => ventaController.borrar(req, res));
router.post('/:id/venta/confirmar', decidirVenta, (req, res) => ventaController.confirmar(req, res));
router.post('/:id/venta/rechazar', decidirVenta, (req, res) => ventaController.rechazar(req, res));

module.exports = router;
