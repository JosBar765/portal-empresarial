import { state } from '../state.js';
import { ROL, ROLES_ENCARGADO_TALLER, rolEncargadoDe } from '../config/roles.js';
import { $ } from '../utils/dom.js';
import { escapeHtml, formatearFecha, formatearFechaHora, inicialesAvatar } from '../utils/formato.js';
import { ESTADOS_LABEL } from '../config/estados.js';
import { obtenerReporte, descargarReportePdf } from '../api/valesApi.js';
import { abrirModalHistorial } from '../actions/historial.js';
import { celdaEstado } from '../components/pipeline.js';
import { abrirVisorVale } from '../components/visorDocumento.js';
import { abrirVisorMultitaller } from '../actions/propuestasMultitaller.js';
import { htmlBloqueVigentes, conectarBloqueVigentes } from '../components/atrasadosVigentes.js';
import { htmlGraficaBarrasDobles } from '../components/graficaBarrasDobles.js';
import { htmlTablaRendimiento } from '../components/tablaRendimiento.js';
import { crearMenuExportar } from '../components/menuExportar.js';
import { crearBarraPeriodo, aplicarPeriodoAQuery, normalizarPeriodoCerrado } from '../components/barraPeriodoReportes.js';
import { crearSelectorMultiple } from '../components/selectorMultiple.js';

// -----------------------------------------------------------------------
// Reportes de actividad. Quienes ven a varias personas (Gerente, Administrador, Supervisor y Encargado/Asistente) reciben
// una tabla por sección con los vales con entrega en el período, donde la persona (o taller/tienda) es una columna.
// Asesor y Diseñador ven su propio listado. El alcance lo decide el servidor según el rol.
// -----------------------------------------------------------------------

let pedidoVigente = 0;
let ultimaData = null;
let barraPeriodo = null;
let tablaActiva = '';
let menuExportar = null;

// Pestaña del reporte («Rendimiento» no la tiene el Asesor ni el Diseñador); se recuerda la última.
const CLAVE_VISTA_REPORTE = 'vales:repVista';
const leerVista = () => { try { return localStorage.getItem(CLAVE_VISTA_REPORTE) === 'rendimiento' ? 'rendimiento' : 'actividad'; } catch { return 'actividad'; } };
// Rendimiento: Encargado/Asistente de taller, Supervisor, Administrador y Gerente (la vista recordada puede venir de otro usuario del navegador).
const esAlcanceGlobal = () => !!state.user && (state.user.rolId === ROL.ADMINISTRADOR || state.user.rolId === ROL.GERENTE);
const tieneRendimiento = () => !!state.user && (esAlcanceGlobal() || state.user.rolId === ROL.SUPERVISOR || ROLES_ENCARGADO_TALLER.includes(rolEncargadoDe(state.user)));
const guardarVista = (vista) => { try { localStorage.setItem(CLAVE_VISTA_REPORTE, vista); } catch { /* sin almacenamiento */ } };
// Administrador y Gerente: Rendimiento reúne el reporte de Ventas y el de Taller; se recuerda el último que vieron.
const CLAVE_ENFOQUE_REPORTE = 'vales:repEnfoque';
const leerEnfoque = () => { try { return localStorage.getItem(CLAVE_ENFOQUE_REPORTE) === 'taller' ? 'taller' : 'ventas'; } catch { return 'ventas'; } };
const guardarEnfoque = (valor) => { try { localStorage.setItem(CLAVE_ENFOQUE_REPORTE, valor); } catch { /* sin almacenamiento */ } };
let enfoque = leerEnfoque();
// 'ventas' o 'taller' si el reporte trae ambos (Administrador y Gerente); null en los demás roles.
const enfoqueGlobal = (data) => (data.grupos && data.grupos.rendimiento && data.grupos.rendimiento.vistas ? enfoque : null);

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
  if (r.vista === 'rendimiento') qs.set('tipo', 'rendimiento'); // Rendimiento: períodos cerrados y cifras al cierre
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
  if (state.reporte.vista === 'rendimiento' && !tieneRendimiento()) state.reporte.vista = 'actividad';
  // En Rendimiento, Semana y Mes solo cerrados: si había uno en curso se pasa al último cerrado.
  if (state.reporte.vista === 'rendimiento') state.reporte.ventana = normalizarPeriodoCerrado(state.reporte.ventana);
  const cont = $('#reportes-vista');
  armarEsqueleto(cont);
  if (barraPeriodo) barraPeriodo.pintar();
  const pedido = ++pedidoVigente;
  const cuerpo = $('#rep-cuerpo', cont);
  if (ultimaData) {
    cuerpo.classList.add('is-refetching');
    $('#rep-meta').textContent = `${$('#rep-meta').textContent.replace(SUFIJO_ACTUALIZANDO, '')}${SUFIJO_ACTUALIZANDO}`;
  }
  try {
    const data = await obtenerReporte(construirQuery());
    if (pedido !== pedidoVigente) return;
    ultimaData = data;
    cuerpo.classList.remove('is-refetching');
    renderTodo(data);
  } catch (error) {
    if (pedido !== pedidoVigente) return;
    cuerpo.classList.remove('is-refetching');
    const meta = $('#rep-meta');
    if (meta) meta.textContent = meta.textContent.replace(SUFIJO_ACTUALIZANDO, '');
    // Sin red, fetch lanza TypeError con un texto técnico: se cambia por uno que el usuario pueda aplicar.
    const mensaje = error?.name === 'TypeError' ? 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.' : error.message;
    if (ultimaData) { window.toast?.error('Reportes', mensaje); return; }
    cuerpo.innerHTML = `
      <div class="rep-estado rep-estado--error rep-estado--tarjeta">
        <span class="rep-estado-icono"><ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon></span>
        <h4>No se pudo cargar el reporte</h4>
        <p>${escapeHtml(mensaje)}</p>
        <button class="btn btn--ghost btn--sm" id="rep-reintentar" type="button">Reintentar</button>
      </div>`;
    $('#rep-reintentar', cuerpo).addEventListener('click', () => cargarReportes());
  }
}

