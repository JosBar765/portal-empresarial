import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { escapeHtml, formatearFecha, formatearFechaHora, inicialesAvatar } from '../utils/formato.js';
import { ESTADOS_LABEL } from '../config/estados.js';
import { obtenerReporte, descargarReportePdf } from '../api/valesApi.js';
import { abrirModalHistorial } from '../actions/historial.js';
import { celdaEstado } from '../components/pipeline.js';
import { abrirVisorVale } from '../components/visorDocumento.js';
import { htmlBloqueVigentes, conectarBloqueVigentes } from '../components/atrasadosVigentes.js';
import { htmlGraficaBarrasDobles } from '../components/graficaBarrasDobles.js';
import { htmlTablaRendimiento } from '../components/tablaRendimiento.js';
import { crearMenuExportar } from '../components/menuExportar.js';
import { crearBarraPeriodo, aplicarPeriodoAQuery } from '../components/barraPeriodoReportes.js';
import { crearSelectorMultiple } from '../components/selectorMultiple.js';

// -----------------------------------------------------------------------
// Reportes de actividad. Quienes ven a varias personas (Gerente, Administrador, Supervisor y Encargado/Asistente) reciben
// una tabla unificada: personas (o talleres/tiendas) con sus vales con entrega en el período, que se despliegan al pulsar
// la fila. Asesor y Diseñador ven su propio listado. El alcance lo decide el servidor según el rol.
// -----------------------------------------------------------------------

let pedidoVigente = 0;
let ultimaData = null;
let barraPeriodo = null;
let tablaActiva = '';
let menuExportar = null;

