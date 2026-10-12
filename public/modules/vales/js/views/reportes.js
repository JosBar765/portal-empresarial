import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { escapeHtml, formatearFecha, inicialesAvatar } from '../utils/formato.js';
import { ESTADOS_LABEL } from '../config/estados.js';
import { obtenerReporte, descargarReportePdf } from '../api/valesApi.js';
import { abrirModalHistorial } from '../actions/historial.js';
import { fmtNum, fmtPct, fmtDias, ocultarTooltip } from '../components/charts.js';
import { celdaEstado } from '../components/pipeline.js';
import { crearBarraPeriodo, aplicarPeriodoAQuery } from '../components/barraPeriodoReportes.js';
import { crearSelectorMultiple } from '../components/selectorMultiple.js';

// -----------------------------------------------------------------------
// Reportes de actividad. Quienes ven a varias personas (Gerente, Administrador, Supervisor y Encargado/Asistente) reciben
// una tabla unificada: personas (o talleres/tiendas) con sus vales creados en el período, que se despliegan al pulsar
// la fila. Asesor y Diseñador ven su propio listado. El alcance lo decide el servidor según el rol.
// -----------------------------------------------------------------------

let pedidoVigente = 0;
let ultimaData = null;
let barraPeriodo = null;
let tablaActiva = '';

const ICONO_AGRUPAR = { asesor: 'people-outline', disenador: 'brush-outline', taller: 'construct-outline', tienda: 'storefront-outline' };
const AGRUPACIONES = [
  { id: 'tienda', texto: 'Tienda', plural: 'tiendas' },
  { id: 'taller', texto: 'Taller', plural: 'talleres' },
  { id: 'asesor', texto: 'Asesor', plural: 'asesores' },
  { id: 'disenador', texto: 'Diseñador', plural: 'diseñadores' }
];

function construirQuery() {
  const r = state.reporte;
  const qs = new URLSearchParams();
  aplicarPeriodoAQuery(qs, r.ventana);
  if (r.agruparPor) qs.set('agruparPor', r.agruparPor);
  if (r.tiendaId) qs.set('tiendaId', r.tiendaId);
  if (r.tallerId) qs.set('tallerId', r.tallerId);
  if (r.asesorIds.length) qs.set('asesorIds', r.asesorIds.join(','));
  if (r.disenadorIds.length) qs.set('disenadorIds', r.disenadorIds.join(','));
  return qs;
}

const hayFiltros = () => {
  const r = state.reporte;
  return !!(r.tiendaId || r.tallerId || r.asesorIds.length || r.disenadorIds.length);
};

// -----------------------------------------------------------------------
// Formato
// -----------------------------------------------------------------------
const horas = (h) => {
  if (h == null) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  return h < 48 ? `${fmtNum(h, 1)} h` : `${fmtNum(h / 24, 1)} d`;
};

function fechaHora(valor) {
  if (!valor) return '—';
  const [f, hora] = String(valor).split(' ');
  return `${f.slice(8, 10)}/${f.slice(5, 7)} ${(hora || '').slice(0, 5)}`;
}

function formatear(valor, formato) {
  switch (formato) {
    case 'num': return valor == null ? '—' : fmtNum(valor, 1);
    case 'pct': return fmtPct(valor);
    case 'dias': return fmtDias(valor);
    case 'horas': return horas(valor);
    case 'fechaHora': return fechaHora(valor);
    default: return valor == null || valor === '' ? '—' : escapeHtml(valor);
  }
}

// -----------------------------------------------------------------------
// Carga
// -----------------------------------------------------------------------
export async function cargarReportes() {
  const cont = $('#reportes-vista');
  armarEsqueleto(cont);
  const pedido = ++pedidoVigente;
  const cuerpo = $('#rep-cuerpo', cont);
  if (ultimaData) cuerpo.classList.add('is-refetching');
  try {
    const data = await obtenerReporte(construirQuery());
    if (pedido !== pedidoVigente) return;
    ultimaData = data;
    cuerpo.classList.remove('is-refetching');
    renderTodo(data);
  } catch (error) {
    if (pedido !== pedidoVigente) return;
    cuerpo.classList.remove('is-refetching');
    if (ultimaData) { window.toast?.error('Reportes', error.message); return; }
    cuerpo.innerHTML = `
      <div class="buzon-vacio buzon-vacio-error">
        <ion-icon name="alert-circle-outline"></ion-icon>
        <h3>No se pudo cargar el reporte</h3>
        <p>${escapeHtml(error.message)}</p>
        <button class="btn btn--ghost btn--sm" id="rep-reintentar" type="button">Reintentar</button>
      </div>`;
    $('#rep-reintentar', cuerpo).addEventListener('click', () => cargarReportes());
  }
}