const SUFIJO_ACTUALIZANDO = ' · Actualizando…';

// Primera carga: barras grises con la forma del reporte (controles, aviso y tabla) en vez de un texto suelto.
function htmlEsqueletoCuerpo() {
  const barra = (...mod) => `<span class="rep-esq-barra ${mod.map(m => `rep-esq-barra--${m}`).join(' ')}"></span>`;
  const fila = () => `<div class="rep-esq-fila">${barra('vale')}${barra('persona')}${barra('estado')}${barra('corta')}${barra('pildora-s')}${barra('cuadro')}</div>`;
  return `<div class="rep-esq" role="status" aria-label="Calculando el reporte">
    <div class="rep-esq-controles">${barra('pildora', 'xl')}</div>
    <div class="rep-esq-controles">${barra('campo')}${barra('campo')}${barra('campo')}</div>
    <div class="rep-esq-aviso">${barra('l')}${barra('pildora-s')}</div>
    <div class="rep-esq-tarjeta">
      ${barra('m')}${barra('s')}
      <div class="rep-esq-seccion">${barra('circulo')}${barra('l')}${barra('pildora-s')}</div>
      <div class="rep-esq-tabla">${fila()}${fila()}${fila()}${fila()}${fila()}</div>
    </div>
  </div>`;
}