// Pestaña del reporte (solo Encargado/Asistente y Supervisor tienen «Rendimiento»); se recuerda la última.
const CLAVE_VISTA_REPORTE = 'vales:repVista';
const leerVista = () => { try { return localStorage.getItem(CLAVE_VISTA_REPORTE) === 'rendimiento' ? 'rendimiento' : 'actividad'; } catch { return 'actividad'; } };
const guardarVista = (vista) => { try { localStorage.setItem(CLAVE_VISTA_REPORTE, vista); } catch { /* sin almacenamiento */ } };

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
const fmtNum = (n, dec = 0) => (n == null ? '—' : Number(n).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: dec }));
const fmtPct = (n) => (n == null ? '—' : `${fmtNum(n, 1)}%`);
const fmtDias = (n) => (n == null ? '—' : `${fmtNum(n, 1)} d`);

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
  if (!state.reporte.vista) state.reporte.vista = leerVista();
  const cont = $('#reportes-vista');
  armarEsqueleto(cont);
  if (barraPeriodo) barraPeriodo.pintar();
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
        <div class="rep-exportar" id="rep-exportar-cont"></div>
      </div>
    </div>
    <div class="rep-tabs" id="rep-tabs" role="tablist" aria-label="Tipo de reporte" hidden></div>
    <div class="rp-barra" id="rep-periodo"></div>
    <div class="rep-filtros" id="rep-filtros" hidden></div>
    <div class="rep-fichas" id="rep-fichas" hidden></div>
    <div class="rend-cuerpo" id="rep-cuerpo" role="tabpanel">
      <div class="buzon-vacio"><ion-icon name="sync-outline" class="spin-animation"></ion-icon><p>Calculando el reporte...</p></div>
    </div>`;
  barraPeriodo = crearBarraPeriodo($('#rep-periodo', cont), {
    obtener: () => state.reporte.ventana,
    alCambiar: (ventana) => { state.reporte.ventana = ventana; barraPeriodo.pintar(); cargarReportes(); }
  });
  $('#rep-actualizar', cont).addEventListener('click', () => cargarReportes());
  menuExportar = crearMenuExportar($('#rep-exportar-cont', cont), { alElegir: exportarPdf });
  menuExportar.configurar([{ id: 'actividad', icono: 'list-outline', titulo: 'Reporte de actividad', detalle: '' }], 'actividad');
  cont.dataset.wired = '1';
}

async function exportarPdf(tipo = 'actividad') {
  menuExportar.ocupado(true);
  try {
    const qs = construirQuery();
    qs.set('tipo', tipo);
    const { blob, nombre } = await descargarReportePdf(qs);
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
    menuExportar.ocupado(false);
    if (ultimaData) configurarExportacion(ultimaData, vistaActual(ultimaData));
    $('#rep-exportar')?.focus();
  }
}

// Opciones del menú de descarga según el rol: Rendimiento solo existe para Encargado/Asistente y Supervisor.
function configurarExportacion(data, vista) {
  const opciones = [{ id: 'actividad', icono: 'list-outline', titulo: 'Reporte de actividad', detalle: 'Vales atrasados, no entregados y entregados' }];
  if (data.grupos && data.grupos.rendimiento) {
    opciones.push({ id: 'rendimiento', icono: 'bar-chart-outline', titulo: 'Reporte de rendimiento', detalle: 'Contadores, gráfica y tabla comparativa por persona' });
  }
  menuExportar.configurar(opciones, vista);
}

const vistaActual = (data) => (data.grupos && data.grupos.rendimiento && state.reporte.vista === 'rendimiento' ? 'rendimiento' : 'actividad');

// Pestañas «Actividad | Rendimiento» (roles con Rendimiento). Actividad muestra cuántos vales piden atención.
function renderTabs(data, vista) {
  const cont = $('#rep-tabs');
  const hay = !!(data.grupos && data.grupos.rendimiento);
  cont.hidden = !hay;
  $('#rep-cuerpo').setAttribute('aria-labelledby', hay ? `rep-tab-${vista}` : '');
  if (!hay) { cont.innerHTML = ''; return; }
  const atencion = ((data.atrasadosVigentes && data.atrasadosVigentes.total) || 0) + (data.grupos.secciones.atrasados.total || 0);
  const tabs = [
    { id: 'actividad', texto: 'Actividad', icono: 'list-outline', n: atencion },
    { id: 'rendimiento', texto: 'Rendimiento', icono: 'bar-chart-outline', n: 0 }
  ];
  cont.innerHTML = tabs.map(t => `
    <button type="button" role="tab" class="rep-tab${t.id === vista ? ' is-activa' : ''}" id="rep-tab-${t.id}" data-vista="${t.id}" aria-selected="${t.id === vista}" aria-controls="rep-cuerpo" tabindex="${t.id === vista ? '0' : '-1'}">
      <ion-icon name="${t.icono}" aria-hidden="true"></ion-icon>${t.texto}${t.n ? `<span class="rep-tab-n" title="${t.n} vale${t.n === 1 ? '' : 's'} atrasado${t.n === 1 ? '' : 's'}">${t.n}</span>` : ''}
    </button>`).join('');
  const cambiar = (id, enfocar = false) => {
    if (id === vistaActual(data)) return;
    state.reporte.vista = id;
    guardarVista(id);
    renderTodo(ultimaData);
    if (enfocar) $(`#rep-tab-${id}`)?.focus();
  };
  cont.querySelectorAll('[role="tab"]').forEach(tab => {
    tab.addEventListener('click', () => cambiar(tab.dataset.vista));
    tab.addEventListener('keydown', (e) => {
      const orden = tabs.map(t => t.id);
      const i = orden.indexOf(tab.dataset.vista);
      let destino = null;
      if (e.key === 'ArrowRight') destino = orden[(i + 1) % orden.length];
      else if (e.key === 'ArrowLeft') destino = orden[(i - 1 + orden.length) % orden.length];
      else if (e.key === 'Home') destino = orden[0];
      else if (e.key === 'End') destino = orden[orden.length - 1];
      if (destino) { e.preventDefault(); cambiar(destino, true); }
    });
  });
}

// -----------------------------------------------------------------------
// Render
// -----------------------------------------------------------------------
function renderTodo(data) {
  const vista = vistaActual(data);
  $('#rep-titulo').textContent = vista === 'rendimiento' ? data.titulo.replace(/^Actividad/, 'Rendimiento') : data.titulo;
  vistaTaller = data.rol === 'encargado';
  $('#rep-meta').textContent = `${data.periodo.titulo || data.periodo.etiqueta} · Actualizado ${new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
  renderFiltros(data, vista);
  renderTabs(data, vista);
  configurarExportacion(data, vista);
  if (vista === 'rendimiento') {
    $('#rep-cuerpo').innerHTML = `
      ${data.grupos.indicadoresTaller ? htmlIndicadoresTaller(data.grupos.indicadoresTaller) : ''}
      ${htmlGraficaBarrasDobles(data.grupos.rendimiento)}
      ${htmlTablaRendimiento(data.grupos.rendimiento)}
      <details class="rend-notas">
        <summary>Cómo funciona este reporte</summary>
        <ul>${notasRendimiento(data)}</ul>
      </details>`;
    return;
  }
  $('#rep-cuerpo').innerHTML = `
    ${htmlAtrasadosVigentes(data.atrasadosVigentes)}
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
  conectarAtrasadosVigentes($('#rep-cuerpo'));
  if (data.grupos) renderGrupos(data); else { renderTablas(data); renderVales(data); }
}

