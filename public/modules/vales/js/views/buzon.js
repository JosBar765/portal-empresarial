import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { ROL, ROLES_CON_SIDEBAR, ROLES_TALLER_Y_DISENADOR, rolEncargadoDe } from '../config/roles.js';
import { CONTADORES_CONFIG } from '../config/contadores.js';
import { aplicarVentanaAQuery } from '../utils/ventana.js';
import { puede, tienePermiso, usaEstadosVisibles, esAccionDeTrabajoVisible } from '../permisos.js';
import { celdaEstado } from '../components/pipeline.js';
import { abrirVisorVale } from '../components/visorDocumento.js';
import { htmlBloqueVigentes, conectarBloqueVigentes } from '../components/atrasadosVigentes.js';
import { formatearFecha, formatearFechaHora, celdaTaller, claveFila, marcadorTipoRegistro, badgePersona, escapeHtml } from '../utils/formato.js';
import { obtenerBuzon, obtenerMasVales } from '../api/valesApi.js';
import { cargarReportes } from './reportes.js';
import { abrirModalAutorizarCreacion, abrirModalAprobarModificacion, abrirModalVerSupervisor } from '../actions/supervisor.js';
import { abrirModalAsignar, abrirModalRevisar, abrirModalAprobarGeneral } from '../actions/encargado.js';
import { accionComenzar, abrirModalEntregar, accionPausar, accionReanudar, accionCancelarProceso } from '../actions/disenador.js';
import { abrirModalVerificarAdjuntos, abrirModalRechazarAdjuntos, abrirModalConversacion, abrirModalAdjuntosPendientes } from '../actions/adjuntos.js';
import { abrirVisorDecisionAsesor, abrirDarDeBaja, abrirModalMotivoRechazo, accionReenviar } from '../actions/asesor.js';
import { abrirModalCorregirVale } from '../forms/valeForm.js';
import { abrirSelectorModificacion } from '../actions/modificacionTipo.js';
import { abrirModalHistorial } from '../actions/historial.js';
import { abrirVisorPropuestasOtros } from '../actions/propuestasOtros.js';
import { abrirConversacionesBasicas } from '../actions/modificacionBasica.js';
import { rechazosSinLeer, textoRechazos } from '../utils/modificacionesVistas.js';

