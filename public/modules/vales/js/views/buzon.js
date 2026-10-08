import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { ROL, ROLES_CON_SIDEBAR, ROLES_TALLER_Y_DISENADOR } from '../config/roles.js';
import { CONTADORES_CONFIG } from '../config/contadores.js';
import { aplicarVentanaAQuery } from '../utils/ventana.js';
import { puede, tienePermiso, usaEstadosVisibles, esAccionDeTrabajoVisible } from '../permisos.js';
import { celdaEstado } from '../components/pipeline.js';
import { formatearFecha, formatearFechaHora, celdaTaller, claveFila, marcadorTipoRegistro } from '../utils/formato.js';
import { obtenerBuzon, obtenerMasVales } from '../api/valesApi.js';
import { cargarRendimientoGerencia } from './rendimientoGerencia.js';
import { cargarReportes } from './reportes.js';
import { cargarEncontrarVale } from './encontrarVale.js';
import { abrirModalAutorizarCreacion, abrirModalAprobarModificacion, abrirModalVerSupervisor } from '../actions/supervisor.js';
import { abrirModalAsignar, abrirModalRevisar, abrirModalAprobarGeneral } from '../actions/encargado.js';
import { accionComenzar, abrirModalEntregar, accionPausar, accionReanudar, accionCancelarProceso } from '../actions/disenador.js';
import { accionVerificarAdjuntos, abrirModalRechazarAdjuntos, abrirModalMensajeAdjuntos, abrirModalAdjuntosPendientes } from '../actions/adjuntos.js';
import { abrirModalDecisionAsesor, abrirModalDarDeBaja, abrirModalMotivoRechazo, accionReenviar } from '../actions/asesor.js';
import { abrirModalSolicitarModificacion, abrirModalCorregirVale } from '../forms/valeForm.js';
import { abrirModalHistorial } from '../actions/historial.js';

// -----------------------------------------------------------------------
// Carga y render del buzón (paginado: 50 vales por petición, cargados por
// scroll infinito; el orden — jerarquía general e individual — ya viene
// resuelto del backend, la paginación solo recorta esa lista ya ordenada).
// -----------------------------------------------------------------------
export function construirQueryBase() {
  const qs = new URLSearchParams();
  aplicarVentanaAQuery(qs);
  if (ROLES_CON_SIDEBAR.includes(state.user.rolId)) qs.set('vista', state.vista);
  if (state.filtroContador) qs.set('filtroContador', state.filtroContador);
  if (state.soloAtrasados) qs.set('soloAtrasados', '1');
  if (state.soloModificados) qs.set('soloModificados', '1');
  if (state.disenadorFiltro && state.vista !== 'trabajo') qs.set('disenadorId', state.disenadorFiltro);
  if (state.busqueda) qs.set('busqueda', state.busqueda);
  if (state.tiendaId) qs.set('tiendaId', state.tiendaId);
  if (state.sort.key && state.sort.dir) {
    qs.set('sortKey', state.sort.key);
    qs.set('sortDir', state.sort.dir);
  }
  return qs;
}

