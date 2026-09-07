import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { ROL, ROLES_CON_SIDEBAR, ROLES_ENCARGADO_TALLER, ROLES_TALLER_Y_TECNICO } from '../config/roles.js';
import { ESTADOS_LABEL, ESTADOS_VISIBLES_LABEL, CLAVES_ESTADOS_TALLER, CLAVES_ESTADOS_GENERAL, CLAVES_ESTADOS_TECNICO_BUZON, CLAVES_ESTADOS_TECNICO_TRABAJO } from '../config/estados.js';
import { CONTADORES_CONFIG } from '../config/contadores.js';
import { puede, usaEstadosVisibles, esAccionDeTrabajoVisible, claseEstado, etiquetaEstado } from '../permisos.js';
import { formatearFecha, formatearFechaHora, celdaTaller, claveFila, marcadorTipoRegistro } from '../utils/formato.js';
import { obtenerBuzon, obtenerMasVales, obtenerLimiteColectivo } from '../api/valesApi.js';
import { cargarDashboardGerencia } from './dashboardGerencia.js';
import { abrirModalAutorizarCreacion, abrirModalAprobarModificacion, abrirModalVerSupervisor } from '../actions/supervisor.js';
import { abrirModalAsignar, abrirModalRevisar, abrirModalAprobarGeneral } from '../actions/encargado.js';
import { accionComenzar, abrirModalEntregar, accionPausar, accionReanudar, accionCancelarProceso } from '../actions/tecnico.js';
import { abrirModalDecisionAsesor } from '../actions/asesor.js';
import { abrirModalSolicitarModificacion } from '../forms/valeForm.js';
import { abrirModalHistorial } from '../actions/historial.js';

// -----------------------------------------------------------------------
// Carga y render del buzón (paginado: 50 vales por petición, cargados por
// scroll infinito; el orden — jerarquía general e individual — ya viene
// resuelto del backend, la paginación solo recorta esa lista ya ordenada).
// -----------------------------------------------------------------------
export function construirQueryBase() {
  const qs = new URLSearchParams();
  if (state.ventana.tipo) qs.set('ventana', state.ventana.tipo);
  if (state.ventana.tipo === 'rango') {
    if (state.ventana.desde) qs.set('desde', state.ventana.desde);
    if (state.ventana.hasta) qs.set('hasta', state.ventana.hasta);
  }
  if (ROLES_CON_SIDEBAR.includes(state.user.rolId)) qs.set('vista', state.vista);
  if (state.filtroContador) qs.set('filtroContador', state.filtroContador);
  if (state.soloAtrasados) qs.set('soloAtrasados', '1');
  if (state.busqueda) qs.set('busqueda', state.busqueda);
  if (state.tiendaId) qs.set('tiendaId', state.tiendaId);
  if (state.estadoFiltro) qs.set('estado', state.estadoFiltro);
  if (state.sort.key && state.sort.dir) {
    qs.set('sortKey', state.sort.key);
    qs.set('sortDir', state.sort.dir);
  }
  return qs;
}

export async function cargarBuzon() {
  // El Gerente en su vista "Dashboard" no pide el buzón de vales — pide las
  // métricas agregadas.
  if ([ROL.SUPERVISOR, ROL.GERENTE].includes(state.user.rolId) && state.vista === 'dashboard') {
    return cargarDashboardGerencia();
  }
  state.paginacion = { limit: 50, cursor: null, total: 0, hasMore: false, cargandoMas: false };
  const qs = construirQueryBase();

  try {
    const data = await obtenerBuzon(qs);
    state.vales = data.vales || [];
    state.contadores = data.contadores || {};
    state.paginacion.total = data.total ?? state.vales.length;
    state.paginacion.hasMore = !!data.hasMore;
    state.paginacion.cursor = data.nextCursor ?? null;
  } catch (error) {
    $('#buzon-tbody').innerHTML = `
      <tr><td colspan="${columnasVisibles()}" class="tabla-vacia">
        <div class="buzon-vacio buzon-vacio-error">
          <ion-icon name="alert-circle-outline"></ion-icon>
          <h3>No se pudo cargar el buzón</h3>
          <p>${error.message}</p>
        </div>
      </td></tr>`;
    return;
  }

  // El límite diario es un contador colectivo ascendente "autorizados/asesores"
  // del Supervisor.
  if (state.user.rolId === ROL.SUPERVISOR && state.vista !== 'trabajo') {
    try {
      const d = await obtenerLimiteColectivo();
      state.contadores.valesAutorizadosHoy = `${d.autorizados}/${d.limite}`;
    } catch { /* no bloquea el render del buzón */ }
  }

  renderContadores();
  poblarFiltroEstado();
  renderTabla();
}