// -----------------------------------------------------------------------
// Carga y render del buzón (paginado: 50 vales por petición, cargados por
// scroll infinito; el orden — jerarquía general e individual — ya viene
// resuelto del backend, la paginación solo recorta esa lista ya ordenada).
// -----------------------------------------------------------------------
export function construirQueryBase() {
  const qs = new URLSearchParams();
  aplicarVentanaAQuery(qs);
  if (ROLES_CON_SIDEBAR.includes(rolEncargadoDe(state.user))) qs.set('vista', state.vista);
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

// Número de la última carga pedida: una respuesta anterior a la última no se pinta.
let ultimaCarga = 0;

export async function cargarBuzon() {
  // Reportes de actividad: tienen su propia vista y su propia consulta.
  if (state.vista === 'reportes') return cargarReportes();
  state.paginacion = { limit: 50, cursor: null, total: 0, hasMore: false, cargandoMas: false };
  const qs = construirQueryBase();
  const numeroCarga = ++ultimaCarga;

  try {
    const data = await obtenerBuzon(qs);
    if (numeroCarga !== ultimaCarga) return;
    state.vales = data.vales || [];
    state.contadores = data.contadores || {};
    state.mensajeVacio = data.mensajeVacio || '';
    state.paginacion.total = data.total ?? state.vales.length;
    state.paginacion.hasMore = !!data.hasMore;
    state.paginacion.cursor = data.nextCursor ?? null;
  } catch (error) {
    if (numeroCarga !== ultimaCarga) return;
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

  const numeroCarga = ultimaCarga;

  try {
    const data = await obtenerMasVales(qs);
    if (numeroCarga !== ultimaCarga) return;
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
  let config = CONTADORES_CONFIG[rolEncargadoDe(state.user)] || CONTADORES_CONFIG[ROL.ADMINISTRADOR] || [];
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
      : (state.mensajeVacio || 'No hay vales de arte para mostrar con los filtros actuales.');
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

  pintarFilas(tbody, filas);
}

// La empresa del cliente va bajo el correlativo solo para quienes siguen el vale de punta a punta.
const ROLES_CON_EMPRESA = [ROL.ASESOR, ROL.SUPERVISOR, ROL.GERENTE, ROL.ADMINISTRADOR];
const empresaDeFila = (v) => (ROLES_CON_EMPRESA.includes(state.user.rolId) && v.cliente_empresa
  ? `<span class="vale-empresa" title="${escapeHtml(v.cliente_empresa)}">${escapeHtml(v.cliente_empresa)}</span>` : '');

// Dibuja las filas de vales (y sus botones de acción) en un <tbody>.
function pintarFilas(tbody, filas) {
  tbody.innerHTML = filas.map(v => `
    <tr>
      <td data-label="Correlativo"><strong>${v.correlativo}</strong>${marcadorTipoRegistro(v)}${v.mod_en_tramite ? `<span class="badge badge-mod" title="Tiene la solicitud de modificación ${v.mod_en_tramite.correlativo} en trámite">MOD en trámite</span>` : ''}${badgeBasica(v)}${rechazosSinLeer(v).length ? `<span class="badge badge-rechazada" title="${escapeHtml(textoRechazos(rechazosSinLeer(v)))}">Básica rechazada</span>` : ''}${v.urgente ? '<span class="badge badge-urgente">URGENTE</span>' : ''}${marcaPropuestaNueva(v)}${badgePersona(v)}${empresaDeFila(v)}</td>
      <td data-label="Fecha Ingreso" class="col-fecha-ingreso">${formatearFechaHora(v.creado_en || `${v.fecha_creacion} ${v.hora_creacion}`)}</td>
      <td data-label="Fecha Entrega">${formatearFecha(v.fecha_entrega)}</td>
      <td data-label="Atraso">${v.venceHoy ? '<span class="badge badge-hoy">Hoy</span>' : (v.atrasado ? `<span class="badge badge-atraso">${v.diasAtraso}d</span>` : `<span class="badge badge-ok">Al día</span>`)}</td>
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
    crearBotonesAcciones(wrap, v);
  });
  conectarMarcas(tbody, filas);
}

// Signo rojo «?»: otro taller del vale ya tiene su propuesta aprobada y este usuario aún no la ha visto.
export function marcaPropuestaNueva(v) {
  if (!v.propuestaOtroTallerNueva) return '';
  const texto = 'Propuesta disponible. Otro taller ya tiene su propuesta aprobada. Puedes verla en el detalle del vale.';
  return `<button type="button" class="pn-marca" data-pn-clave="${escapeAttr(claveFila(v))}" aria-label="${texto}"><span aria-hidden="true">?</span></button>`;
}

function conectarMarcas(raiz, filas) {
  raiz.querySelectorAll('[data-pn-clave]').forEach(b => {
    const v = filas.find(f => claveFila(f) === b.dataset.pnClave);
    if (v) b.addEventListener('click', () => abrirVisorPropuestasOtros(v));
  });
}

// Botones de acción de una fila.
function crearBotonesAcciones(wrap, v) {
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
}

const escapeAttr = (t) => String(t).replace(/"/g, '&quot;');

// Propuesta que este usuario puede ver en la fila (la fusión o la del propio taller; con archivo o solo con enlaces), o null.
function propuestaGeneralVisible(v) {
  const aplica = (usaEstadosVisibles() || state.user.rolId === ROL.SUPERVISOR || puede('aprobarGeneral')) && v._tipoRegistro !== 'PROPUESTA';
  return aplica && (v.propuesta_general_url || v.propuesta_extra) ? { tipo: 'general' } : null;
}
function propuestaTallerVisible(v) {
  return ROLES_TALLER_Y_DISENADOR.includes(rolEncargadoDe(state.user)) && (v.propuesta_taller_url || v.propuesta_taller_extra)
    ? { tipo: 'taller', disenadorId: v.propuesta_disenador_id }
    : null;
}
const propuestaVisible = (v) => propuestaGeneralVisible(v) || propuestaTallerVisible(v);

const abrirVisorDeFila = (v, propuesta) => abrirVisorVale({ id: v.id, correlativo: v.correlativo, propuesta });

// Modificaciones básicas del vale que ve quien mira: el asesor dueño ve todas; un taller solo las suyas.
const basicasVisibles = (v) => (v.modificaciones_basicas || []).filter(m => v.taller_id == null || v.asesor_id === state.user.id || m.taller_id === v.taller_id);

// Etiqueta mientras la modificación básica está en trámite: se conversa o el taller aceptó y rehace la propuesta.
function badgeBasica(v) {
  const basicas = basicasVisibles(v);
  if (basicas.some(m => m.estado === 'EN_CONVERSACION')) return '<span class="badge badge-basica" title="Hay una modificación básica en conversación">Básica en chat</span>';
  if (basicas.some(m => m.estado === 'ACEPTADA')) return '<span class="badge badge-basica" title="El taller aceptó: se está rehaciendo la propuesta">Básica en proceso</span>';
  return '';
}

export function construirAcciones(v) {
  const esMio = v.asesor_id === state.user.id;
  // Un supervisor solo actúa como asesor sobre SUS vales: sobre los de su equipo solo autoriza y supervisa.
  const ajenoDeSupervisor = state.user.rolId === ROL.SUPERVISOR && !esMio;
  // En el paso 5 (pendiente de confirmación) el «ojo» y el de confirmar son un solo botón: abre el vale y la propuesta con
  // «Confirmar recibido» y «Solicitar modificación» abajo. Con una modificación en trámite hay un solo camino a la vez.
  // Con una modificación básica abierta tampoco se confirma: se conversa con el taller hasta que responda.
  const basicasAbiertas = v.modificaciones_basicas_abiertas || [];
  const decideEnPaso5 = puede('confirmar') && v.estado === 'PENDIENTE_CONFIRMACION' && !v.mod_en_tramite && !basicasAbiertas.length && !ajenoDeSupervisor;
  // El supervisor abre un modal de elección (Ver info / Ver vale) en vez de ir
  // directo al PDF — a veces solo necesita los datos de encabezado. Vale también para los suyos, que él autoriza.
  const acciones = decideEnPaso5
    ? [{ icono: 'document-text-outline', titulo: 'Ver y decidir', clase: 'icon-success', onClick: (vale) => abrirVisorDecisionAsesor(vale, propuestaVisible(vale)) }]
    : state.user.rolId === ROL.SUPERVISOR
      ? [{ icono: 'eye-outline', titulo: 'Ver', onClick: abrirModalVerSupervisor }]
      : [{ icono: 'eye-outline', titulo: 'Ver vale de arte (PDF)', onClick: () => abrirVisorDeFila(v, propuestaVisible(v)) }];
  // El Supervisor autoriza el envío a talleres de un vale recién creado por
  // uno de sus asesores.
  if (puede('autorizarCreacion') && v.estado === 'ESPERANDO_AUTORIZACION') {
    acciones.push({ icono: 'checkmark-done-outline', titulo: 'Autorizar creación', clase: 'icon-success', onClick: abrirModalAutorizarCreacion });
  }
  if (puede('asignar') && v.estado_taller === 'PENDIENTE_ASIGNACION') {
    acciones.push({ icono: 'person-add-outline', titulo: 'Asignar a diseñador', onClick: abrirModalAsignar });
  }
  // El encargado verifica o rechaza (con un mensaje para el asesor) y, con el vale rechazado o ya respondido, conversa con él.
  if (puede('verificarAdjuntos') && ['ADJUNTOS_RECHAZADOS', 'ADJUNTOS_RESPONDIDOS'].includes(v.estado_taller)) {
    acciones.push({ icono: 'chatbubbles-outline', titulo: 'Conversación con el asesor', onClick: (vale) => abrirModalConversacion(vale, vale.taller_id) });
  }
  if (puede('verificarAdjuntos') && ['VERIFICANDO_ADJUNTOS', 'ADJUNTOS_RESPONDIDOS'].includes(v.estado_taller)) {
    acciones.push({ icono: 'mail-open-outline', titulo: 'Verificar adjuntos', clase: 'icon-success', onClick: abrirModalVerificarAdjuntos });
    acciones.push({ icono: 'close-circle-outline', titulo: 'Rechazar', clase: 'icon-danger', onClick: abrirModalRechazarAdjuntos });
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
  // Un vale recibido se puede modificar si todavía no tiene un vale MOD hijo; un MOD recibido también (MOD2, MOD3…).
  // Desde aquí solo se ofrecen la modificación media y la avanzada.
  if (puede('solicitarModificacion') && v.estado === 'RECIBIDO' && !Number(v.modificado) && !v.mod_en_tramite && !basicasAbiertas.length && !ajenoDeSupervisor) {
    acciones.push({ icono: 'create-outline', titulo: 'Solicitar modificación', onClick: abrirSelectorModificacion });
  }
  // Chat de la modificación básica: queda en la fila mientras haya alguna visible para quien mira (asesor dueño o equipo del taller),
  // también ya cerrada, para saber qué se pidió. Rojo si hay un rechazo sin leer; el servidor entrega solo las conversaciones del taller.
  const basicas = basicasVisibles(v);
  const equipoTaller = puede('responderModificacionBasica');
  const rechazos = rechazosSinLeer(v);
  if (basicas.length && ((puede('solicitarModificacion') && esMio) || equipoTaller)) {
    acciones.push({
      icono: 'chatbubbles-outline',
      titulo: rechazos.length ? 'Ver chat del rechazo' : (equipoTaller && basicasAbiertas.length ? 'Responder modificación' : 'Chat de la modificación'),
      clase: rechazos.length ? 'icon-danger' : (basicasAbiertas.length ? 'icon-success' : undefined),
      onClick: (vale) => abrirConversacionesBasicas(vale, rechazos.length ? { ids: rechazos.map(r => r.id) } : {})
    });
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
  // Propuestas aprobadas de los otros talleres (solo si aplica la regla de compartir), solo lectura.
  if (ROLES_TALLER_Y_DISENADOR.includes(rolEncargadoDe(state.user)) && (v.propuestaOtroTallerNueva || v.propuestasOtrosAplica)) {
    acciones.push({ icono: 'documents-outline', titulo: 'Propuestas de otros talleres', onClick: abrirVisorPropuestasOtros });
  }
  if (puede('verHistorial')) acciones.push({ icono: 'time-outline', titulo: 'Ver historial', onClick: abrirModalHistorial });
  if (puede('darDeBaja') && (['ESPERANDO_AUTORIZACION', 'SOLICITANDO_MODIFICACION', 'RECHAZADO'].includes(v.estado) || (v.adjuntos || []).length) && esMio) {
    acciones.push({ icono: 'ban-outline', titulo: 'Dar de baja', clase: 'icon-danger', onClick: abrirDarDeBaja });
  }

  return acciones;
}