function armarEsqueleto(cont) {
  if (cont.dataset.wired) return;
  cont.innerHTML = `
    <div class="rend-encabezado">
      <div>
        <h2 id="rep-titulo">Reportes</h2>
        <p class="rend-meta" id="rep-meta"></p>
      </div>
      <div class="rep-acciones">
        <button class="btn btn--ghost btn--sm" id="rep-actualizar" type="button"><ion-icon name="refresh-outline"></ion-icon> Actualizar</button>
        <button class="btn btn--primary btn--sm" id="rep-exportar" type="button"><ion-icon name="download-outline"></ion-icon> <span>Exportar PDF</span></button>
      </div>
    </div>
    <div class="rp-barra" id="rep-periodo"></div>
    <div class="rep-filtros" id="rep-filtros" hidden></div>
    <div class="rep-fichas" id="rep-fichas" hidden></div>
    <div class="rend-cuerpo" id="rep-cuerpo">
      <div class="buzon-vacio"><ion-icon name="sync-outline" class="spin-animation"></ion-icon><p>Calculando el reporte...</p></div>
    </div>`;
  barraPeriodo = crearBarraPeriodo($('#rep-periodo', cont), {
    obtener: () => state.reporte.ventana,
    alCambiar: (ventana) => { state.reporte.ventana = ventana; barraPeriodo.pintar(); cargarReportes(); }
  });
  $('#rep-actualizar', cont).addEventListener('click', () => cargarReportes());
  $('#rep-exportar', cont).addEventListener('click', exportarPdf);
  cont.dataset.wired = '1';
}

async function exportarPdf() {
  const boton = $('#rep-exportar');
  const etiqueta = $('span', boton);
  boton.disabled = true;
  etiqueta.textContent = 'Generando PDF…';
  try {
    const { blob, nombre } = await descargarReportePdf(construirQuery());
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    window.toast?.success('Reporte exportado', nombre);
  } catch (error) {
    window.toast?.error('No se pudo exportar', error.message);
  } finally {
    boton.disabled = false;
    etiqueta.textContent = 'Exportar PDF';
  }
}