export async function cargarMasVales() {
  if (state.paginacion.cargandoMas || !state.paginacion.hasMore) return;
  state.paginacion.cargandoMas = true;
  const qs = construirQueryBase();
  if (state.paginacion.cursor) qs.set('cursor', String(state.paginacion.cursor));

  try {
    const data = await obtenerMasVales(qs);
    // Si el cursor ya no aparece en el conjunto recalculado del servidor, este
    // cae a un respaldo por posición que en teoría podría repetir filas ya
    // mostradas — se descartan acá por clave de fila, nunca duplicando una
    // fila en pantalla. Se usa `claveFila` (no `id`) porque en Trabajo
    // Realizado un mismo vale puede traer 2 filas —fusión y propuesta
    // propia— con el mismo id.
    const yaCargados = new Set(state.vales.map(claveFila));
    const nuevos = (data.vales || []).filter(v => !yaCargados.has(claveFila(v)));
    state.vales = state.vales.concat(nuevos);
    state.paginacion.cursor = data.nextCursor ?? state.paginacion.cursor;
    state.paginacion.total = data.total ?? state.paginacion.total;
    state.paginacion.hasMore = !!data.hasMore;
    renderTabla();
  } catch { /* si falla, simplemente no se agregan más filas; el usuario puede reintentar scrolleando */ }
  state.paginacion.cargandoMas = false;
}

export function wireScrollInfinito() {
  window.addEventListener('scroll', () => {
    if (state.paginacion.cargandoMas || !state.paginacion.hasMore) return;
    const cercaDelFinal = window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
    if (cercaDelFinal) cargarMasVales();
  });
}

// Cada tarjeta con `filtro` es clickeable para filtrar el buzón por ese
// criterio (toggle); las propias contadores nunca cambian de valor al
// activarse (el backend las calcula antes de aplicar el filtro), y no afecta
// el scroll infinito porque el filtro viaja en la misma querystring que ya
// usa la paginación.
export function renderContadores() {
  let config = CONTADORES_CONFIG[state.user.rolId] || [];
  if (!Array.isArray(config)) config = config[state.vista] || [];
  const grid = $('#contadores-grid');
  grid.innerHTML = config.map(c => {
    const valor = state.contadores[c.key];
    const mostrado = c.esTexto ? (valor || '—') : (valor ?? 0);
    const alerta = c.alerta && Number(valor) > 0;
    const esClickeable = !!c.filtro || !!c.atrasadosGlobal;
    // "Atrasados en general" es el único contador combinable: se activa/
    // desactiva con su propio interruptor (state.soloAtrasados) en vez de
    // competir por state.filtroContador con el resto de las tarjetas, que
    // siguen siendo mutuamente excluyentes.
    const activo = c.atrasadosGlobal ? state.soloAtrasados : (c.filtro && state.filtroContador === c.filtro);
    const clases = ['contador-card'];
    if (alerta) clases.push('contador-alerta');
    if (esClickeable) clases.push('contador-clickeable');
    if (activo) clases.push('contador-activo');
    // Un valor largo (p. ej. el correlativo del vale en proceso del técnico,
    // "GUA-3-0003") no se lee bien con el mismo tamaño pensado para un número
    // — .valor-compacto lo reduce sin tocar los contadores numéricos ni los
    // "N/M" cortos.
    const valorLargo = String(mostrado).length > 6;
    return `
      <div class="${clases.join(' ')}" data-filtro="${c.filtro || ''}" data-atrasados-global="${c.atrasadosGlobal ? '1' : ''}">
        <div class="valor${valorLargo ? ' valor-compacto' : ''}">${mostrado}</div>
        <div class="etiqueta">${c.label}</div>
      </div>`;
  }).join('');

  $$('.contador-card', grid).forEach(card => {
    const filtro = card.dataset.filtro;
    const esAtrasadosGlobal = card.dataset.atrasadosGlobal === '1';
    if (!filtro && !esAtrasadosGlobal) return;
    card.addEventListener('click', () => {
      if (esAtrasadosGlobal) {
        state.soloAtrasados = !state.soloAtrasados;
      } else {
        state.filtroContador = state.filtroContador === filtro ? null : filtro;
      }
      cargarBuzon();
    });
  });
}

