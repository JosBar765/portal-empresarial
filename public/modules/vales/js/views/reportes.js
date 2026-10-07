import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { ESTADOS_LABEL } from '../config/estados.js';
import { obtenerReporte, descargarReportePdf } from '../api/valesApi.js';
import { aplicarVentanaAQuery } from '../utils/ventana.js';
import { abrirModalHistorial } from '../actions/historial.js';
import { fmtNum, fmtPct, fmtDias, ocultarTooltip } from '../components/charts.js';

// -----------------------------------------------------------------------
// Reportes de actividad: lo que hizo cada persona (y su equipo, si tiene gente a su cargo) en el período de la
// barra superior, con los mismos tokens y tarjetas de «Rendimiento». El alcance lo decide el servidor
// según el rol; aquí solo se pide un período y, si hay equipo, evaluar a una o varias personas.
// -----------------------------------------------------------------------

let pedidoVigente = 0;
let ultimaData = null;
let selectorAbierto = false;
let tablaActiva = '';

function construirQuery() {
  const qs = new URLSearchParams();
  aplicarVentanaAQuery(qs);
  if (state.tiendaId) qs.set('tiendaId', state.tiendaId);
  if (state.reporte.personaIds.length) qs.set('personaIds', state.reporte.personaIds.join(','));
  if (state.reporte.tallerId) qs.set('tallerId', state.reporte.tallerId);
  return qs;
}

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

// Variación contra el período anterior (mismo criterio visual que Rendimiento).
function variacion(k) {
  if (k.instantaneo || k.anterior == null || k.valor == null || typeof k.valor !== 'number') return '';
  let diff;
  let texto;
  let bueno = null;
  if (k.formato === 'pct') { diff = k.valor - k.anterior; texto = `${fmtNum(Math.abs(diff), 1)} pp`; bueno = true; }
  else if (k.formato === 'horas') { diff = k.valor - k.anterior; texto = horas(Math.abs(diff)); bueno = false; }
  else if (k.formato === 'dias') { diff = k.valor - k.anterior; texto = fmtDias(Math.abs(diff)); bueno = false; }
  else {
    if (k.anterior === 0) return '';
    diff = k.valor - k.anterior;
    texto = `${Math.abs(Math.round((diff / k.anterior) * 100))}%`;
    bueno = k.malo ? false : null;
  }
  const igual = k.formato === 'horas' ? Math.abs(diff) < 0.02 : Math.abs(diff) < 0.05;
  const sube = diff > 0;
  const tono = igual || bueno === null ? 'neutro' : (sube === bueno ? 'bueno' : 'malo');
  const icono = igual ? 'remove-outline' : (sube ? 'trending-up-outline' : 'trending-down-outline');
  return `<span class="rend-delta rend-delta--${tono}"><ion-icon name="${icono}" aria-hidden="true"></ion-icon>${igual ? 'Sin cambio' : texto}<span class="rend-delta-ref"> vs período anterior</span></span>`;
}

