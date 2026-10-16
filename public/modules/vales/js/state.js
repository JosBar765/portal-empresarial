// Estado global del módulo de vales — un solo objeto mutable compartido por
// todas las vistas/acciones (no hay accessors: se lee y escribe directo).
import { isoLocal, primerDiaDelMes } from './utils/fechas.js';

export const state = {
  user: null,
  catalogos: null,
  vales: [],
  contadores: {},
  secciones: null, // Buzón con atrasados anteriores al período: { anteriores, periodo } (cantidad de vales de cada sección)
  vista: 'buzon', // solo aplica a roles con sidebar
  // Arranca en "Todo"; `fecha` es el primer día del mes que se elige al pulsar el selector de mes.
  ventana: { tipo: 'todo', fecha: isoLocal(primerDiaDelMes(new Date())), desde: null, hasta: null },
  tiendaId: null, // Vista Gerencia: filtro de tienda
  filtroContador: null,
  soloAtrasados: false, // combinable con filtroContador
  soloModificados: false, // ídem: vales MOD- y sus originales
  disenadorFiltro: '', // combobox de diseñadores (solo encargados)
  reporte: { // Reportes: su propio período (arranca en «Hoy»), agrupación, filtros y filas desplegadas
    ventana: { tipo: 'hoy', fecha: isoLocal(new Date()), desde: '', hasta: '' },
    agruparPor: '', tiendaId: '', tallerId: '', asesorIds: [], disenadorIds: [], expandidos: new Set()
  },
  busqueda: '',
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