// Opciones del desplegable "Todos los estados": se muestra siempre el
// conjunto completo válido para el rol/vista actual (no lo que estuviera
// cargado en `state.vales` en ese momento), para que un estado que solo
// existe más allá de la primera página siga siendo seleccionable. El
// filtrado en sí es responsabilidad del servidor (state.estadoFiltro).
export function poblarFiltroEstado() {
  const select = $('#filtro-estado');
  let labelMap;
  if (usaEstadosVisibles()) {
    labelMap = ESTADOS_VISIBLES_LABEL;
  } else {
    // Cada rol solo debe poder filtrar por estados que realmente puede llegar
    // a ver, no la familia completa. Quien fusiona (vales.aprobar_general) ve,
    // mezclados en su propio buzón/trabajo, los estados de la cola de fusión.
    let claves;
    if (state.user.rolId === ROL.TECNICO) claves = state.vista === 'trabajo' ? CLAVES_ESTADOS_TECNICO_TRABAJO : CLAVES_ESTADOS_TECNICO_BUZON;
    else if (ROLES_ENCARGADO_TALLER.includes(state.user.rolId)) {
      // Trabajo Realizado siempre muestra APROBADO (estado congelado, tanto la
      // fila de propuesta propia como la de fusión) — los estados generales ya
      // no pueden ocurrir ahí, así que el desplegable colapsa igual que el del
      // técnico.
      if (state.vista === 'trabajo') {
        claves = [...CLAVES_ESTADOS_TECNICO_TRABAJO];
      } else {
        claves = [...CLAVES_ESTADOS_TALLER];
        if (puede('aprobarGeneral')) claves = [...claves, 'APROBADO_DEPARTAMENTO'];
      }
    } else claves = CLAVES_ESTADOS_GENERAL;
    labelMap = Object.fromEntries(claves.map(k => [k, ESTADOS_LABEL[k]]));
  }
  select.innerHTML = '<option value="">Todos los estados</option>' +
    Object.entries(labelMap).map(([clave, label]) => `<option value="${clave}">${label}</option>`).join('');
  select.value = state.estadoFiltro || '';
}

// Cuenta las columnas realmente visibles del <thead> (la de Taller puede estar
// oculta vía CSS para encargados/técnicos) para que los mensajes de "tabla
// vacía"/error usen el colspan correcto sin hardcodearlo por rol.
export function columnasVisibles() {
  const todas = $$('.buzon-table thead th');
  const visibles = todas.filter(th => th.offsetParent !== null);
  return visibles.length || todas.length;
}