export async function cargarBuzon() {
  // Reportes de actividad: tienen su propia vista y su propia consulta.
  if (state.vista === 'reportes') return cargarReportes();
  // Gerente y Supervisor en su vista "Rendimiento" no piden el buzón de
  // vales — piden las métricas agregadas.
  if ([ROL.SUPERVISOR, ROL.GERENTE].includes(state.user.rolId) && state.vista === 'rendimiento') {
    return cargarRendimientoGerencia();
  }
  // El Gerente no tiene buzón: solo busca vales por correlativo.
  if (state.user.rolId === ROL.GERENTE && state.vista === 'encontrar') {
    return cargarEncontrarVale();
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

  renderContadores();
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
let contadorEnfocado = null;

export function renderContadores() {
  let config = CONTADORES_CONFIG[state.user.rolId] || [];
  if (!Array.isArray(config)) config = config[state.vista] || [];
  config = config.filter(c => !c.permiso || tienePermiso(c.permiso));
  const grid = $('#contadores-grid');
  grid.innerHTML = config.map(c => {
    const valor = state.contadores[c.key];
    const mostrado = c.esTexto ? (valor || '—') : (valor ?? 0);
    const alerta = c.alerta && Number(valor) > 0;
    const esClickeable = !!c.filtro || !!c.atrasadosGlobal || !!c.modificadosGlobal;
    // "Atrasados" y "Modificados" son contadores combinables: se activan/desactivan con su propio
    // interruptor (state.soloAtrasados / state.soloModificados) en vez de competir por
    // state.filtroContador con el resto de las tarjetas, que siguen siendo mutuamente excluyentes.
    const activo = c.atrasadosGlobal ? state.soloAtrasados
      : (c.modificadosGlobal ? state.soloModificados : (c.filtro && state.filtroContador === c.filtro));
    const clases = ['contador-card'];
    if (alerta) clases.push('contador-alerta');
    if (esClickeable) clases.push('contador-clickeable');
    if (activo) clases.push('contador-activo');
    // Un valor largo (p. ej. el correlativo del vale en proceso del diseñador,
    // "GUA-3-0003") no se lee bien con el mismo tamaño pensado para un número
    // — .valor-compacto lo reduce sin tocar los contadores numéricos ni los
    // "N/M" cortos.
    const valorLargo = String(mostrado).length > 6;
    const atributos = `class="${clases.join(' ')}" data-key="${c.key}" data-filtro="${c.filtro || ''}" data-atrasados-global="${c.atrasadosGlobal ? '1' : ''}" data-modificados-global="${c.modificadosGlobal ? '1' : ''}"`;
    // `quien`: quién tiene que actuar en ese paso, en pequeño bajo la etiqueta.
    const etiqueta = c.quien
      ? `<span class="etiqueta"><span class="etiqueta-texto">${c.label}</span><span class="etiqueta-quien">${c.quien}</span></span>`
      : `<span class="etiqueta">${c.label}</span>`;
    const contenido = `<span class="valor${valorLargo ? ' valor-compacto' : ''}">${mostrado}</span>${etiqueta}`;
    return esClickeable
      ? `<button type="button" ${atributos} aria-pressed="${activo ? 'true' : 'false'}">${contenido}</button>`
      : `<div ${atributos}>${contenido}</div>`;
  }).join('');

  // Al volver a pintar las tarjetas se pierde el foco: quien filtró con el teclado lo recupera.
  if (contadorEnfocado) {
    const card = grid.querySelector(`[data-key="${CSS.escape(contadorEnfocado)}"]`);
    if (card && card.tagName === 'BUTTON') card.focus();
    contadorEnfocado = null;
  }

  $$('.contador-card', grid).forEach(card => {
    const filtro = card.dataset.filtro;
    const esAtrasadosGlobal = card.dataset.atrasadosGlobal === '1';
    const esModificadosGlobal = card.dataset.modificadosGlobal === '1';
    if (!filtro && !esAtrasadosGlobal && !esModificadosGlobal) return;
    card.addEventListener('click', () => {
      contadorEnfocado = card.dataset.key;
      if (esAtrasadosGlobal) {
        state.soloAtrasados = !state.soloAtrasados;
      } else if (esModificadosGlobal) {
        state.soloModificados = !state.soloModificados;
      } else {
        state.filtroContador = state.filtroContador === filtro ? null : filtro;
      }
      cargarBuzon();
    });
  });
}

// Cuenta las columnas realmente visibles del <thead> (la de Taller puede estar
// oculta vía CSS para encargados/diseñadores) para que los mensajes de "tabla
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
      <td data-label="Correlativo"><strong>${v.correlativo}</strong>${marcadorTipoRegistro(v)}${v.mod_en_tramite ? `<span class="badge badge-mod" title="Tiene la solicitud de modificación ${v.mod_en_tramite.correlativo} en trámite">MOD en trámite</span>` : ''}${v.urgente ? '<span class="badge badge-urgente">URGENTE</span>' : ''}</td>
      <td data-label="Fecha Ingreso" class="col-fecha-ingreso">${formatearFechaHora(v.creado_en || `${v.fecha_creacion} ${v.hora_creacion}`)}</td>
      <td data-label="Fecha Entrega">${formatearFecha(v.fecha_entrega)}</td>
      <td data-label="Atraso">${v.venceHoy ? '<span class="badge badge-hoy">Hoy</span>' : (v.atrasado ? `<span class="badge badge-atraso">${v.diasAtraso}d</span>` : `<span class="badge badge-ok">Al día</span>`)}</td>
      <td data-label="Fecha Evento" class="col-fecha-evento">${formatearFecha(v.fecha_evento)}</td>
      <td data-label="Taller" class="col-taller">${celdaTaller(v)}</td>
      <td data-label="Estado" class="col-estado">${celdaEstado(v)}</td>
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
  const esMio = v.asesor_id === state.user.id;
  // Un supervisor solo actúa como asesor sobre SUS vales: sobre los de su equipo solo autoriza y supervisa.
  const ajenoDeSupervisor = state.user.rolId === ROL.SUPERVISOR && !esMio;
  // El supervisor abre un modal de elección (Ver info / Ver vale) en vez de ir
  // directo al PDF — a veces solo necesita los datos de encabezado. Vale también para los suyos, que él autoriza.
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
    acciones.push({ icono: 'document-attach-outline', titulo: 'Ver propuesta', onClick: () => window.open(v.propuesta_general_url, '_blank') });
  }
  // En "Trabajo realizado" el encargado de un taller (y el propio diseñador) ve
  // la propuesta REAL que se aprobó (`propuesta_taller_url`, solo viene
  // poblado en esa vista) — no `propuesta_general_url`, que en un vale
  // multi-taller es la fusión, no el trabajo propio de este taller.
  if (ROLES_TALLER_Y_DISENADOR.includes(state.user.rolId) && v.propuesta_taller_url) {
    acciones.push({ icono: 'document-attach-outline', titulo: 'Ver propuesta', onClick: () => window.open(v.propuesta_taller_url, '_blank') });
  }

  // El Supervisor autoriza el envío a talleres de un vale recién creado por
  // uno de sus asesores.
  if (puede('autorizarCreacion') && v.estado === 'ESPERANDO_AUTORIZACION') {
    acciones.push({ icono: 'checkmark-done-outline', titulo: 'Autorizar creación', clase: 'icon-success', onClick: abrirModalAutorizarCreacion });
  }
  if (puede('asignar') && v.estado_taller === 'PENDIENTE_ASIGNACION') {
    acciones.push({ icono: 'person-add-outline', titulo: 'Asignar a diseñador', onClick: abrirModalAsignar });
  }
  // Adjuntos: el encargado verifica/rechaza; mientras espera al asesor no tiene acciones.
  if (puede('verificarAdjuntos') && ['VERIFICANDO_ADJUNTOS', 'ADJUNTOS_RESPONDIDOS'].includes(v.estado_taller)) {
    if (v.estado_taller === 'ADJUNTOS_RESPONDIDOS') {
      acciones.push({ icono: 'chatbox-ellipses-outline', titulo: 'Ver mensaje del asesor', onClick: abrirModalMensajeAdjuntos });
    }
    acciones.push({ icono: 'mail-open-outline', titulo: 'Verificar adjuntos', clase: 'icon-success', onClick: accionVerificarAdjuntos });
    acciones.push({ icono: 'close-circle-outline', titulo: 'Rechazar: sin adjuntos', clase: 'icon-danger', onClick: abrirModalRechazarAdjuntos });
  }
  if (puede('revisar') && v.estado_taller === 'EN_REVISION') {
    acciones.push({ icono: 'clipboard-outline', titulo: 'Revisar propuesta', onClick: abrirModalRevisar });
  }
  // Un encargado comparte buzón con TODOS los diseñadores de su taller — las
  // acciones de "trabajar" solo deben aparecer en el vale que él mismo se
  // autoasignó, nunca en el de otro diseñador solo porque ambos caen en el
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
  // Con una solicitud de modificación en trámite no se puede confirmar el original: se espera su decisión.
  if (puede('confirmar') && v.estado === 'PENDIENTE_CONFIRMACION' && !v.mod_en_tramite && !ajenoDeSupervisor) {
    acciones.push({ icono: 'document-text-outline', titulo: 'Confirmar o solicitar modificación', clase: 'icon-success', onClick: abrirModalDecisionAsesor });
  }
  // Un vale MOD- (nacido de una modificación ya aprobada, `vale_original_id`
  // seteado) nunca puede volver a solicitar modificación — solo se permite
  // una por vale (analisis_correcciones_29.md #3).
  if (puede('solicitarModificacion') && v.estado === 'RECIBIDO' && !Number(v.modificado) && !v.vale_original_id && !v.mod_en_tramite && !ajenoDeSupervisor) {
    acciones.push({ icono: 'create-outline', titulo: 'Solicitar modificación', onClick: abrirModalSolicitarModificacion });
  }
  if (puede('aprobarModificacion') && v.estado === 'SOLICITANDO_MODIFICACION') {
    acciones.push({ icono: 'checkmark-circle-outline', titulo: 'Aprobar modificación', clase: 'icon-success', onClick: abrirModalAprobarModificacion });
  }
  if (puede('corregir') && v.estado === 'RECHAZADO' && esMio) {
    acciones.push({ icono: 'alert-circle-outline', titulo: 'Ver motivo del rechazo', clase: 'icon-danger', onClick: abrirModalMotivoRechazo });
  }
  // Adjuntos reclamados por talleres: lo ven el dueño y su supervisor; solo el dueño responde (en el modal).
  if ((v.adjuntos || []).length && (state.user.rolId === ROL.ASESOR || state.user.rolId === ROL.SUPERVISOR)) {
    const hayRechazados = v.adjuntos.some(a => a.estado === 'ADJUNTOS_RECHAZADOS');
    acciones.push({ icono: 'alert-circle-outline', titulo: hayRechazados ? 'Ver adjuntos faltantes' : 'Ver adjuntos enviados', clase: hayRechazados ? 'icon-danger' : '', onClick: abrirModalAdjuntosPendientes });
  }
  if (puede('corregir') && ['ESPERANDO_AUTORIZACION', 'SOLICITANDO_MODIFICACION', 'RECHAZADO'].includes(v.estado) && esMio) {
    acciones.push({ icono: 'settings-outline', titulo: 'Corregir', onClick: abrirModalCorregirVale });
  }
  if (puede('corregir') && v.estado === 'RECHAZADO' && esMio) {
    acciones.push({ icono: 'send-outline', titulo: 'Reenviar a autorización', clase: 'icon-success', onClick: accionReenviar });
  }
  if (puede('verHistorial')) acciones.push({ icono: 'time-outline', titulo: 'Ver historial', onClick: abrirModalHistorial });
  if (puede('darDeBaja') && (['ESPERANDO_AUTORIZACION', 'SOLICITANDO_MODIFICACION', 'RECHAZADO'].includes(v.estado) || (v.adjuntos || []).length) && esMio) {
    acciones.push({ icono: 'ban-outline', titulo: 'Dar de baja', clase: 'icon-danger', onClick: abrirModalDarDeBaja });
  }

  return acciones;
}
