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
const valeRendimientoService = require('./valeRendimientoService');
const valeBusquedaService = require('./valeBusquedaService');
const capacidadEntregaService = require('./capacidadEntregaService');
const fechasEntregaService = require('./fechasEntregaService');
const valeCorreccionService = require('./valeCorreccionService');
const valeVistoService = require('./valeVistoService');
const valeModificacionService = require('./valeModificacionService');
const valeReporteService = require('./valeReporteService');
const valeReportePdfService = require('./valeReportePdfService');
const valeAdjuntosService = require('./valeAdjuntosService');

module.exports = {
  // Reportes de actividad
  obtenerReporte: (...a) => valeReporteService.obtenerReporte(...a),
  generarReportePdf: async (usuario, filtros) => {
    const reporte = await valeReporteService.obtenerReporte(usuario, filtros, { maxFilas: valeReporteService.MAX_FILAS_PDF });
    const ahora = new Date(Date.now() - 6 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16);
    const [f, h] = ahora.split(' ');
    const [y, m, d] = f.split('-');
    return { reporte, pdf: await valeReportePdfService.generar(reporte, { generadoPor: usuario.nombre, ahora: `${d}/${m}/${y} ${h}` }) };
  },

  // Catálogo
  obtenerCatalogos: (...a) => valeCatalogoService.obtenerCatalogos(...a),
  obtenerTalleres: (...a) => valeCatalogoService.obtenerTalleres(...a),
  obtenerCapacidadEntrega: (...a) => capacidadEntregaService.obtenerCapacidadMes(...a),
  obtenerFechasEntrega: (...a) => fechasEntregaService.obtenerFechasEntrega(...a),

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

  // Buzón / listado por rol + Vista Gerencia
  obtenerBuzon: (...a) => valeBuzonService.obtenerBuzon(...a),
  obtenerRendimientoGerencia: (...a) => valeRendimientoService.obtenerRendimiento(...a),
  buscarValePorCorrelativo: (...a) => valeBusquedaService.buscarPorCorrelativo(...a),
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
  listarConversacion: (...a) => valeAdjuntosService.listarConversacion(...a),
  enviarMensaje: (...a) => valeAdjuntosService.enviarMensaje(...a),

  // Asesor / Modificación
  confirmarRecibido: (...a) => valeConfirmacionService.confirmarRecibido(...a),
  solicitarModificacion: (...a) => valeModificacionService.solicitarModificacion(...a),
  aprobarModificacion: (...a) => valeModificacionService.aprobarModificacion(...a),
  rechazarModificacion: (...a) => valeModificacionService.rechazarModificacion(...a),
  obtenerValeParaPdf: (...a) => valeConfirmacionService.obtenerValeParaPdf(...a),

  ESTADOS,
  ESTADOS_TALLER
};