// -----------------------------------------------------------------------
// Render
// -----------------------------------------------------------------------
function renderTodo(data) {
  ocultarTooltip();
  ocultarInfo();
  $('#rep-titulo').textContent = data.titulo;
  $('#rep-meta').textContent = `${data.periodo.etiqueta} · Actualizado ${new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
  renderFiltros(data);
  $('#rep-cuerpo').innerHTML = `
    <div class="rend-grid">
      ${data.grupos ? '<section class="rend-panel rend-span-12" id="rep-panel-grupos"></section>' : ''}
      ${!data.grupos && (data.tablas || []).length ? '<section class="rend-panel rend-span-12" id="rep-panel-tablas"></section>' : ''}
      ${!data.grupos && data.vales ? '<section class="rend-panel rend-span-12" id="rep-panel-vales"></section>' : ''}
    </div>
    <details class="rend-notas">
      <summary>Cómo funciona este reporte</summary>
      <ul>
        ${notasDelRol(data)}
      </ul>
    </details>`;
  if (data.grupos) renderGrupos(data); else { renderTablas(data); renderVales(data); }
}

// «Cómo funciona este reporte»: reglas del período y de la tabla.
function notasDelRol(data) {
  const reglas = [
    '<li><strong>Período:</strong> se elige con Hoy, Día, Semana (de lunes a domingo), Mes o Desde–Hasta. Cada acción cuenta en el día en que ocurrió.</li>'
  ];
  if (data.grupos) {
    reglas.push('<li><strong>Tabla:</strong> lista los vales <strong>creados</strong> en el período, agrupados por la persona, taller o tienda elegidos. Cada fila muestra cuántos vales creó, cuántos ya fueron autorizados y qué atención requieren (atrasados y sin propuesta). Al pulsarla se despliegan sus vales, ordenados por atraso, luego por el paso más bajo del pipeline y luego por los que aún no tienen propuesta.</li>');
  }
  return reglas.join('');
}

// -----------------------------------------------------------------------
// Filtros: agrupar por, tienda, taller, asesores y diseñadores
// -----------------------------------------------------------------------
function renderFiltros(data) {
  const cont = $('#rep-filtros');
  const f = data.filtros;
  if (!data.grupos) { cont.hidden = true; cont.innerHTML = ''; renderFichas(data); return; }
  const r = state.reporte;
  const agrupar = data.grupos.agruparPor;
  const permitidas = f.agrupaciones && f.agrupaciones.length ? f.agrupaciones : AGRUPACIONES.map(a => a.id);
  const disponibles = AGRUPACIONES.filter(a => permitidas.includes(a.id));
  const opciones = (lista, valor, vacio) => `<option value="">${vacio}</option>${lista.map(o => `<option value="${o.id}"${String(o.id) === String(valor) ? ' selected' : ''}>${escapeHtml(o.nombre)}</option>`).join('')}`;
  cont.hidden = false;
  cont.innerHTML = `
    <div class="rep-agrupar${disponibles.length > 1 ? '' : ' rep-agrupar--fijo'}" role="group" aria-label="Agrupar por">
      <ion-icon name="${ICONO_AGRUPAR[agrupar] || 'layers-outline'}" aria-hidden="true"></ion-icon>
      <span class="rep-filtro-rotulo">Agrupar por</span>
      ${disponibles.length > 1
        ? disponibles.map(a => `<button type="button" class="rp-segmento${a.id === agrupar ? ' is-activo' : ''}" data-agrupar="${a.id}" aria-pressed="${a.id === agrupar}">${a.texto}</button>`).join('')
        : `<span class="rep-agrupar-fijo">${escapeHtml((disponibles[0] || AGRUPACIONES.find(a => a.id === agrupar) || {}).texto || '')}</span>`}
    </div>
    <div class="rep-filtros-fila">
      ${f.tiendas.length ? `<select id="rep-f-tienda" class="filtro-tienda" aria-label="Filtrar por tienda">${opciones(f.tiendas, r.tiendaId, 'Todas las tiendas')}</select>` : ''}
      ${f.talleres.length ? `<select id="rep-f-taller" class="filtro-tienda" aria-label="Filtrar por taller">${opciones(f.talleres, r.tallerId, 'Todos los talleres')}</select>` : ''}
      <span id="rep-f-asesores"></span>
      <span id="rep-f-disenadores"></span>
      ${hayFiltros() ? '<button type="button" class="rep-link" id="rep-limpiar-filtros">Limpiar filtros</button>' : ''}
    </div>`;
  cont.querySelectorAll('[data-agrupar]').forEach(b => b.addEventListener('click', () => {
    if (r.agruparPor === b.dataset.agrupar) return;
    r.agruparPor = b.dataset.agrupar;
    r.expandidos.clear();
    cargarReportes();
  }));
  const tienda = $('#rep-f-tienda', cont);
  if (tienda) tienda.addEventListener('change', () => { r.tiendaId = tienda.value; r.expandidos.clear(); cargarReportes(); });
  const taller = $('#rep-f-taller', cont);
  if (taller) taller.addEventListener('change', () => { r.tallerId = taller.value; r.expandidos.clear(); cargarReportes(); });
  if (f.asesores.length) {
    crearSelectorMultiple($('#rep-f-asesores', cont), {
      uid: 'rep-sel-asesores', icono: 'people-outline', vacio: 'Todos los asesores', plural: ['asesor', 'asesores'],
      opciones: f.asesores, seleccion: r.asesorIds, alAplicar: (ids) => { r.asesorIds = ids; r.expandidos.clear(); cargarReportes(); }
    });
  }
  if (f.disenadores.length) {
    crearSelectorMultiple($('#rep-f-disenadores', cont), {
      uid: 'rep-sel-disenadores', icono: 'brush-outline', vacio: 'Todos los diseñadores', plural: ['diseñador', 'diseñadores'],
      opciones: f.disenadores, seleccion: r.disenadorIds, alAplicar: (ids) => { r.disenadorIds = ids; r.expandidos.clear(); cargarReportes(); }
    });
  }
  const limpiar = $('#rep-limpiar-filtros', cont);
  if (limpiar) limpiar.addEventListener('click', () => {
    Object.assign(r, { tiendaId: '', tallerId: '', asesorIds: [], disenadorIds: [] });
    r.expandidos.clear();
    cargarReportes();
  });
  renderFichas(data);
}

// Fichas de quién se evalúa (asesores o diseñadores elegidos), con × para quitar a cada uno.
function renderFichas(data) {
  const cont = $('#rep-fichas');
  const ev = data.evaluados || [];
  cont.hidden = !ev.length;
  if (!ev.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = `<span class="rep-fichas-rotulo">Evaluando a:</span>${ev.map(p => `<span class="rep-ficha">${escapeHtml(p.nombre)}<button type="button" data-quitar="${p.id}" aria-label="Quitar a ${escapeHtml(p.nombre)}"><ion-icon name="close" aria-hidden="true"></ion-icon></button></span>`).join('')}<button type="button" class="rep-link" id="rep-limpiar">Limpiar</button>`;
  const r = state.reporte;
  cont.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => {
    r.asesorIds = r.asesorIds.filter(id => String(id) !== b.dataset.quitar);
    r.disenadorIds = r.disenadorIds.filter(id => String(id) !== b.dataset.quitar);
    cargarReportes();
  }));
  $('#rep-limpiar', cont).addEventListener('click', () => { r.asesorIds = []; r.disenadorIds = []; cargarReportes(); });
}

// Tarjeta de indicador: etiqueta con un ícono de información (la explicación sale al pasar el ratón, enfocar o tocar),
// el valor y, si es el estado de ahora, una etiqueta «Ahora mismo».
let idInfo = 0;
function htmlKpi(k) {
  const alerta = k.malo && typeof k.valor === 'number' && k.valor > 0 && k.instantaneo;
  const id = `rep-info-${++idInfo}`;
  return `
    <article class="rend-kpi rep-kpi${alerta ? ' rend-kpi--alerta' : ''}">
      <header class="rep-kpi-cab">
        <p class="rend-kpi-etiqueta">${escapeHtml(k.label)}</p>
        ${k.ayuda ? `<button type="button" class="rep-info" data-info="${escapeHtml(k.ayuda)}" aria-label="¿Qué es «${escapeHtml(k.label)}»?" aria-describedby="${id}" aria-expanded="false"><ion-icon name="information-circle-outline" aria-hidden="true"></ion-icon></button><span id="${id}" class="sr-only">${escapeHtml(k.ayuda)}</span>` : ''}
      </header>
      <div class="rep-kpi-fila">
        <p class="rend-kpi-valor">${alerta ? '<ion-icon name="alert-circle" aria-hidden="true"></ion-icon>' : ''}${formatear(k.valor, k.formato)}</p>
        ${k.instantaneo ? '<span class="rep-kpi-ahora">Ahora</span>' : ''}
      </div>
    </article>`;
}

// Globo con la explicación de cada indicador: un solo elemento reutilizado. Se abre al pasar el ratón o enfocar, se
// alterna al tocar (celulares) y se cierra con Esc o al tocar fuera.
let globoInfo = null;
let botonInfo = null;

function ocultarInfo() {
  if (globoInfo) globoInfo.hidden = true;
  if (botonInfo) botonInfo.setAttribute('aria-expanded', 'false');
  botonInfo = null;
}

function mostrarInfo(boton) {
  if (!globoInfo) {
    globoInfo = document.createElement('div');
    globoInfo.className = 'rep-globo';
    globoInfo.setAttribute('role', 'tooltip');
    globoInfo.hidden = true;
    document.body.appendChild(globoInfo);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ocultarInfo(); });
    document.addEventListener('click', (e) => { if (botonInfo && !botonInfo.contains(e.target)) ocultarInfo(); });
  }
  if (botonInfo && botonInfo !== boton) botonInfo.setAttribute('aria-expanded', 'false');
  botonInfo = boton;
  boton.setAttribute('aria-expanded', 'true');
  globoInfo.textContent = boton.dataset.info;
  globoInfo.hidden = false;
  const r = boton.getBoundingClientRect();
  const ancho = Math.min(280, window.innerWidth - 24);
  globoInfo.style.width = `${ancho}px`;
  const izquierda = Math.min(Math.max(12, r.left + r.width / 2 - ancho / 2), window.innerWidth - ancho - 12);
  const alto = globoInfo.offsetHeight;
  const abajoCabe = r.bottom + 8 + alto <= window.innerHeight;
  globoInfo.style.left = `${izquierda}px`;
  globoInfo.style.top = `${abajoCabe ? r.bottom + 8 : Math.max(8, r.top - alto - 8)}px`;
}

function conectarInfoKpis(contenedor) {
  contenedor.querySelectorAll('.rep-info').forEach(b => {
    b.addEventListener('mouseenter', () => mostrarInfo(b));
    b.addEventListener('mouseleave', () => { if (!b.matches(':focus')) ocultarInfo(); });
    b.addEventListener('focus', () => mostrarInfo(b));
    b.addEventListener('blur', ocultarInfo);
    b.addEventListener('click', (e) => { e.stopPropagation(); mostrarInfo(b); });
  });
}

function cabeceraPanel(titulo, subtitulo, extra = '') {
  return `<header class="rend-panel-cab"><div><h3>${titulo}</h3><p>${subtitulo}</p></div>${extra}</header>`;
}

const vacio = (icono, titulo, texto) => `<div class="rend-vacio"><ion-icon name="${icono}"></ion-icon><h4>${titulo}</h4><p>${texto}</p></div>`;

// -----------------------------------------------------------------------
// Tabla unificada: personas con sus vales desplegables
// -----------------------------------------------------------------------
function htmlAtraso(v) {
  if (v.venceHoy) return '<span class="badge badge-hoy">Vence hoy</span>';
  if (v.atrasado) return `<span class="badge badge-atraso">${v.diasAtraso} d</span>`;
  return '<span class="badge badge-ok">Al día</span>';
}

function htmlPropuesta(v) {
  if (v.tienePropuesta) return '<span class="rep-propuesta rep-propuesta--si"><ion-icon name="checkmark-circle" aria-hidden="true"></ion-icon>Adjunta</span>';
  if (v.sinPropuesta) return '<span class="rep-propuesta rep-propuesta--no"><ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon>Sin propuesta</span>';
  return '<span class="rep-propuesta rep-propuesta--na">Aún no aplica</span>';
}

function htmlMiniTabla(g) {
  if (!g.vales.length) return '<p class="rep-sin-vales">Sin vales creados en este período.</p>';
  const filas = g.vales.map(v => `
    <tr>
      <td data-label="Vale"><strong>${escapeHtml(v.correlativo)}</strong>${v.esMod ? '<span class="badge badge-mod">MOD</span>' : ''}${v.urgente ? '<span class="badge badge-urgente">URGENTE</span>' : ''}<span class="rep-cliente">${escapeHtml(v.cliente)}</span></td>
      <td data-label="Estado">${celdaEstado(v)}</td>
      <td data-label="Entrega">${escapeHtml(formatearFecha(v.fechaEntrega))}</td>
      <td data-label="Atraso">${htmlAtraso(v)}</td>
      <td data-label="Propuesta">${htmlPropuesta(v)}</td>
      <td data-label="Acciones" class="rep-acciones-celda"><div class="rep-acciones-fila">
        <button type="button" class="btn-icon" data-ver="${v.id}" title="Ver vale" aria-label="Ver vale ${escapeHtml(v.correlativo)}"><ion-icon name="eye-outline"></ion-icon></button>
        ${v.urlPropuesta ? `<button type="button" class="btn-icon" data-propuesta="${escapeHtml(v.urlPropuesta)}" title="Ver propuesta" aria-label="Ver propuesta de ${escapeHtml(v.correlativo)}"><ion-icon name="document-attach-outline"></ion-icon></button>` : ''}
      </div></td>
    </tr>`).join('');
  return `<div class="rep-mini-wrap"><table class="rep-mini"><thead><tr><th>Vale</th><th>Estado</th><th>Entrega</th><th>Atraso</th><th>Propuesta</th><th>Acciones</th></tr></thead><tbody>${filas}</tbody></table></div>
    ${g.recortado ? '<p class="rep-nota">Se muestran los vales más urgentes; acota el período o los filtros para ver el resto.</p>' : ''}`;
}

function htmlGrupo(g, indice) {
  const abierto = state.reporte.expandidos.has(g.clave);
  const alertas = [
    g.atrasados ? `<span class="rep-chip rep-chip--alerta" title="Vales atrasados"><ion-icon name="alert-circle" aria-hidden="true"></ion-icon>${g.atrasados} atrasado${g.atrasados === 1 ? '' : 's'}</span>` : '',
    g.sinPropuesta ? `<span class="rep-chip rep-chip--aviso" title="Vales sin propuesta adjunta"><ion-icon name="document-outline" aria-hidden="true"></ion-icon>${g.sinPropuesta} sin propuesta</span>` : ''
  ].join('') || '<span class="rep-chip rep-chip--ok"><ion-icon name="checkmark-circle" aria-hidden="true"></ion-icon>Todo en orden</span>';
  return `
    <div class="rep-grupo${abierto ? ' is-abierto' : ''}" data-clave="${escapeHtml(g.clave)}">
      <button type="button" class="rep-grupo-cab" aria-expanded="${abierto}" aria-controls="rep-g-${indice}">
        <span class="rep-grupo-nombre"><ion-icon name="chevron-forward-outline" class="rep-chevron" aria-hidden="true"></ion-icon><span class="rep-avatar" aria-hidden="true">${escapeHtml(inicialesAvatar(g.nombre))}</span><strong>${escapeHtml(g.nombre)}</strong></span>
        <span class="rep-celda" data-label="Creados">${g.creados}</span>
        <span class="rep-celda" data-label="Autorizados">${g.autorizados}</span>
        <span class="rep-celda rep-celda--chips" data-label="Atención">${alertas}</span>
      </button>
      <div class="rep-grupo-cuerpo" id="rep-g-${indice}"${abierto ? '' : ' hidden'}>${abierto ? htmlMiniTabla(g) : ''}</div>
    </div>`;
}

function renderGrupos(data) {
  const panel = $('#rep-panel-grupos');
  const g = data.grupos;
  const info = AGRUPACIONES.find(a => a.id === g.agruparPor);
  const sub = `${g.totalVales} vale${g.totalVales === 1 ? '' : 's'} creado${g.totalVales === 1 ? '' : 's'} · ${g.grupos.length} ${g.grupos.length === 1 ? info.texto.toLowerCase() : info.plural}`;
  const acciones = g.grupos.length
    ? '<div class="rep-expandir"><button type="button" class="rep-link" id="rep-expandir-todo">Expandir todo</button><button type="button" class="rep-link" id="rep-contraer-todo">Contraer todo</button></div>'
    : '';
  if (!g.grupos.length) {
    panel.innerHTML = cabeceraPanel(`Vales por ${info.texto.toLowerCase()}`, sub) + vacio('document-text-outline', 'Sin vales creados en este período', 'Cambia el período o los filtros para ver otros vales.');
    return;
  }
  panel.innerHTML = `${cabeceraPanel(`Vales por ${info.texto.toLowerCase()}`, sub, acciones)}
    <div class="rep-tabla" role="list">
      <div class="rep-tabla-cab" aria-hidden="true"><span>${info.texto}</span><span>Creados</span><span>Autorizados</span><span>Atención</span></div>
      ${g.grupos.map(htmlGrupo).join('')}
    </div>
    ${g.truncado ? `<p class="rep-nota">Hay ${g.totalVales} vales; se muestran los más urgentes. Acota el período o los filtros para ver el resto.</p>` : ''}`;

  const porClave = new Map(g.grupos.map(x => [x.clave, x]));
  const alternar = (el, abrir) => {
    const clave = el.dataset.clave;
    const cuerpo = $('.rep-grupo-cuerpo', el);
    const boton = $('.rep-grupo-cab', el);
    if (abrir) { state.reporte.expandidos.add(clave); cuerpo.innerHTML = htmlMiniTabla(porClave.get(clave)); conectarAcciones(cuerpo); }
    else state.reporte.expandidos.delete(clave);
    cuerpo.hidden = !abrir;
    boton.setAttribute('aria-expanded', String(abrir));
    el.classList.toggle('is-abierto', abrir);
  };
  panel.querySelectorAll('.rep-grupo').forEach(el => {
    $('.rep-grupo-cab', el).addEventListener('click', () => alternar(el, $('.rep-grupo-cab', el).getAttribute('aria-expanded') !== 'true'));
    if (state.reporte.expandidos.has(el.dataset.clave)) conectarAcciones($('.rep-grupo-cuerpo', el));
  });
  const todo = $('#rep-expandir-todo', panel);
  if (todo) todo.addEventListener('click', () => panel.querySelectorAll('.rep-grupo').forEach(el => alternar(el, true)));
  const nada = $('#rep-contraer-todo', panel);
  if (nada) nada.addEventListener('click', () => panel.querySelectorAll('.rep-grupo').forEach(el => alternar(el, false)));
}

// Acciones de cada vale desplegado: ver el vale (PDF) y ver su propuesta.
function conectarAcciones(cuerpo) {
  cuerpo.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => window.open(`/api/vales/${b.dataset.ver}/pdf`, '_blank')));
  cuerpo.querySelectorAll('[data-propuesta]').forEach(b => b.addEventListener('click', () => window.open(b.dataset.propuesta, '_blank', 'noopener')));
}

// -----------------------------------------------------------------------
// Vista simple (Asesor y Diseñador)
// -----------------------------------------------------------------------
function renderTablas(data) {
  const panel = $('#rep-panel-tablas');
  const tablas = (data.tablas || []).filter(t => t.filas.length);
  if (!panel) return;
  if (!tablas.length) {
    panel.innerHTML = cabeceraPanel('Por persona', 'Comparativo del período') + vacio('people-outline', 'Sin actividad de personas', 'Aún no hay acciones en este período.');
    return;
  }
  if (!tablas.some(t => t.clave === tablaActiva)) tablaActiva = tablas[0].clave;
  const actual = tablas.find(t => t.clave === tablaActiva);
  const filas = actual.filas.map(f => `<tr>
      <td data-label="${escapeHtml(actual.titulo)}"><strong>${escapeHtml(f.nombre)}</strong></td>
      ${actual.columnas.map(c => `<td class="rend-num" data-label="${escapeHtml(c.label)}">${formatear(f[c.clave], c.formato)}</td>`).join('')}
    </tr>`).join('');
  panel.innerHTML = `${cabeceraPanel(actual.titulo, 'Comparativo del período')}
    <div class="rend-tabla-wrap"><table class="rend-tabla"><thead><tr><th>${escapeHtml(actual.titulo.replace('Por ', '').replace(/^./, c => c.toUpperCase()))}</th>${actual.columnas.map(c => `<th class="rend-num">${escapeHtml(c.label)}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table></div>`;
}

function renderVales(data) {
  const panel = $('#rep-panel-vales');
  const v = data.vales;
  if (!panel || !v) return;
  const sub = v.total ? `${v.total} vale${v.total === 1 ? '' : 's'} con actividad en el período` : 'Vales con actividad en el período';
  if (!v.filas.length) {
    panel.innerHTML = cabeceraPanel('Vales del período', sub) + vacio('document-text-outline', 'Sin vales en este período', 'No hubo actividad registrada.');
    return;
  }
  const filas = v.filas.map(f => `
    <tr>
      <td data-label="Correlativo"><strong>${escapeHtml(f.correlativo)}</strong>${f.esMod ? '<span class="badge badge-mod">MOD</span>' : ''}</td>
      <td data-label="Cliente">${escapeHtml(f.cliente)}</td>
      <td data-label="Entrega">${f.fechaEntrega.slice(8, 10)}/${f.fechaEntrega.slice(5, 7)}${f.atrasado && f.diasAtraso >= 1 ? `<span class="badge badge-atraso">${f.diasAtraso}d</span>` : ''}</td>
      <td data-label="Estado">${escapeHtml(ESTADOS_LABEL[f.estado] || f.estado)}</td>
      ${v.columnas.map(c => `<td class="rend-num" data-label="${escapeHtml(c.label)}">${formatear(f[c.clave], c.formato)}</td>`).join('')}
      <td data-label="Historial"><button type="button" class="btn-icon" data-historial="${f.id}" data-correlativo="${escapeHtml(f.correlativo)}" title="Ver historial" aria-label="Ver historial de ${escapeHtml(f.correlativo)}"><ion-icon name="time-outline"></ion-icon></button></td>
    </tr>`).join('');
  panel.innerHTML = `${cabeceraPanel('Vales del período', sub)}
    <div class="rend-tabla-wrap"><table class="rend-tabla"><thead><tr><th>Correlativo</th><th>Cliente</th><th>Entrega</th><th>Estado</th>${v.columnas.map(c => `<th class="rend-num">${escapeHtml(c.label)}</th>`).join('')}<th></th></tr></thead><tbody>${filas}</tbody></table></div>
    ${v.truncado ? `<p class="rep-nota">Se muestran los primeros ${v.filas.length} de ${v.total}. Exporta el PDF para ver más (hasta 500) o acota el período.</p>` : ''}`;
  panel.querySelectorAll('[data-historial]').forEach(b => b.addEventListener('click', () => abrirModalHistorial({ id: Number(b.dataset.historial), correlativo: b.dataset.correlativo })));
}