// Notas del reporte de rendimiento.
function notasRendimiento(data) {
  const entregado = data.rol === 'encargado'
    ? '<strong>Asignados / Entregados:</strong> vales con fecha de entrega en el período asignados a cada diseñador (y a ti) y, de ellos, los que su propuesta ya salió a revisión o está aprobada.'
    : '<strong>Creados / Autorizados:</strong> vales con fecha de entrega en el período creados por cada asesor (y por ti) y, de ellos, los que ya fueron autorizados.';
  return `<li>${entregado}</li>
    <li><strong>%:</strong> la segunda cifra entre la primera.</li>
    ${data.rol === 'encargado'
      ? '<li><strong>Entregas tarde:</strong> de los entregados, los que tienen atraso en su taller (aprobados con atraso, o en revisión ya atrasados). <strong>% a tiempo:</strong> entregados sin atraso entre entregados. <strong>Sin entregar:</strong> asignados de la ventana que esa persona aún no entrega (asignados menos entregados).</li>'
      : '<li><strong>Atrasados:</strong> vales abiertos del período con fecha de entrega vencida (hasta hoy).</li>'}
    <li>El período y los filtros de tienda, taller y personas se aplican igual que en Actividad.</li>`;
}

// «Atrasados vigentes»: los vales atrasados y abiertos con entrega fuera del período elegido (con los mismos filtros de alcance).
// Panel plegable al inicio; la tabla de abajo sigue siendo solo del período.
const CLAVE_VIGENTES_REPORTE = 'vales:repVigentesPlegado';
const leerPlegadoVigentes = () => { try { return localStorage.getItem(CLAVE_VIGENTES_REPORTE) === '1'; } catch { return false; } };

function htmlAtrasadosVigentes(av) {
  if (!av || !av.total) return '';
  return htmlBloqueVigentes({
    id: 'rep-vigentes', total: av.total, truncado: av.truncado, plegado: leerPlegadoVigentes(),
    textoPeriodo: 'abiertos, con entrega anterior al período elegido',
    items: av.vales.map(v => ({
      correlativo: v.correlativo, esMod: false, sub: v.responsable || '', pipeline: v.pipeline, fechaEntrega: v.fechaEntrega, diasAtraso: v.diasAtraso,
      accionesHtml: `<button type="button" class="btn-icon" data-ver="${v.id}" data-correlativo="${escapeHtml(v.correlativo)}"${v.tienePropuesta ? ' data-con-propuesta="1"' : ''} title="Ver vale" aria-label="Ver vale ${escapeHtml(v.correlativo)}"><ion-icon name="eye-outline"></ion-icon></button>`
    }))
  });
}

function conectarAtrasadosVigentes(cont) {
  const panel = $('#rep-vigentes', cont);
  if (!panel) return;
  conectarBloqueVigentes(panel, (plegado) => {
    try { localStorage.setItem(CLAVE_VIGENTES_REPORTE, plegado ? '1' : '0'); } catch { /* sin almacenamiento: no se recuerda */ }
  });
  conectarAcciones(panel);
}