// -----------------------------------------------------------------------
// Carga
// -----------------------------------------------------------------------
export async function cargarReportes() {
  // Un reporte nuevo abre en «Hoy» (el reporte diario) si la barra sigue en «Todo».
  if (!state.reporte.iniciado) {
    state.reporte.iniciado = true;
    if (state.ventana.tipo === 'todo') {
      const hoy = document.querySelector('.chip[data-ventana="hoy"]');
      if (hoy) { hoy.click(); return; }
    }
  }
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
        <span id="rep-controles" class="rep-controles"></span>
        <button class="btn btn--ghost btn--sm" id="rep-actualizar" type="button"><ion-icon name="refresh-outline"></ion-icon> Actualizar</button>
        <button class="btn btn--primary btn--sm" id="rep-exportar" type="button"><ion-icon name="download-outline"></ion-icon> <span>Exportar PDF</span></button>
      </div>
    </div>
    <div class="rend-cuerpo" id="rep-cuerpo">
      <div class="buzon-vacio"><ion-icon name="sync-outline" class="spin-animation"></ion-icon><p>Calculando el reporte...</p></div>
    </div>`;
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
  $('#rep-titulo').textContent = data.titulo;
  const tienda = state.tiendaId ? ((data.filtros.tiendas || []).find(t => String(t.id) === String(state.tiendaId)) || {}).nombre : '';
  $('#rep-meta').textContent = `${data.periodo.etiqueta}${tienda ? ` · ${tienda}` : ''} · Actualizado ${new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
  renderControles(data);
  $('#rep-cuerpo').innerHTML = `
    <section class="rep-kpis" aria-label="Indicadores">${data.kpis.map(htmlKpi).join('')}</section>
    <div class="rend-grid">
      <section class="rend-panel rend-span-12" id="rep-panel-tablas"></section>
      <section class="rend-panel rend-span-12" id="rep-panel-vales"></section>
    </div>
    <details class="rend-notas">
      <summary>Cómo se calculan estos indicadores</summary>
      <ul>
        <li><strong>Período:</strong> se cuenta cada acción por el día en que ocurrió (no por la fecha de entrega del vale). «Hoy» es el reporte diario.</li>
        ${notasDelRol(data.rol)}
        <li><strong>Variación:</strong> se compara con el período inmediatamente anterior de igual duración; con «Todo» no hay comparación.</li>
      </ul>
    </details>`;
  renderTablas(data);
  renderVales(data);
}

function notasDelRol(rol) {
  if (['asesor', 'supervisor'].includes(rol)) {
    return '<li><strong>Creados, autorizados y modificaciones solicitadas:</strong> acciones registradas en el historial; una modificación cuenta cuando se solicita.</li>';
  }
  const comunes = '<li><strong>Comenzados, entregados, aprobados y devueltos:</strong> acciones registradas en el historial de cada vale; cancelar un proceso no cuenta como entrega, y una devolución cuenta para quien entregó el trabajo.</li><li><strong>Tiempo de producción:</strong> desde que el diseñador comienza hasta que entrega, pausas incluidas. <strong>Tiempo de revisión:</strong> desde la entrega hasta que el encargado aprueba o devuelve.</li><li><strong>A tiempo:</strong> acción hecha antes de la fecha de entrega del vale.</li><li><strong>Ahora:</strong> los indicadores marcados «ahora mismo» muestran el estado de hoy, sin importar el período.</li>';
  return rol === 'administrador'
    ? `<li><strong>Creados, autorizados y ciclo completo (crear → confirmar):</strong> acciones de ventas registradas en el historial.</li>${comunes}`
    : comunes;
}

function renderControles(data) {
  const f = data.filtros;
  const opciones = (lista, valor, vacio) => `<option value="">${vacio}</option>${lista.map(o => `<option value="${o.id}"${String(o.id) === String(valor) ? ' selected' : ''}>${escapeHtml(o.nombre)}</option>`).join('')}`;
  const partes = [];
  if (f.personas.length) partes.push(htmlSelectorPersonas(f.personas, data.rol));
  if (f.talleres.length) partes.push(`<select id="rep-taller" class="filtro-tienda" aria-label="Filtrar por taller">${opciones(f.talleres, state.reporte.tallerId, 'Todos los talleres')}</select>`);
  $('#rep-controles').innerHTML = partes.join('');
  if (f.personas.length) wireSelectorPersonas(f.personas);
  const taller = $('#rep-taller');
  if (taller) taller.addEventListener('change', () => { state.reporte.tallerId = taller.value; cargarReportes(); });
  renderFichas(data);
}

// -----------------------------------------------------------------------
// Selector de personas a evaluar (una o varias)
// -----------------------------------------------------------------------
const plural = (rol, n) => (rol === 'supervisor' ? (n === 1 ? 'asesor' : 'asesores') : (n === 1 ? 'persona' : 'personas'));
const estaElegida = (id) => state.reporte.personaIds.map(String).includes(String(id));

function etiquetaSelector(personas, rol) {
  const ids = state.reporte.personaIds;
  if (!ids.length) return rol === 'supervisor' ? 'Todos los asesores' : 'Todas las personas';
  if (ids.length === 1) return (personas.find(p => String(p.id) === String(ids[0])) || {}).nombre || '1 persona';
  return `${ids.length} ${plural(rol, ids.length)}`;
}

function htmlSelectorPersonas(personas, rol) {
  const n = state.reporte.personaIds.length;
  return `<div class="rep-selector" id="rep-selector">
    <button type="button" class="filtro-tienda rep-selector-btn${n ? ' is-activo' : ''}" id="rep-selector-btn" aria-haspopup="dialog" aria-expanded="false">
      <ion-icon name="people-outline" aria-hidden="true"></ion-icon><span>${escapeHtml(etiquetaSelector(personas, rol))}</span>
    </button>
    <div class="rep-selector-panel" id="rep-selector-panel" role="dialog" aria-label="Elegir a quién evaluar" hidden>
      <input type="search" class="rep-selector-buscar" id="rep-selector-buscar" placeholder="Buscar por nombre" aria-label="Buscar por nombre" autocomplete="off">
      <div class="rep-selector-acciones">
        <button type="button" class="rep-link" id="rep-sel-todos">Seleccionar todos</button>
        <button type="button" class="rep-link" id="rep-sel-ninguno">Quitar selección</button>
      </div>
      <ul class="rep-selector-lista" id="rep-selector-lista">
        ${personas.map(p => `<li data-nombre="${escapeHtml(p.nombre.toLowerCase())}"><label><input type="checkbox" value="${p.id}"${estaElegida(p.id) ? ' checked' : ''}><span>${escapeHtml(p.nombre)}</span></label></li>`).join('')}
      </ul>
      <p class="rep-selector-vacio" id="rep-selector-vacio" hidden>Nadie coincide con la búsqueda.</p>
      <div class="rep-selector-pie">
        <span id="rep-selector-cuenta"></span>
        <span class="rep-selector-botones"><button type="button" class="btn btn--ghost btn--sm" id="rep-sel-cancelar">Cancelar</button><button type="button" class="btn btn--primary btn--sm" id="rep-sel-aplicar">Aplicar</button></span>
      </div>
    </div>
  </div>`;
}

function wireSelectorPersonas(personas) {
  const raiz = $('#rep-selector');
  const boton = $('#rep-selector-btn');
  const panel = $('#rep-selector-panel');
  const cajas = () => [...panel.querySelectorAll('input[type="checkbox"]')];
  const marcadas = () => cajas().filter(c => c.checked).map(c => c.value);
  const actualizarCuenta = () => { $('#rep-selector-cuenta').textContent = `${marcadas().length} de ${personas.length} elegidos`; };
  const cerrar = (devolverFoco = true) => {
    if (!selectorAbierto) return;
    selectorAbierto = false;
    panel.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', fuera, true);
    document.removeEventListener('keydown', teclado, true);
    if (devolverFoco) boton.focus();
  };
  const fuera = (e) => { if (!raiz.contains(e.target)) cerrar(false); };
  const teclado = (e) => { if (e.key === 'Escape') { e.preventDefault(); cerrar(); } };
  const abrir = () => {
    selectorAbierto = true;
    panel.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', fuera, true);
    document.addEventListener('keydown', teclado, true);
    actualizarCuenta();
    $('#rep-selector-buscar').focus();
  };
  selectorAbierto = false;
  boton.addEventListener('click', () => (selectorAbierto ? cerrar() : abrir()));
  panel.addEventListener('change', actualizarCuenta);
  $('#rep-selector-buscar').addEventListener('input', (e) => {
    const t = e.target.value.trim().toLowerCase();
    let visibles = 0;
    panel.querySelectorAll('#rep-selector-lista li').forEach(li => { const ok = !t || li.dataset.nombre.includes(t); li.hidden = !ok; if (ok) visibles += 1; });
    $('#rep-selector-vacio').hidden = visibles > 0;
  });
  $('#rep-sel-todos').addEventListener('click', () => { cajas().forEach(c => { if (!c.closest('li').hidden) c.checked = true; }); actualizarCuenta(); });
  $('#rep-sel-ninguno').addEventListener('click', () => { cajas().forEach(c => { c.checked = false; }); actualizarCuenta(); });
  $('#rep-sel-cancelar').addEventListener('click', () => {
    cajas().forEach(c => { c.checked = estaElegida(c.value); });
    cerrar();
  });
  $('#rep-sel-aplicar').addEventListener('click', () => {
    const ids = marcadas();
    state.reporte.personaIds = ids.length === personas.length ? [] : ids; // todos marcados = sin filtro
    cerrar(false);
    cargarReportes();
  });
}

// Fichas de quién se evalúa, con × para quitar a cada una.
function renderFichas(data) {
  let cont = $('#rep-fichas');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'rep-fichas';
    cont.className = 'rep-fichas';
    $('.rend-encabezado', $('#reportes-vista')).after(cont);
  }
  const ev = data.evaluados || [];
  cont.hidden = !ev.length;
  if (!ev.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = `<span class="rep-fichas-rotulo">Evaluando a:</span>${ev.map(p => `<span class="rep-ficha">${escapeHtml(p.nombre)}<button type="button" data-quitar="${p.id}" aria-label="Quitar a ${escapeHtml(p.nombre)}"><ion-icon name="close" aria-hidden="true"></ion-icon></button></span>`).join('')}<button type="button" class="rep-link" id="rep-limpiar">Limpiar</button>`;
  cont.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => {
    state.reporte.personaIds = state.reporte.personaIds.filter(id => String(id) !== b.dataset.quitar);
    cargarReportes();
  }));
  $('#rep-limpiar', cont).addEventListener('click', () => { state.reporte.personaIds = []; cargarReportes(); });
}