export function renderTabla() {
  // El filtro de estado y el orden por columna ya vienen resueltos del
  // servidor (viajan en la query); acá solo se pinta `state.vales` tal cual
  // llegó.
  const filas = state.vales;

  const tbody = $('#buzon-tbody');
  if (filas.length === 0) {
    const esBusqueda = !!state.busqueda;
    const icono = esBusqueda ? 'search-outline' : 'file-tray-outline';
    const titulo = esBusqueda ? 'Sin resultados' : 'Buzón vacío';
    const mensaje = esBusqueda
      ? `No encontramos vales de arte para «${state.busqueda}».`
      : 'No hay vales de arte para mostrar con los filtros actuales.';
    tbody.innerHTML = `
      <tr><td colspan="${columnasVisibles()}" class="tabla-vacia">
        <div class="buzon-vacio">
          <ion-icon name="${icono}"></ion-icon>
          <h3>${titulo}</h3>
          <p>${mensaje}</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = filas.map(v => `
    <tr>
      <td data-label="Correlativo"><strong>${v.correlativo}</strong>${marcadorTipoRegistro(v)}${v.urgente ? '<span class="badge badge-urgente">URGENTE</span>' : ''}</td>
      <td data-label="Fecha Ingreso">${formatearFechaHora(v.creado_en || `${v.fecha_creacion} ${v.hora_creacion}`)}</td>
      <td data-label="Fecha Entrega">${formatearFecha(v.fecha_entrega)}</td>
      <td data-label="Atraso">${v.venceHoy ? '<span class="badge badge-hoy">Hoy</span>' : (v.atrasado ? `<span class="badge badge-atraso">${v.diasAtraso}d</span>` : `<span class="badge badge-ok">Al día</span>`)}</td>
      <td data-label="Fecha Evento">${formatearFecha(v.fecha_evento)}</td>
      <td data-label="Taller" class="col-taller">${celdaTaller(v)}</td>
      <td data-label="Estado"><span class="estado-pill ${claseEstado(v)}">${etiquetaEstado(v)}</span></td>
      <td data-label="Acciones" class="acciones-cell" data-row-key="${claveFila(v)}"></td>
    </tr>
  `).join('');

  filas.forEach(v => {
    const cell = tbody.querySelector(`.acciones-cell[data-row-key="${CSS.escape(claveFila(v))}"]`);
    // Los botones van en un <div> interno (.acciones-wrap), no directo en la
    // <td> — ver comentario en styles.css.
    const wrap = document.createElement('div');
    wrap.className = 'acciones-wrap';
    cell.appendChild(wrap);
    construirAcciones(v).forEach(accion => {
      const btn = document.createElement('button');
      btn.className = `btn-icon ${accion.clase || ''}`;
      btn.title = accion.titulo;
      btn.innerHTML = `<ion-icon name="${accion.icono}"></ion-icon>`;
      btn.addEventListener('click', () => {
        const clave = claveFila(v);
        if (state.accionesEnCurso.has(clave)) return;
        state.accionesEnCurso.add(clave);
        Promise.resolve(accion.onClick(v)).finally(() => state.accionesEnCurso.delete(clave));
      });
      wrap.appendChild(btn);
    });
  });
}

export function construirAcciones(v) {
  // El supervisor abre un modal de elección (Ver info / Ver vale) en vez de ir
  // directo al PDF — a veces solo necesita los datos de encabezado.
  const acciones = state.user.rolId === ROL.SUPERVISOR
    ? [{ icono: 'eye-outline', titulo: 'Ver', onClick: abrirModalVerSupervisor }]
    : [{ icono: 'eye-outline', titulo: 'Ver vale de arte (PDF)', onClick: () => window.open(`/api/vales/${v.id}/pdf`, '_blank') }];
  // El hipervínculo de la propuesta apunta al documento de propuesta real, no
  // al vale (PDF) — disponible tanto en el buzón (trabajo realizado) como en
  // cualquier vista donde ya exista una propuesta oficial para el vale. El
  // supervisor también la necesita en Trabajo realizado. Quien fusiona
  // (Encargado/Asistente de Diseño) también ve "Ver propuesta" con SU
  // documento de fusión (propuesta_general_url) en Trabajo Realizado. Se
  // excluye la fila de PROPUESTA propia (también trae propuesta_general_url,
  // hereda todos los campos del vale) para no mostrar el botón de la fusión
  // en las dos filas del mismo vale.
  if ((usaEstadosVisibles() || state.user.rolId === ROL.SUPERVISOR || puede('aprobarGeneral')) && v.propuesta_general_url && v._tipoRegistro !== 'PROPUESTA') {
    acciones.push({ icono: 'document-attach-outline', titulo: 'Ver propuesta de fusión', onClick: () => window.open(`/${v.propuesta_general_url}`, '_blank') });
  }
  // En "Trabajo realizado" el encargado de un taller (y el propio técnico) ve
  // la propuesta REAL que se aprobó (`propuesta_taller_url`, solo viene
  // poblado en esa vista) — no `propuesta_general_url`, que en un vale
  // multi-taller es la fusión, no el trabajo propio de este taller.
  if (ROLES_TALLER_Y_TECNICO.includes(state.user.rolId) && v.propuesta_taller_url) {
    acciones.push({ icono: 'document-attach-outline', titulo: 'Ver propuesta', onClick: () => window.open(`/${v.propuesta_taller_url}`, '_blank') });
  }

  // El Supervisor autoriza el envío a talleres de un vale recién creado por
  // uno de sus asesores.
  if (puede('autorizarCreacion') && v.estado === 'ESPERANDO_AUTORIZACION') {
    acciones.push({ icono: 'checkmark-done-outline', titulo: 'Autorizar creación', clase: 'icon-success', onClick: abrirModalAutorizarCreacion });
  }
  if (puede('asignar') && v.estado_taller === 'PENDIENTE_ASIGNACION') {
    acciones.push({ icono: 'person-add-outline', titulo: 'Asignar a técnico', onClick: abrirModalAsignar });
  }
  if (puede('revisar') && v.estado_taller === 'EN_REVISION') {
    acciones.push({ icono: 'clipboard-outline', titulo: 'Revisar propuesta', onClick: abrirModalRevisar });
  }
  // Un encargado comparte buzón con TODOS los técnicos de su taller — las
  // acciones de "trabajar" solo deben aparecer en el vale que él mismo se
  // autoasignó, nunca en el de otro técnico solo porque ambos caen en el
  // mismo buzón.
  const puedeTrabajarEste = puede('trabajar') && esAccionDeTrabajoVisible(v);
  if (puedeTrabajarEste && v.estado_taller === 'ASIGNADO') {
    acciones.push({ icono: 'play-outline', titulo: 'Comenzar', clase: 'icon-success', onClick: accionComenzar });
  }
  if (puedeTrabajarEste && v.estado_taller === 'EN_PROCESO') {
    acciones.push({ icono: 'checkmark-done-outline', titulo: 'Entregar propuesta', clase: 'icon-success', onClick: abrirModalEntregar });
    acciones.push({ icono: 'pause-outline', titulo: 'Pausar proceso', onClick: accionPausar });
    acciones.push({ icono: 'close-outline', titulo: 'Cancelar proceso', clase: 'icon-danger', onClick: accionCancelarProceso });
  }
  if (puedeTrabajarEste && v.estado_taller === 'EN_PAUSA') {
    acciones.push({ icono: 'play-outline', titulo: 'Reanudar proceso', clase: 'icon-success', onClick: accionReanudar });
  }
  if (puede('aprobarGeneral') && v.estado === 'APROBADO_DEPARTAMENTO') {
    acciones.push({ icono: 'checkmark-done-circle-outline', titulo: 'Aprobar y fusionar', clase: 'icon-success', onClick: abrirModalAprobarGeneral });
  }
  if (puede('confirmar') && v.estado === 'PENDIENTE_CONFIRMACION') {
    acciones.push({ icono: 'document-text-outline', titulo: 'Confirmar o solicitar modificación', clase: 'icon-success', onClick: abrirModalDecisionAsesor });
  }
  if (puede('solicitarModificacion') && v.estado === 'RECIBIDO' && !Number(v.modificado)) {
    acciones.push({ icono: 'create-outline', titulo: 'Solicitar modificación', onClick: abrirModalSolicitarModificacion });
  }
  if (puede('aprobarModificacion') && v.estado === 'SOLICITANDO_MODIFICACION') {
    acciones.push({ icono: 'checkmark-circle-outline', titulo: 'Aprobar modificación', clase: 'icon-success', onClick: abrirModalAprobarModificacion });
  }
  acciones.push({ icono: 'time-outline', titulo: 'Ver historial', onClick: abrirModalHistorial });

  return acciones;
}
