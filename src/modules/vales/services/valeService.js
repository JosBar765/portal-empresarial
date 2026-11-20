// src/modules/vales/services/valeService.js
// Fachada: reexpone exactamente la misma API pública que antes tenía este
// archivo como una única clase de 2264 líneas, ahora repartida en varios
// servicios más pequeños bajo services/vale*Service.js (ver
// .agents/modulos/vales de arte/documentacion/correcciones_22_2.md para el
// mapa completo). valeController.js y atrasoWatcher.js no cambian ni una
// línea: siguen viendo el mismo objeto con los mismos 22 métodos y los
// mismos dos exports estáticos (ESTADOS/ESTADOS_TALLER).
const { ESTADOS, ESTADOS_TALLER } = require('./valeHelpers');
const valeCatalogoService = require('./valeCatalogoService');
const valeCreacionService = require('./valeCreacionService');
const valeDetalleService = require('./valeDetalleService');
const valeBuzonService = require('./valeBuzonService');
const valeTallerService = require('./valeTallerService');
const valeConfirmacionService = require('./valeConfirmacionService');
const capacidadEntregaService = require('./capacidadEntregaService');
const fechasEntregaService = require('./fechasEntregaService');
const valeCorreccionService = require('./valeCorreccionService');
const valeVistoService = require('./valeVistoService');
const propuestasCompartidasService = require('./propuestasCompartidasService');
const valeModificacionService = require('./valeModificacionService');
const valeRechazoPropuestaService = require('./valeRechazoPropuestaService');
const valeReporteTiendaService = require('./valeReporteTiendaService');
const valeReporteEquiposService = require('./valeReporteEquiposService');
const valeAdjuntosService = require('./valeAdjuntosService');

module.exports = {
  // Reportes de actividad
  // Reporte de actividad de tienda (Reportes 2)
  obtenerReporteActividadTienda: (...a) => valeReporteTiendaService.obtenerReporte(...a),
  generarReporteActividadTiendaPdf: (...a) => valeReporteTiendaService.generarPdf(...a),
  // Reportes de actividad de talleres, diseñadores y asesores (Reportes 2): el primer argumento es el tipo (taller, disenador, asesor).
  obtenerReporteActividadEquipo: (...a) => valeReporteEquiposService.obtenerReporte(...a),
  generarReporteActividadEquipoPdf: (...a) => valeReporteEquiposService.generarPdf(...a),
  // Opciones de los filtros de cada reporte, sin recorrer vales.
  obtenerOpcionesActividadTienda: (...a) => valeReporteTiendaService.obtenerOpciones(...a),
  obtenerOpcionesActividadEquipo: (...a) => valeReporteEquiposService.obtenerOpciones(...a),

  // Catálogo
  obtenerCatalogos: (...a) => valeCatalogoService.obtenerCatalogos(...a),
  obtenerTalleres: (...a) => valeCatalogoService.obtenerTalleres(...a),
  obtenerCapacidadEntrega: (...a) => capacidadEntregaService.obtenerCapacidadMes(...a),
  obtenerFechasEntrega: (...a) => fechasEntregaService.obtenerFechasEntrega(...a),
  obtenerCalendarioBuzon: (...a) => capacidadEntregaService.obtenerCalendarioBuzon(...a),

  // Creación
  crearVale: (...a) => valeCreacionService.crearVale(...a),
  autorizarCreacion: (...a) => valeCreacionService.autorizarCreacion(...a),
  rechazarCreacion: (...a) => valeCreacionService.rechazarCreacion(...a),
  darDeBaja: (...a) => valeCreacionService.darDeBaja(...a),
  reenviarAutorizacion: (...a) => valeCreacionService.reenviarAutorizacion(...a),
  corregirVale: (...a) => valeCorreccionService.corregirVale(...a),
  marcarVisto: (...a) => valeVistoService.marcarVisto(...a),

  // Detalle
  obtenerDetalle: (...a) => valeDetalleService.obtenerDetalle(...a),
  obtenerPropuesta: (...a) => valeDetalleService.obtenerPropuesta(...a),
  marcarPropuestaOtroTallerVista: (...a) => propuestasCompartidasService.marcarVisto(...a),

  // Buzón / listado por rol
  obtenerBuzon: (...a) => valeBuzonService.obtenerBuzon(...a),
  obtenerDisenadoresAsignables: (...a) => valeBuzonService.obtenerDisenadoresAsignables(...a),
  obtenerCargaTrabajo: (...a) => valeBuzonService.obtenerCargaTrabajo(...a),
  obtenerAsignacionesDeDisenador: (...a) => valeBuzonService.obtenerAsignacionesDeDisenador(...a),

  // Transiciones de taller
  asignar: (...a) => valeTallerService.asignar(...a),
  comenzar: (...a) => valeTallerService.comenzar(...a),
  entregar: (...a) => valeTallerService.entregar(...a),
  pausarProceso: (...a) => valeTallerService.pausarProceso(...a),
  reanudarProceso: (...a) => valeTallerService.reanudarProceso(...a),
  cancelarProcesoDisenador: (...a) => valeTallerService.cancelarProcesoDisenador(...a),
  revisarPropuesta: (...a) => valeTallerService.revisarPropuesta(...a),
  aprobarGeneral: (...a) => valeTallerService.aprobarGeneral(...a),

  // Verificación de adjuntos
  verificarAdjuntos: (...a) => valeAdjuntosService.verificarAdjuntos(...a),
  rechazarAdjuntos: (...a) => valeAdjuntosService.rechazarAdjuntos(...a),
  responderAdjuntos: (...a) => valeAdjuntosService.responderAdjuntos(...a),
  darDeBajaTaller: (...a) => valeAdjuntosService.darDeBajaTaller(...a),
  listarConversacion: (...a) => valeAdjuntosService.listarConversacion(...a),
  enviarMensaje: (...a) => valeAdjuntosService.enviarMensaje(...a),

  // Asesor / Modificación
  confirmarRecibido: (...a) => valeConfirmacionService.confirmarRecibido(...a),
  solicitarModificacion: (...a) => valeModificacionService.solicitarModificacion(...a),
  aprobarModificacion: (...a) => valeModificacionService.aprobarModificacion(...a),
  // Rechazo de propuesta: el asesor dueño lo pide y conversa con cada taller, que acepta o rechaza
  solicitarRechazoPropuesta: (...a) => valeRechazoPropuestaService.solicitar(...a),
  listarRechazosPropuesta: (...a) => valeRechazoPropuestaService.listar(...a),
  conversacionRechazoPropuesta: (...a) => valeRechazoPropuestaService.listarConversacion(...a),
  enviarMensajeRechazoPropuesta: (...a) => valeRechazoPropuestaService.enviarMensaje(...a),
  aceptarRechazoPropuesta: (...a) => valeRechazoPropuestaService.aceptar(...a),
  rechazarRechazoPropuesta: (...a) => valeRechazoPropuestaService.rechazar(...a),
  cancelarRechazoPropuesta: (...a) => valeRechazoPropuestaService.cancelar(...a),
  rechazarModificacion: (...a) => valeModificacionService.rechazarModificacion(...a),
  obtenerValeParaPdf: (...a) => valeConfirmacionService.obtenerValeParaPdf(...a),

  ESTADOS,
  ESTADOS_TALLER
};