function htmlKpi(k) {
  const alerta = k.malo && typeof k.valor === 'number' && k.valor > 0 && k.instantaneo;
  const sub = k.instantaneo ? 'ahora mismo' : (k.ayuda || '');
  return `
    <article class="rend-kpi${alerta ? ' rend-kpi--alerta' : ''}">
      <p class="rend-kpi-etiqueta">${escapeHtml(k.label)}</p>
      <p class="rend-kpi-valor">${alerta ? '<ion-icon name="alert-circle" aria-hidden="true"></ion-icon>' : ''}${formatear(k.valor, k.formato)}</p>
      <p class="rend-kpi-sub">${escapeHtml(sub)}</p>
      <div class="rend-kpi-pie">${variacion(k)}</div>
    </article>`;
}

function cabeceraPanel(titulo, subtitulo, extra = '') {
  return `<header class="rend-panel-cab"><div><h3>${titulo}</h3><p>${subtitulo}</p></div>${extra}</header>`;
}

const vacio = (icono, titulo, texto) => `<div class="rend-vacio"><ion-icon name="${icono}"></ion-icon><h4>${titulo}</h4><p>${texto}</p></div>`;

function renderTablas(data) {
  const panel = $('#rep-panel-tablas');
  const tablas = data.tablas.filter(t => t.filas.length);
  if (!data.tablas.length) { panel.style.display = 'none'; return; }
  panel.style.display = '';
  if (!tablas.length) {
    panel.innerHTML = cabeceraPanel('Por persona', 'Comparativo del período') + vacio('people-outline', 'Sin actividad de personas', 'Aún no hay acciones en este período.');
    return;
  }
  if (!tablas.some(t => t.clave === tablaActiva)) tablaActiva = tablas[0].clave;
  const actual = tablas.find(t => t.clave === tablaActiva);
  const enfocables = new Set((data.filtros.personas || []).map(p => p.id));
  const tabs = tablas.length > 1
    ? `<div class="rend-tabs" role="tablist">${tablas.map(t => `<button type="button" role="tab" aria-selected="${t.clave === tablaActiva}" class="chip${t.clave === tablaActiva ? ' chip-active' : ''}" data-tabla="${t.clave}">${escapeHtml(t.titulo)}</button>`).join('')}</div>` : '';
  const filas = actual.filas.map(f => {
    const enfocable = enfocables.has(f.id);
    return `<tr${enfocable ? ` class="rep-fila-enfocable" tabindex="0" data-persona="${f.id}" title="Evaluar solo a ${escapeHtml(f.nombre)}"` : ''}>
      <td data-label="${escapeHtml(actual.titulo)}"><strong>${escapeHtml(f.nombre)}</strong></td>
      ${actual.columnas.map(c => `<td class="rend-num" data-label="${escapeHtml(c.label)}">${formatear(f[c.clave], c.formato)}</td>`).join('')}
    </tr>`;
  }).join('');
  panel.innerHTML = `${cabeceraPanel(actual.titulo, enfocables.size ? 'Pulsa una fila para evaluar solo a esa persona' : 'Comparativo del período', tabs)}
    <div class="rend-tabla-wrap"><table class="rend-tabla"><thead><tr><th>${escapeHtml(actual.titulo.replace('Por ', '').replace(/^./, c => c.toUpperCase()))}</th>${actual.columnas.map(c => `<th class="rend-num">${escapeHtml(c.label)}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table></div>`;
  panel.querySelectorAll('[data-tabla]').forEach(b => b.addEventListener('click', () => { tablaActiva = b.dataset.tabla; renderTablas(data); }));
  panel.querySelectorAll('[data-persona]').forEach(tr => {
    const enfocar = () => { state.reporte.personaIds = [tr.dataset.persona]; cargarReportes(); };
    tr.addEventListener('click', enfocar);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enfocar(); } });
  });
}

function renderVales(data) {
  const panel = $('#rep-panel-vales');
  const v = data.vales;
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