function armarEsqueleto(cont) {
  if (cont.dataset.wired) return;
  cont.innerHTML = `
    <div class="rend-encabezado">
      <div>
        <h2 id="rep-titulo">Reportes</h2>
        <p class="rend-meta" id="rep-meta"></p>
        <p class="rend-meta">Los reportes no se actualizan solos: usa «Actualizar» para ver los datos más recientes.</p>
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
      ${htmlEsqueletoCuerpo()}
    </div>`;
  barraPeriodo = crearBarraPeriodo($('#rep-periodo', cont), {
    obtener: () => state.reporte.ventana,
    soloCerrados: () => state.reporte.vista === 'rendimiento',
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
    if (tipo === 'rendimiento' && ultimaData && enfoqueGlobal(ultimaData)) qs.set('enfoque', enfoque); // el PDF imprime el reporte a la vista
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

// Opciones del menú de descarga según el rol: Rendimiento no existe para el Asesor ni el Diseñador; Administrador y Gerente descargan el enfoque a la vista.
function configurarExportacion(data, vista) {
  const opciones = [{ id: 'actividad', icono: 'list-outline', titulo: 'Reporte de actividad', detalle: 'Vales atrasados, no entregados y entregados' }];
  if (data.grupos && data.grupos.rendimiento) {
    const actual = enfoqueGlobal(data);
    opciones.push(actual
      ? { id: 'rendimiento', icono: 'bar-chart-outline', titulo: `Reporte de rendimiento · ${actual === 'taller' ? 'Taller' : 'Ventas'}`, detalle: actual === 'taller' ? 'Contadores del taller, gráfica y tabla por diseñador' : 'Gráfica y tabla comparativa por asesor' }
      : { id: 'rendimiento', icono: 'bar-chart-outline', titulo: 'Reporte de rendimiento', detalle: 'Contadores, gráfica y tabla comparativa por persona' });
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
    cargarReportes(); // las cifras de Rendimiento (al cierre) y las de Actividad (de hoy) se piden por separado
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
  const corte = data.periodo.corte ? `${data.periodo.corte.slice(8, 10)}/${data.periodo.corte.slice(5, 7)}/${data.periodo.corte.slice(0, 4)}` : '';
  const textoCorte = vista === 'rendimiento' && corte ? ` · ${data.periodo.cerrado ? `Cifras al cierre del período (${corte})` : `Cifras al ${corte} (período en curso)`}` : '';
  $('#rep-meta').textContent = `${data.periodo.titulo || data.periodo.etiqueta}${textoCorte} · Actualizado ${new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
  renderFiltros(data, vista);
  renderTabs(data, vista);
  configurarExportacion(data, vista);
  if (vista === 'rendimiento') {
    const bloque = bloqueRendimiento(data);
    $('#rep-cuerpo').innerHTML = `
      ${esRendimientoTaller(data) && data.grupos.indicadoresTaller ? htmlIndicadoresTaller(data.grupos.indicadoresTaller) : ''}
      ${htmlGraficaBarrasDobles(bloque)}${htmlTablaRendimiento(bloque)}
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

// Administrador y Gerente reciben Ventas y Taller completos (`vistas`) y ven el elegido; los demás roles, un solo reporte.
const bloqueRendimiento = (data) => { const r = data.grupos.rendimiento; return r.vistas ? r.vistas[enfoque] : r; };
// El reporte a la vista es el de Taller (contadores y diseñadores): el del Encargado/Asistente o el enfoque Taller de Administrador y Gerente.
const esRendimientoTaller = (data) => (enfoqueGlobal(data) ? enfoque === 'taller' : data.rol === 'encargado');

// Notas del reporte de rendimiento.
function notasRendimiento(data) {
  const propio = !enfoqueGlobal(data); // «y a ti» solo cuando la persona que ve el reporte también aparece en él
  const taller = esRendimientoTaller(data);
  const entregado = taller
    ? `<strong>Asignados / Entregados:</strong> vales con fecha de entrega en el período asignados a cada diseñador${propio ? ' (y a ti)' : ''} y, de ellos, los que su propuesta ya aprobó el Encargado.`
    : `<strong>Creados / Autorizados:</strong> vales con fecha de entrega en el período creados por cada asesor${propio ? ' (y por ti)' : ''} y, de ellos, los que ya fueron autorizados.`;
  return `<li>${entregado}</li>
    <li><strong>%:</strong> la segunda cifra entre la primera.</li>
    ${taller
      ? '<li><strong>Cómo se calcula:</strong> Semana y Mes solo se consultan cuando ya cerraron y muestran las cifras al cierre: no cambian después (un vale aprobado después del cierre cuenta como sin entregar en ese período). Día, Hoy y Desde–Hasta muestran las cifras de hoy y solo cuentan vales cuya fecha de entrega ya llegó. Un vale que vence hoy es «sin entregar» pero no «atrasado» hasta mañana; «atrasado» es todo vale vencido que el Encargado aún no aprueba.</li><li><strong>Entregas tarde:</strong> de los entregados (aprobados por el Encargado), los que tienen atraso en su taller. <strong>% a tiempo:</strong> entregados sin atraso entre entregados. <strong>Sin entregar:</strong> asignados de la ventana que esa persona aún no entrega (asignados menos entregados). <strong>Sin asignar:</strong> vales de la ventana que ningún diseñador tiene todavía.</li>'
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
      accionesHtml: `<button type="button" class="btn-icon" data-ver="${v.id}" data-correlativo="${escapeHtml(v.correlativo)}"${v.tienePropuesta ? ' data-con-propuesta="1"' : ''}${v.multitaller ? ' data-multitaller="1"' : ''} title="Ver vale" aria-label="Ver vale ${escapeHtml(v.correlativo)}"><ion-icon name="eye-outline"></ion-icon></button>`
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
    reglas.push('<li><strong>Tabla:</strong> lista los vales con <strong>fecha de entrega</strong> en el período, agrupados por la persona, taller o tienda elegidos. Cada fila muestra cuántos vales tiene, cuántos ya fueron autorizados y qué atención requieren (atrasados). Al pulsarla se despliegan sus vales: los atrasados del más atrasado al menos; los no entregados por fecha de ingreso; los entregados, primero los que se entregaron con atraso (del más atrasado al menos) y luego los que llegaron a tiempo.</li>');
  }
  if (data.grupos && data.grupos.indicadoresTaller) {
    reglas.push('<li><strong>Indicadores del taller:</strong> <em>Entrantes</em> son los vales del período que ya llegaron a tus talleres; <em>Entregados</em>, los que el Encargado ya aprobó (con atraso o sin él); <em>Sin entregar</em>, los demás; <em>Atrasados sin entregar</em>, los que ya vencieron (del período o de antes) y aún no se aprueban; todo se calcula hasta hoy; <em>Efectividad</em>, entregados ÷ entrantes; <em>A tiempo</em>, los entregados sin atraso en su taller ÷ entregados.</li>');
  }
  return reglas.join('');
}

// Franja de indicadores de la vista Taller (Encargado/Asistente). Cada uno explica su definición al pasar o enfocar el ícono.
const porcentaje = (n) => (n == null ? '—' : `${String(n).replace('.', ',')} %`);
// Color de un porcentaje: rojo por debajo de 50 %, amarillo por debajo de 90 %.
const tonoPorcentaje = (n) => (n == null ? '' : (n < 50 ? 'rojo' : (n < 90 ? 'amarillo' : '')));
function htmlIndicadoresTaller(i) {
  const tarjetas = [
    { etiqueta: 'Entrantes', valor: i.entrantes, ayuda: 'Vales con fecha de entrega en la ventana de tiempo, hasta hoy: los que aún no llegan a su fecha de entrega no cuentan.' },
    { etiqueta: 'Entregados', valor: i.entregados, ayuda: 'De los entrantes, los que el Encargado ya aprobó (con atraso o sin él).' },
    { etiqueta: 'Sin entregar', valor: i.sinEntregar, ayuda: 'De los entrantes, los que aún no aprueba el Encargado (sin asignar, en trabajo, en pausa o en revisión).' },
    { etiqueta: 'Atrasados sin entregar', valor: i.atrasadosSinEntregar, tono: i.atrasadosSinEntregar > 0 ? 'rojo' : '', ayuda: 'Vales con la fecha de entrega ya vencida (de la ventana o de antes) que el Encargado aún no aprueba.' },
    { etiqueta: '% efectividad', valor: porcentaje(i.efectividad), tono: tonoPorcentaje(i.efectividad), ayuda: 'Entregados entre entrantes, calculado hasta hoy. Amarillo por debajo de 90 %, rojo por debajo de 50 %.' },
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
// Selector «Ventas | Taller» de Rendimiento (Administrador y Gerente), con el mismo estilo que «Agrupar por».
function htmlSelectorEnfoque(actual) {
  const opciones = [{ id: 'ventas', texto: 'Ventas', icono: 'people-outline' }, { id: 'taller', texto: 'Taller', icono: 'construct-outline' }];
  return `<div class="rep-agrupar" role="group" aria-label="Reporte de rendimiento">
      <ion-icon name="${actual === 'taller' ? 'construct-outline' : 'people-outline'}" aria-hidden="true"></ion-icon>
      <span class="rep-filtro-rotulo">Reporte</span>
      ${opciones.map(o => `<button type="button" class="rp-segmento${o.id === actual ? ' is-activo' : ''}" data-enfoque="${o.id}" aria-pressed="${o.id === actual}">${o.texto}</button>`).join('')}
    </div>`;
}

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
  // Rendimiento de Administrador y Gerente: Ventas filtra por tienda, taller y asesor; Taller, por taller y diseñador.
  const enfoqueFiltros = vista === 'rendimiento' ? enfoqueGlobal(data) : null;
  const disenadoresVisibles = enfoqueFiltros === 'ventas' ? [] : f.disenadores.filter(delTaller);
  const asesoresVisibles = enfoqueFiltros === 'taller' ? [] : f.asesores;
  const tiendasVisibles = enfoqueFiltros === 'taller' ? [] : f.tiendas;
  const evaluadosDelEnfoque = (data.evaluados || []).filter(p => !enfoqueFiltros || (enfoqueFiltros === 'ventas' ? f.asesores : f.disenadores).some(o => o.id === p.id));
  const opciones = (lista, valor, vacio) => `<option value="">${vacio}</option>${lista.map(o => `<option value="${o.id}"${String(o.id) === String(valor) ? ' selected' : ''}>${escapeHtml(o.nombre)}</option>`).join('')}`;
  cont.hidden = false;
  cont.innerHTML = `
    ${vista === 'rendimiento' ? (enfoqueFiltros ? htmlSelectorEnfoque(enfoqueFiltros) : '') : `<div class="rep-agrupar${disponibles.length > 1 ? '' : ' rep-agrupar--fijo'}" role="group" aria-label="Agrupar por">
      <ion-icon name="${ICONO_AGRUPAR[agrupar] || 'layers-outline'}" aria-hidden="true"></ion-icon>
      <span class="rep-filtro-rotulo">Agrupar por</span>
      ${disponibles.length > 1
        ? disponibles.map(a => `<button type="button" class="rp-segmento${a.id === agrupar ? ' is-activo' : ''}" data-agrupar="${a.id}" aria-pressed="${a.id === agrupar}">${a.texto}</button>`).join('')
        : `<span class="rep-agrupar-fijo">${escapeHtml((disponibles[0] || AGRUPACIONES.find(a => a.id === agrupar) || {}).texto || '')}</span>`}
    </div>`}
    <div class="rep-filtros-fila">
      ${tiendasVisibles.length ? `<select id="rep-f-tienda" class="filtro-tienda" aria-label="Filtrar por tienda">${opciones(f.tiendas, r.tiendaId, 'Todas las tiendas')}</select>` : ''}
      ${f.talleres.length ? `<select id="rep-f-taller" class="filtro-tienda" aria-label="Filtrar por taller">${opciones(f.talleres, r.tallerId, 'Todos los talleres')}</select>` : ''}
      <span id="rep-f-asesores"></span>
      <span id="rep-f-disenadores"></span>
      ${hayFiltros() ? '<button type="button" class="rep-link" id="rep-limpiar-filtros">Limpiar filtros</button>' : ''}
    </div>`;
  cont.querySelectorAll('[data-enfoque]').forEach(b => b.addEventListener('click', () => {
    if (enfoque === b.dataset.enfoque) return;
    enfoque = b.dataset.enfoque;
    guardarEnfoque(enfoque);
    renderTodo(data); // Ventas y Taller ya vienen en la misma respuesta: no hace falta pedirlos otra vez
    $(`[data-enfoque="${enfoque}"]`)?.focus();
  }));
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
  if (asesoresVisibles.length) {
    crearSelectorMultiple($('#rep-f-asesores', cont), {
      uid: 'rep-sel-asesores', icono: 'people-outline', vacio: 'Todos los asesores', plural: ['asesor', 'asesores'],
      opciones: asesoresVisibles, seleccion: r.asesorIds, alAplicar: (ids) => { r.asesorIds = ids; r.expandidos.clear(); cargarReportes(); }
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
  renderFichas(data, evaluadosDelEnfoque);
}

// Fichas de quién se evalúa (asesores o diseñadores elegidos), con × para quitar a cada uno.
function renderFichas(data, ev = data.evaluados || []) {
  const cont = $('#rep-fichas');
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
// Tabla de vales por sección
// -----------------------------------------------------------------------
function htmlAtraso(v) {
  if (v.venceHoy) return '<span class="badge badge-hoy">Vence hoy</span>';
  if (v.atrasado) return `<span class="badge badge-atraso">${v.diasAtraso} d</span>`;
  return '<span class="badge badge-ok">Al día</span>';
}

// Entregado: si llegó con atraso, sus días en rojo (como los atrasados); si no, «Al día».
function htmlAtrasoEntregado(v) {
  return v.diasTarde >= 1 ? `<span class="badge badge-atraso" title="Entregado con atraso">${v.diasTarde} d</span>` : '<span class="badge badge-ok">Al día</span>';
}

let vistaTaller = false;


// Una sola tabla por sección con todos sus vales: la persona (o taller/tienda) es una columna, no un desplegable.
// Atrasados y entregados muestran el Atraso (en los entregados, los días con que se entregó).
function htmlTablaSeccion(sec, info) {
  const conAtraso = sec.clave === 'atrasados' || sec.clave === 'entregados';
  const filas = sec.grupos.flatMap(g => g.vales.map(v => `
    <tr>
      <td class="rep-c-vale" data-label="Vale"><strong>${escapeHtml(v.correlativo)}</strong>${v.esMod ? '<span class="badge badge-mod">MOD</span>' : ''}${v.urgente ? '<span class="badge badge-urgente">URGENTE</span>' : ''}${vistaTaller ? '' : `<span class="rep-cliente">${escapeHtml(v.cliente)}</span>`}</td>
      <td class="rep-c-grupo" data-label="${info.texto}"><span class="rep-grupo-nombre"><span class="rep-avatar" aria-hidden="true">${escapeHtml(inicialesAvatar(g.nombre))}</span><span>${escapeHtml(g.nombre)}</span></span></td>
      ${vistaTaller ? `<td class="rep-c-ingreso" data-label="Fecha de ingreso">${escapeHtml(formatearFechaHora(v.creadoEn))}</td>` : ''}
      <td class="rep-c-estado" data-label="Estado">${celdaEstado(v)}</td>
      <td class="rep-c-entrega fecha-entrega" data-label="Entrega">${escapeHtml(formatearFecha(v.fechaEntrega))}</td>
      ${conAtraso ? `<td class="rep-c-atraso" data-label="Atraso">${sec.clave === 'entregados' ? htmlAtrasoEntregado(v) : htmlAtraso(v)}</td>` : ''}
      <td class="rep-acciones-celda rep-c-acciones" data-label="Acciones"><div class="rep-acciones-fila">
        <button type="button" class="btn-icon" data-ver="${v.id}" data-correlativo="${escapeHtml(v.correlativo)}"${v.tienePropuesta ? ' data-con-propuesta="1"' : ''}${v.multitaller ? ' data-multitaller="1"' : ''} title="Ver vale" aria-label="Ver vale ${escapeHtml(v.correlativo)}"><ion-icon name="eye-outline"></ion-icon></button>
      </div></td>
    </tr>`)).join('');
  if (!filas) return '<p class="rep-sin-vales">Sin vales con entrega en este período.</p>';
  const recortado = sec.grupos.some(g => g.recortado);
  return `<div class="rep-mini-wrap"><table class="rep-mini rep-mini--plana${vistaTaller ? ' rep-mini--taller' : ''}"><thead><tr><th>Vale</th><th>${info.texto}</th>${vistaTaller ? '<th>Fecha de ingreso</th>' : ''}<th>Estado</th><th>Entrega</th>${conAtraso ? '<th>Atraso</th>' : ''}<th>Acciones</th></tr></thead><tbody>${filas}</tbody></table></div>
    ${recortado ? '<p class="rep-nota">Se muestran los vales más urgentes; acota el período o los filtros para ver el resto.</p>' : ''}`;
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

// Sin vales en el período: si no está en «Mes», se ofrece ampliar al mes completo.
function htmlEstadoVacio() {
  const ampliar = state.reporte.ventana.tipo !== 'mes';
  return `<div class="rep-estado">
    <span class="rep-estado-icono"><ion-icon name="document-text-outline" aria-hidden="true"></ion-icon></span>
    <h4>Sin vales con entrega en este período</h4>
    <p>Cambia el período o los filtros para ver otros vales.</p>
    ${ampliar ? '<button type="button" class="btn btn--ghost btn--sm" id="rep-ver-mes">Ver el mes completo</button>' : ''}
  </div>`;
}

function verMesCompleto() {
  const p = state.reporte.ventana;
  state.reporte.ventana = { tipo: 'mes', fecha: p.tipo === 'rango' ? p.hasta : p.fecha };
  barraPeriodo.pintar();
  cargarReportes();
}

function renderGrupos(data) {
  const panel = $('#rep-panel-grupos');
  const g = data.grupos;
  const info = AGRUPACIONES.find(a => a.id === g.agruparPor);
  const secciones = SECCIONES_REPORTE.map(def => ({ ...def, ...g.secciones[def.clave] })).filter(x => x.total > 0);
  const subEntregados = vistaTaller ? 'Propuesta aprobada por el Encargado' : 'Ya llegaron al asesor';
  const personas = new Set(secciones.flatMap(x => x.grupos.map(gr => gr.id))).size;
  const sub = `${g.totalVales} vale${g.totalVales === 1 ? '' : 's'} · ${personas} ${personas === 1 ? info.texto.toLowerCase() : info.plural}`;
  if (!secciones.length) {
    panel.innerHTML = cabeceraPanel(`Vales por ${info.texto.toLowerCase()}`, sub) + htmlEstadoVacio();
    const ampliar = $('#rep-ver-mes', panel);
    if (ampliar) ampliar.addEventListener('click', verMesCompleto);
    return;
  }
  panel.innerHTML = `${cabeceraPanel(`Vales por ${info.texto.toLowerCase()}`, sub)}
    ${secciones.map(sec => htmlSeccion({ ...sec, sub: sec.clave === 'entregados' ? subEntregados : sec.sub, cuerpo: htmlTablaSeccion(sec, info) })).join('')}
    ${g.truncado ? `<p class="rep-nota">Hay ${g.totalVales} vales; se muestran los más urgentes. Acota el período o los filtros para ver el resto.</p>` : ''}`;
  conectarAcciones(panel);
  conectarSecciones(panel);
}

// Acciones de cada vale: ver el vale (PDF) y ver su propuesta.
function conectarAcciones(cuerpo) {
  cuerpo.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => (b.dataset.multitaller
    ? abrirVisorMultitaller({ id: b.dataset.ver, correlativo: b.dataset.correlativo })
    : abrirVisorVale({ id: b.dataset.ver, correlativo: b.dataset.correlativo, propuesta: b.dataset.conPropuesta ? { tipo: 'ultima' } : null }))));
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
      <td data-label="Entrega" class="fecha-entrega">${f.fechaEntrega.slice(8, 10)}/${f.fechaEntrega.slice(5, 7)}${f.atrasado && f.diasAtraso >= 1 ? `<span class="badge badge-atraso">${f.diasAtraso}d</span>` : ''}</td>
      ${v.columnas.map(c => `<td class="rend-num" data-label="${escapeHtml(c.label)}">${formatear(f[c.clave], c.formato)}</td>`).join('')}
      <td data-label="Historial"><button type="button" class="btn-icon" data-historial="${f.id}" data-correlativo="${escapeHtml(f.correlativo)}" title="Ver historial" aria-label="Ver historial de ${escapeHtml(f.correlativo)}"><ion-icon name="time-outline"></ion-icon></button></td>
    </tr>`;
  const tabla = (filas) => `<div class="rend-tabla-wrap"><table class="rend-tabla"><thead><tr><th>Correlativo</th><th>Cliente</th><th>Estado</th><th>Entrega</th>${v.columnas.map(c => `<th class="rend-num">${escapeHtml(c.label)}</th>`).join('')}<th></th></tr></thead><tbody>${filas.map(filaVale).join('')}</tbody></table></div>`;
  const subEntregados = data.rol === 'disenador' ? 'Tu propuesta ya fue aprobada' : 'Ya llegaron a ti';
  const secciones = SECCIONES_REPORTE.map(def => ({ ...def, ...v.secciones[def.clave] })).filter(x => x.total > 0);
  panel.innerHTML = `${cabeceraPanel('Vales del período', sub)}
    ${secciones.map(sec => htmlSeccion({ ...sec, sub: sec.clave === 'entregados' ? subEntregados : sec.sub, cuerpo: tabla(sec.filas) })).join('')}
    ${v.truncado ? `<p class="rep-nota">Se muestran los primeros ${v.filas.length} de ${v.total}. Exporta el PDF para ver más (hasta 500) o acota el período.</p>` : ''}`;
  conectarSecciones(panel);
  panel.querySelectorAll('[data-historial]').forEach(b => b.addEventListener('click', () => abrirModalHistorial({ id: Number(b.dataset.historial), correlativo: b.dataset.correlativo })));
}
