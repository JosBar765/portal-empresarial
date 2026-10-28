// Estado global del módulo de vales — un solo objeto mutable compartido por
// todas las vistas/acciones (no hay accessors: se lee y escribe directo).
import { isoLocal } from './utils/fechas.js';

export const state = {
  user: null,
  catalogos: null,
  vales: [],
  contadores: {},
  vista: 'buzon', // solo aplica a roles con sidebar
  // Período de Buzón y Trabajo realizado (misma forma que el de Reportes); arranca en el mes de hoy.
  ventana: { tipo: 'mes', fecha: isoLocal(new Date()), desde: '', hasta: '' },
  tiendaId: null, // Vista Gerencia: filtro de tienda
  filtroContador: null,
  soloAtrasados: false, // combinable con filtroContador
  soloRechazos: false, // ídem: vales con rechazo de propuesta (Encargado y Asistente, en el Buzón)
  soloModificados: false, // ídem: vales MOD- y sus originales
  disenadorFiltro: '', // combobox de diseñadores (solo encargados)
  reporte: { // Reportes: su propio período (arranca en «Hoy»), agrupación, filtros y filas desplegadas
    ventana: { tipo: 'hoy', fecha: isoLocal(new Date()), desde: '', hasta: '' },
    agruparPor: '', tiendaId: '', tallerId: '', asesorIds: [], disenadorIds: [], expandidos: new Set()
  },
  busqueda: '',
  mensajeVacio: '', // texto de la lista vacía que manda el servidor (p. ej. encargado sin taller)
  sort: { key: null, dir: null }, // ídem el orden por columna
  socket: null,
  cargaTrabajoModal: null,
  adjuntosModalAbierto: null, // modal de adjuntos pendientes del asesor (overlay, valeId, cerrar): se cierra si el estado cambia
  conversacionAbierta: null, // conversación del rechazo abierta (overlay, valeId, refrescar) para actualizarla en vivo
  historialModal: null,
  accionesEnCurso: new Set(),
  // `cursor` es el id del último vale ya cargado (no una posición numérica),
  // para que el scroll infinito no se desalinee si el conjunto ordenado
  // cambia entre requests.
  paginacion: { limit: 50, cursor: null, total: 0, hasMore: false, cargandoMas: false }
};