// «Cómo funciona este reporte»: reglas del período y de la tabla.
function notasDelRol(data) {
  const reglas = [
    '<li><strong>Período:</strong> se elige con Hoy, Día, Semana (de lunes a domingo), Mes o Desde–Hasta, y siempre filtra por la <strong>fecha de entrega</strong> de los vales.</li>'
  ];
  if (data.grupos) {
    reglas.push('<li><strong>Tabla:</strong> lista los vales con <strong>fecha de entrega</strong> en el período, agrupados por la persona, taller o tienda elegidos. Cada fila muestra cuántos vales tiene, cuántos ya fueron autorizados y qué atención requieren (atrasados y sin propuesta). Al pulsarla se despliegan sus vales, con los que aún no están asignados primero y luego ordenados por atraso, por el paso más bajo del pipeline y luego por los que aún no tienen propuesta.</li>');
  }
  if (data.grupos && data.grupos.indicadoresTaller) {
    reglas.push('<li><strong>Indicadores del taller:</strong> <em>Entrantes</em> son los vales del período que ya llegaron a tus talleres; <em>Entregados</em>, los que tu taller ya terminó (enviados a revisión o aprobados); <em>Efectividad</em>, entregados ÷ entrantes; <em>A tiempo</em>, los entregados a revisión en o antes de su fecha de entrega ÷ entregados; <em>Atrasados</em>, los vales del período con fecha de entrega vencida que tu taller aún no termina.</li>');
  }
  return reglas.join('');
}

// Franja de indicadores de la vista Taller (Encargado/Asistente). Cada uno explica su definición al pasar o enfocar el ícono.
const porcentaje = (n) => (n == null ? '—' : `${String(n).replace('.', ',')} %`);
// Color de un porcentaje: rojo por debajo de 50 %, amarillo por debajo de 90 %.
const tonoPorcentaje = (n) => (n == null ? '' : (n < 50 ? 'rojo' : (n < 90 ? 'amarillo' : '')));
function htmlIndicadoresTaller(i) {
  const tarjetas = [
    { etiqueta: 'Entrantes', valor: i.entrantes, ayuda: 'Vales con fecha de entrega en la ventana de tiempo que ya llegaron a tus talleres.' },
    { etiqueta: 'Entregados', valor: i.entregados, ayuda: 'De los entrantes, los que tu taller ya entregó (propuesta en revisión o aprobada), con atraso o sin él.' },
    { etiqueta: 'Sin entregar', valor: i.sinEntregar, ayuda: 'De los entrantes, los que tu taller aún no entrega.' },
    { etiqueta: 'Atrasados sin entregar', valor: i.atrasadosSinEntregar, tono: i.atrasadosSinEntregar > 0 ? 'rojo' : '', ayuda: 'Vales atrasados que se arrastran de antes de la ventana de tiempo y que tu taller aún no entrega.' },
    { etiqueta: '% efectividad', valor: porcentaje(i.efectividad), tono: tonoPorcentaje(i.efectividad), ayuda: 'Entregados entre entrantes. Amarillo por debajo de 90 %, rojo por debajo de 50 %.' },
    { etiqueta: '% entregas a tiempo', valor: porcentaje(i.aTiempo), tono: tonoPorcentaje(i.aTiempo), ayuda: 'Entregados sin atraso en tu taller entre entregados (el atraso termina cuando el Encargado aprueba). Amarillo por debajo de 90 %, rojo por debajo de 50 %.' }
  ];
  return `<section class="rep-ind" aria-label="Indicadores del taller">${tarjetas.map(t => `
    <article class="rep-ind-tarjeta${t.tono === 'rojo' ? ' rep-ind-tarjeta--alerta' : (t.tono === 'amarillo' ? ' rep-ind-tarjeta--aviso' : '')}">
      <header><p>${t.etiqueta}</p><button type="button" class="rep-info" data-info="${escapeHtml(t.ayuda)}" aria-label="¿Qué es «${t.etiqueta}»? ${escapeHtml(t.ayuda)}"><ion-icon name="information-circle-outline" aria-hidden="true"></ion-icon></button></header>
      <strong>${t.valor}</strong>
    </article>`).join('')}</section>`;
}

