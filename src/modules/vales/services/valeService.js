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

module.exports = {
  // Catálogo
  obtenerCatalogos: (...a) => valeCatalogoService.obtenerCatalogos(...a),
  obtenerTalleres: (...a) => valeCatalogoService.obtenerTalleres(...a),

  // Creación
  crearVale: (...a) => valeCreacionService.crearVale(...a),
  autorizarCreacion: (...a) => valeCreacionService.autorizarCreacion(...a),
  rechazarCreacion: (...a) => valeCreacionService.rechazarCreacion(...a),
  obtenerLimiteColectivoSupervisor: (...a) => valeCreacionService.obtenerLimiteColectivoSupervisor(...a),

  // Detalle
  obtenerDetalle: (...a) => valeDetalleService.obtenerDetalle(...a),

  // Buzón / listado por rol + Vista Gerencia
  obtenerBuzon: (...a) => valeBuzonService.obtenerBuzon(...a),
  obtenerDashboardGerencia: (...a) => valeBuzonService.obtenerDashboardGerencia(...a),
  obtenerTecnicosAsignables: (...a) => valeBuzonService.obtenerTecnicosAsignables(...a),
  obtenerCargaTrabajo: (...a) => valeBuzonService.obtenerCargaTrabajo(...a),
  obtenerAsignacionesDeTecnico: (...a) => valeBuzonService.obtenerAsignacionesDeTecnico(...a),

  // Transiciones de taller
  asignar: (...a) => valeTallerService.asignar(...a),
  comenzar: (...a) => valeTallerService.comenzar(...a),
  entregar: (...a) => valeTallerService.entregar(...a),
  pausarProceso: (...a) => valeTallerService.pausarProceso(...a),
  reanudarProceso: (...a) => valeTallerService.reanudarProceso(...a),
  cancelarProcesoTecnico: (...a) => valeTallerService.cancelarProcesoTecnico(...a),
  revisarPropuesta: (...a) => valeTallerService.revisarPropuesta(...a),
  aprobarGeneral: (...a) => valeTallerService.aprobarGeneral(...a),

  // Asesor / Modificación
  confirmarRecibido: (...a) => valeConfirmacionService.confirmarRecibido(...a),
  solicitarModificacion: (...a) => valeConfirmacionService.solicitarModificacion(...a),
  aprobarModificacion: (...a) => valeConfirmacionService.aprobarModificacion(...a),
  obtenerValeParaPdf: (...a) => valeConfirmacionService.obtenerValeParaPdf(...a),

  ESTADOS,
  ESTADOS_TALLER
};