// -----------------------------------------------------------------------
// Filtros: agrupar por, tienda, taller, asesores y diseñadores
// -----------------------------------------------------------------------
function renderFiltros(data, vista = 'actividad') {
  const cont = $('#rep-filtros');
  const f = data.filtros;
  if (!data.grupos) { cont.hidden = true; cont.innerHTML = ''; renderFichas(data); return; }
  const r = state.reporte;
  const agrupar = data.grupos.agruparPor;
  const permitidas = f.agrupaciones && f.agrupaciones.length ? f.agrupaciones : AGRUPACIONES.map(a => a.id);
  const disponibles = AGRUPACIONES.filter(a => permitidas.includes(a.id));
  // El selector de diseñadores solo lista a quienes trabajan en el taller elegido (si hay uno).
  const tallerElegido = Number(r.tallerId) || null;
  const delTaller = (d) => !tallerElegido || !d.tallerIds || d.tallerIds.includes(tallerElegido);
  const disenadoresVisibles = f.disenadores.filter(delTaller);
  const opciones = (lista, valor, vacio) => `<option value="">${vacio}</option>${lista.map(o => `<option value="${o.id}"${String(o.id) === String(valor) ? ' selected' : ''}>${escapeHtml(o.nombre)}</option>`).join('')}`;
  cont.hidden = false;
  cont.innerHTML = `
    ${vista === 'rendimiento' ? '' : `<div class="rep-agrupar${disponibles.length > 1 ? '' : ' rep-agrupar--fijo'}" role="group" aria-label="Agrupar por">
      <ion-icon name="${ICONO_AGRUPAR[agrupar] || 'layers-outline'}" aria-hidden="true"></ion-icon>
      <span class="rep-filtro-rotulo">Agrupar por</span>
      ${disponibles.length > 1
        ? disponibles.map(a => `<button type="button" class="rp-segmento${a.id === agrupar ? ' is-activo' : ''}" data-agrupar="${a.id}" aria-pressed="${a.id === agrupar}">${a.texto}</button>`).join('')
        : `<span class="rep-agrupar-fijo">${escapeHtml((disponibles[0] || AGRUPACIONES.find(a => a.id === agrupar) || {}).texto || '')}</span>`}
    </div>`}
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
  if (taller) taller.addEventListener('change', () => {
    r.tallerId = taller.value;
    // Las personas elegidas que no trabajan en el nuevo taller se quitan de la selección.
    const nuevo = Number(r.tallerId) || null;
    if (nuevo) r.disenadorIds = r.disenadorIds.filter(id => { const d = f.disenadores.find(x => x.id === id); return !d || !d.tallerIds || d.tallerIds.includes(nuevo); });
    r.expandidos.clear();
    cargarReportes();
  });
  if (f.asesores.length) {
    crearSelectorMultiple($('#rep-f-asesores', cont), {
      uid: 'rep-sel-asesores', icono: 'people-outline', vacio: 'Todos los asesores', plural: ['asesor', 'asesores'],
      opciones: f.asesores, seleccion: r.asesorIds, alAplicar: (ids) => { r.asesorIds = ids; r.expandidos.clear(); cargarReportes(); }
    });
  }
  if (disenadoresVisibles.length) {
    crearSelectorMultiple($('#rep-f-disenadores', cont), {
      uid: 'rep-sel-disenadores', icono: 'brush-outline', vacio: 'Todos los diseñadores', plural: ['diseñador', 'diseñadores'],
      opciones: disenadoresVisibles, seleccion: r.disenadorIds, alAplicar: (ids) => { r.disenadorIds = ids; r.expandidos.clear(); cargarReportes(); }
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

// Entregado: si llegó con atraso acumulado en su taller, se remarca en amarillo; si no, «Al día».
function htmlAtrasoEntregado(v) {
  return v.diasTarde >= 1 ? `<span class="badge badge-tarde" title="Entregado con atraso">${v.diasTarde} d</span>` : '<span class="badge badge-ok">Al día</span>';
}

function htmlPropuesta(v) {
  if (v.tienePropuesta) return '<span class="rep-propuesta rep-propuesta--si"><ion-icon name="checkmark-circle" aria-hidden="true"></ion-icon>Adjunta</span>';
  if (v.sinPropuesta) return '<span class="rep-propuesta rep-propuesta--no"><ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon>Sin propuesta</span>';
  return '<span class="rep-propuesta rep-propuesta--na">Aún no aplica</span>';
}

let vistaTaller = false;


// Columnas según la sección: atrasados muestran el Atraso; los entregados ya no necesitan Atraso ni Propuesta.
function htmlMiniTabla(g) {
  if (!g.vales.length) return '<p class="rep-sin-vales">Sin vales con entrega en este período.</p>';
  const sec = g.seccion || 'noEntregados';
  const conAtraso = sec === 'atrasados' || (vistaTaller && sec === 'entregados');
  const conPropuesta = sec !== 'entregados';
  const filas = g.vales.map(v => `
    <tr>
      <td data-label="Vale"><strong>${escapeHtml(v.correlativo)}</strong>${v.esMod ? '<span class="badge badge-mod">MOD</span>' : ''}${v.urgente ? '<span class="badge badge-urgente">URGENTE</span>' : ''}${vistaTaller ? '' : `<span class="rep-cliente">${escapeHtml(v.cliente)}</span>`}</td>
      ${vistaTaller ? `<td data-label="Fecha de ingreso">${escapeHtml(formatearFechaHora(v.creadoEn))}</td>` : ''}
      <td data-label="Estado">${celdaEstado(v)}</td>
      <td data-label="Entrega">${escapeHtml(formatearFecha(v.fechaEntrega))}</td>
      ${conAtraso ? `<td data-label="Atraso">${sec === 'entregados' ? htmlAtrasoEntregado(v) : htmlAtraso(v)}</td>` : ''}
      ${conPropuesta ? `<td data-label="Propuesta">${htmlPropuesta(v)}</td>` : ''}
      <td data-label="Acciones" class="rep-acciones-celda"><div class="rep-acciones-fila">
        <button type="button" class="btn-icon" data-ver="${v.id}" data-correlativo="${escapeHtml(v.correlativo)}"${v.tienePropuesta ? ' data-con-propuesta="1"' : ''} title="Ver vale" aria-label="Ver vale ${escapeHtml(v.correlativo)}"><ion-icon name="eye-outline"></ion-icon></button>
      </div></td>
    </tr>`).join('');
  return `<div class="rep-mini-wrap"><table class="rep-mini"><thead><tr><th>Vale</th>${vistaTaller ? '<th>Fecha de ingreso</th>' : ''}<th>Estado</th><th>Entrega</th>${conAtraso ? '<th>Atraso</th>' : ''}${conPropuesta ? '<th>Propuesta</th>' : ''}<th>Acciones</th></tr></thead><tbody>${filas}</tbody></table></div>
    ${g.recortado ? '<p class="rep-nota">Se muestran los vales más urgentes; acota el período o los filtros para ver el resto.</p>' : ''}`;
}

// Fila de una persona: nombre, cuántos vales y solo lo que pide atención (sin repetir lo que ya dice la sección).
function htmlGrupo(g, indice) {
  const abierto = state.reporte.expandidos.has(g.clave);
  const alertas = g.seccion !== 'entregados' && g.sinPropuesta
    ? `<span class="rep-chip rep-chip--aviso" title="Vales sin propuesta adjunta"><ion-icon name="document-outline" aria-hidden="true"></ion-icon>${g.sinPropuesta} sin propuesta</span>`
    : '';
  return `
    <div class="rep-grupo${abierto ? ' is-abierto' : ''}" data-clave="${escapeHtml(g.clave)}">
      <button type="button" class="rep-grupo-cab" aria-expanded="${abierto}" aria-controls="rep-g-${indice}">
        <span class="rep-grupo-nombre"><ion-icon name="chevron-forward-outline" class="rep-chevron" aria-hidden="true"></ion-icon><span class="rep-avatar" aria-hidden="true">${escapeHtml(inicialesAvatar(g.nombre))}</span><strong>${escapeHtml(g.nombre)}</strong></span>
        <span class="rep-celda rep-celda--n">${g.total} vale${g.total === 1 ? '' : 's'}</span>
        <span class="rep-celda rep-celda--chips">${alertas}</span>
      </button>
      <div class="rep-grupo-cuerpo" id="rep-g-${indice}"${abierto ? '' : ' hidden'}>${abierto ? htmlMiniTabla(g) : ''}</div>
    </div>`;
}

// Secciones del reporte (tras «Atrasados antes del período»): cada una plegable, con su contador.
const SECCIONES_REPORTE = [
  { clave: 'atrasados', titulo: 'Atrasados en el período', icono: 'alert-circle', sub: 'Entrega en el período, vencidos y aún abiertos' },
  { clave: 'noEntregados', titulo: 'No entregados', icono: 'time-outline', sub: 'En curso y dentro del plazo' },
  { clave: 'entregados', titulo: 'Entregados', icono: 'checkmark-circle', sub: '' }
];
const leerSeccionPlegada = (clave) => {
  try {
    const guardado = localStorage.getItem(`vales:repSec:${clave}`);
    if (guardado !== null) return guardado === '1';
  } catch { /* sin almacenamiento */ }
  return clave === 'entregados'; // lo ya resuelto arranca plegado (el contador sigue visible)
};
const guardarSeccionPlegada = (clave, plegada) => { try { localStorage.setItem(`vales:repSec:${clave}`, plegada ? '1' : '0'); } catch { /* sin almacenamiento */ } };

function htmlSeccion({ clave, titulo, icono, sub, total, cuerpo }) {
  const plegada = leerSeccionPlegada(clave);
  return `
    <section class="rep-seccion rep-seccion--${clave}" data-seccion="${clave}" aria-label="${escapeHtml(titulo)}">
      <button type="button" class="rep-seccion-cab" aria-expanded="${!plegada}" aria-controls="rep-sec-${clave}">
        <ion-icon name="${icono}" class="rep-seccion-icono" aria-hidden="true"></ion-icon>
        <span class="rep-seccion-titulo">${escapeHtml(titulo)}</span>
        <span class="rep-seccion-n">${total}</span>
        <span class="rep-seccion-sub">${escapeHtml(sub)}</span>
        <ion-icon name="chevron-down-outline" class="rep-seccion-chevron" aria-hidden="true"></ion-icon>
      </button>
      <div class="rep-seccion-cuerpo" id="rep-sec-${clave}"${plegada ? ' hidden' : ''}>${cuerpo}</div>
    </section>`;
}

function conectarSecciones(panel) {
  panel.querySelectorAll('.rep-seccion').forEach(sec => {
    const cab = $('.rep-seccion-cab', sec);
    cab.addEventListener('click', () => {
      const abrir = cab.getAttribute('aria-expanded') !== 'true';
      cab.setAttribute('aria-expanded', String(abrir));
      $('.rep-seccion-cuerpo', sec).hidden = !abrir;
      guardarSeccionPlegada(sec.dataset.seccion, !abrir);
    });
  });
}

function renderGrupos(data) {
  const panel = $('#rep-panel-grupos');
  const g = data.grupos;
  const info = AGRUPACIONES.find(a => a.id === g.agruparPor);
  const secciones = SECCIONES_REPORTE.map(def => ({ ...def, ...g.secciones[def.clave] })).filter(x => x.total > 0);
  const subEntregados = vistaTaller ? 'Tu taller ya entregó la propuesta' : 'Ya llegaron al asesor';
  const personas = new Set(secciones.flatMap(x => x.grupos.map(gr => gr.id))).size;
  const sub = `${g.totalVales} vale${g.totalVales === 1 ? '' : 's'} · ${personas} ${personas === 1 ? info.texto.toLowerCase() : info.plural}`;
  const acciones = secciones.length
    ? '<div class="rep-expandir"><button type="button" class="rep-link" id="rep-expandir-todo">Expandir todo</button><button type="button" class="rep-link" id="rep-contraer-todo">Contraer todo</button></div>'
    : '';
  if (!secciones.length) {
    panel.innerHTML = cabeceraPanel(`Vales por ${info.texto.toLowerCase()}`, sub) + vacio('document-text-outline', 'Sin vales con entrega en este período', 'Cambia el período o los filtros para ver otros vales.');
    return;
  }
  // La misma persona puede estar en varias secciones: su clave lleva la sección para recordar qué filas están abiertas.
  const porClave = new Map();
  const htmlTabla = (sec) => {
    const grupos = sec.grupos.map(gr => ({ ...gr, seccion: sec.clave, clave: `${sec.clave}|${gr.clave}` }));
    grupos.forEach(gr => porClave.set(gr.clave, gr));
    return `<div class="rep-tabla rep-tabla--simple" role="list" aria-label="${escapeHtml(info.plural)}">
      ${grupos.map((gr, i) => htmlGrupo(gr, `${sec.clave}-${i}`)).join('')}
    </div>`;
  };
  panel.innerHTML = `${cabeceraPanel(`Vales por ${info.texto.toLowerCase()}`, sub, acciones)}
    ${secciones.map(sec => htmlSeccion({ ...sec, sub: sec.clave === 'entregados' ? subEntregados : sec.sub, cuerpo: htmlTabla(sec) })).join('')}
    ${g.truncado ? `<p class="rep-nota">Hay ${g.totalVales} vales; se muestran los más urgentes. Acota el período o los filtros para ver el resto.</p>` : ''}`;

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
  conectarSecciones(panel);
  const todo = $('#rep-expandir-todo', panel);
  if (todo) todo.addEventListener('click', () => panel.querySelectorAll('.rep-grupo').forEach(el => alternar(el, true)));
  const nada = $('#rep-contraer-todo', panel);
  if (nada) nada.addEventListener('click', () => panel.querySelectorAll('.rep-grupo').forEach(el => alternar(el, false)));
}

// Acciones de cada vale desplegado: ver el vale (PDF) y ver su propuesta.
function conectarAcciones(cuerpo) {
  cuerpo.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => abrirVisorVale({
    id: b.dataset.ver, correlativo: b.dataset.correlativo, propuesta: b.dataset.conPropuesta ? { tipo: 'ultima' } : null
  })));
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
  const sub = v.total ? `${v.total} vale${v.total === 1 ? '' : 's'} con entrega en el período` : 'Vales con entrega en el período';
  if (!v.filas.length) {
    panel.innerHTML = cabeceraPanel('Vales del período', sub) + vacio('document-text-outline', 'Sin vales en este período', 'No hubo vales con entrega en el período.');
    return;
  }
  const filaVale = (f) => `
    <tr>
      <td data-label="Correlativo"><strong>${escapeHtml(f.correlativo)}</strong>${f.esMod ? '<span class="badge badge-mod">MOD</span>' : ''}</td>
      <td data-label="Cliente">${escapeHtml(f.cliente)}</td>
      <td data-label="Estado">${f.pipeline ? celdaEstado(f) : escapeHtml(ESTADOS_LABEL[f.estado] || f.estado)}</td>
      <td data-label="Entrega">${f.fechaEntrega.slice(8, 10)}/${f.fechaEntrega.slice(5, 7)}${f.atrasado && f.diasAtraso >= 1 ? `<span class="badge ${f.seccion === 'entregados' && data.rol === 'disenador' ? 'badge-tarde' : 'badge-atraso'}">${f.diasAtraso}d</span>` : ''}</td>
      ${v.columnas.map(c => `<td class="rend-num" data-label="${escapeHtml(c.label)}">${formatear(f[c.clave], c.formato)}</td>`).join('')}
      <td data-label="Historial"><button type="button" class="btn-icon" data-historial="${f.id}" data-correlativo="${escapeHtml(f.correlativo)}" title="Ver historial" aria-label="Ver historial de ${escapeHtml(f.correlativo)}"><ion-icon name="time-outline"></ion-icon></button></td>
    </tr>`;
  const tabla = (filas) => `<div class="rend-tabla-wrap"><table class="rend-tabla"><thead><tr><th>Correlativo</th><th>Cliente</th><th>Estado</th><th>Entrega</th>${v.columnas.map(c => `<th class="rend-num">${escapeHtml(c.label)}</th>`).join('')}<th></th></tr></thead><tbody>${filas.map(filaVale).join('')}</tbody></table></div>`;
  const subEntregados = data.rol === 'disenador' ? 'Tu propuesta ya salió a revisión' : 'Ya llegaron a ti';
  const secciones = SECCIONES_REPORTE.map(def => ({ ...def, ...v.secciones[def.clave] })).filter(x => x.total > 0);
  panel.innerHTML = `${cabeceraPanel('Vales del período', sub)}
    ${secciones.map(sec => htmlSeccion({ ...sec, sub: sec.clave === 'entregados' ? subEntregados : sec.sub, cuerpo: tabla(sec.filas) })).join('')}
    ${v.truncado ? `<p class="rep-nota">Se muestran los primeros ${v.filas.length} de ${v.total}. Exporta el PDF para ver más (hasta 500) o acota el período.</p>` : ''}`;
  conectarSecciones(panel);
  panel.querySelectorAll('[data-historial]').forEach(b => b.addEventListener('click', () => abrirModalHistorial({ id: Number(b.dataset.historial), correlativo: b.dataset.correlativo })));
}
