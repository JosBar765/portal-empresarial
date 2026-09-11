import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { DASHBOARD_CONTADORES } from '../config/contadores.js';
import { claseEstado, etiquetaEstado } from '../permisos.js';
import { formatearFecha, formatearFechaHora, celdaTaller } from '../utils/formato.js';
import { obtenerDashboardGerencia } from '../api/valesApi.js';
import { abrirModalHistorial } from '../actions/historial.js';

// -----------------------------------------------------------------------
// Dashboard de Gerencia/Supervisor — 5 contadores con drill-down (Total,
// Recibidos, En Progreso, Modificados, Atrasados). Modificados y Atrasados
// son interruptores combinables con Recibidos/En Progreso (mismo mecanismo
// que `soloAtrasados` en el buzón normal) en vez de una categoría propia.
// Sin gráficas. Reusa `state.filtroContador`/`state.soloAtrasados`/
// `state.soloModificados`/`state.busqueda` — la vista sidebar ya los
// resetea al cambiar (ver layout/sidebar.js), así que no se contaminan
// entre vistas.
// -----------------------------------------------------------------------
function construirQueryDashboard() {
  const qs = new URLSearchParams();
  if (state.ventana.tipo) qs.set('ventana', state.ventana.tipo);
  if (state.ventana.tipo === 'rango') {
    if (state.ventana.desde) qs.set('desde', state.ventana.desde);
    if (state.ventana.hasta) qs.set('hasta', state.ventana.hasta);
  }
  if (state.tiendaId) qs.set('tiendaId', state.tiendaId);
  if (state.filtroContador) qs.set('filtroContador', state.filtroContador);
  if (state.soloAtrasados) qs.set('soloAtrasados', '1');
  if (state.soloModificados) qs.set('soloModificados', '1');
  if (state.busqueda) qs.set('busqueda', state.busqueda);
  return qs;
}

export async function cargarDashboardGerencia() {
  try {
    const data = await obtenerDashboardGerencia(construirQueryDashboard());
    renderDashboardGerencia(data);
  } catch (error) {
    $('#dashboard-gerencia').innerHTML = `<p class="tabla-vacia">Error al cargar el dashboard: ${error.message}</p>`;
  }
}

// Actualización en tiempo real (ver socket.js, handler de vale_evento): a
// diferencia de cargarDashboardGerencia, NO reconstruye la grilla de
// tarjetas — solo toca los números que deben quedar vivos (Total y
// Atrasados siempre; Recibidos/En Progreso y Modificados solo cuando la
// selección activa depende de ellos), para no hacer parpadear tarjetas que
// gerencia no está mirando en ese momento. Si hay una lista de resultados
// abierta, también se refresca.
export async function actualizarDashboardGerenciaEnVivo() {
  const cont = $('#dashboard-gerencia');
  if (!cont || !cont.dataset.wired) return; // esta vista nunca se ha renderizado, nada que actualizar
  try {
    const data = await obtenerDashboardGerencia(construirQueryDashboard());
    actualizarContadoresEnVivo(data);
    const hayListaActiva = !!state.filtroContador || state.soloAtrasados || state.soloModificados || !!state.busqueda;
    if (hayListaActiva) renderTablaDashboard(data.vales || []);
  } catch { /* best-effort: un fallo de red aquí no debe interrumpir la vista, la próxima recarga normal ya lo cubre */ }
}

// El esqueleto (grid de contadores + sección de lista con su buscador) se
// construye UNA sola vez (`cont.dataset.wired`) — reconstruirlo en cada
// recarga destruiría el <input> de búsqueda y le haría perder el foco a cada
// tecleo. Los re-renders posteriores solo tocan los contadores y el <tbody>
// de la lista.
function renderDashboardGerencia(data) {
  const cont = $('#dashboard-gerencia');
  if (!cont.dataset.wired) {
    cont.innerHTML = `
      <div class="contadores-grid" id="dashboard-contadores"></div>
      <div class="dashboard-lista" id="dashboard-lista" style="display:none;">
        <div class="buzon-toolbar">
          <h2>Resultados</h2>
          <div class="buzon-filtros">
            <input type="text" id="dashboard-busqueda" placeholder="Buscar por correlativo o cliente..." />
          </div>
        </div>
        <div class="tabla-wrapper">
          <table class="buzon-table data-table sticky-header">
            <thead>
              <tr>
                <th>Correlativo</th>
                <th>Fecha Ingreso</th>
                <th>Fecha Entrega</th>
                <th>Atraso</th>
                <th>Fecha Evento</th>
                <th class="col-taller">Taller</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="dashboard-lista-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    let debounceBusquedaDash;
    $('#dashboard-busqueda', cont).addEventListener('input', (e) => {
      clearTimeout(debounceBusquedaDash);
      const valor = e.target.value.trim();
      debounceBusquedaDash = setTimeout(() => { state.busqueda = valor; cargarDashboardGerencia(); }, 300);
    });
    cont.dataset.wired = '1';
  }

  renderDashboardContadores(data);
  const hayListaActiva = !!state.filtroContador || state.soloAtrasados || state.soloModificados || !!state.busqueda;
  $('#dashboard-lista', cont).style.display = hayListaActiva ? 'block' : 'none';
  renderTablaDashboard(data.vales || []);
}

function renderDashboardContadores(data) {
  const grid = $('#dashboard-contadores');
  grid.innerHTML = DASHBOARD_CONTADORES.map(c => {
    const valor = data[c.key] ?? 0;
    const pct = c.pctKey ? ` (${data[c.pctKey]}%)` : '';
    const esClickeable = !!c.filtro || !!c.atrasadosGlobal || !!c.modificadosGlobal;
    const activo = c.atrasadosGlobal ? state.soloAtrasados
      : c.modificadosGlobal ? state.soloModificados
      : (c.filtro && state.filtroContador === c.filtro);
    const clases = ['contador-card'];
    if (c.alerta) clases.push('contador-alerta');
    if (esClickeable) clases.push('contador-clickeable');
    if (activo) clases.push('contador-activo');
    return `
      <div class="${clases.join(' ')}" data-key="${c.key}" data-filtro="${c.filtro || ''}" data-atrasados-global="${c.atrasadosGlobal ? '1' : ''}" data-modificados-global="${c.modificadosGlobal ? '1' : ''}">
        <div class="valor">${valor}</div>
        <div class="etiqueta">${c.label}${pct}</div>
      </div>`;
  }).join('');

  $$('.contador-card', grid).forEach(card => {
    const filtro = card.dataset.filtro;
    const esAtrasadosGlobal = card.dataset.atrasadosGlobal === '1';
    const esModificadosGlobal = card.dataset.modificadosGlobal === '1';
    if (!filtro && !esAtrasadosGlobal && !esModificadosGlobal) return;
    card.addEventListener('click', () => {
      if (esAtrasadosGlobal) {
        state.soloAtrasados = !state.soloAtrasados;
      } else if (esModificadosGlobal) {
        state.soloModificados = !state.soloModificados;
      } else {
        state.filtroContador = state.filtroContador === filtro ? null : filtro;
      }
      cargarDashboardGerencia();
    });
  });
}

// Actualización parcial para vale_evento (ver actualizarDashboardGerenciaEnVivo):
// Total y Atrasados siempre; Recibidos/En Progreso (el que esté seleccionado)
// y Modificados solo cuando dependen de esa selección — mismo criterio que ya
// calcula el backend para las tarjetas reactivas.
function actualizarContadoresEnVivo(data) {
  const grid = $('#dashboard-contadores');
  if (!grid) return;
  const clavesVivas = new Set(['total', 'atrasados']);
  if (state.filtroContador) { clavesVivas.add(state.filtroContador); clavesVivas.add('modificados'); }
  DASHBOARD_CONTADORES.forEach(c => {
    if (!clavesVivas.has(c.key)) return;
    const card = grid.querySelector(`[data-key="${c.key}"]`);
    if (!card) return;
    const valor = data[c.key] ?? 0;
    const pct = c.pctKey ? ` (${data[c.pctKey]}%)` : '';
    $('.valor', card).textContent = valor;
    $('.etiqueta', card).textContent = `${c.label}${pct}`;
  });
}

// Lista de drill-down: mismas columnas que el buzón normal, pero con un set
// de acciones FIJO (ver vale, ver propuesta si existe, ver historial) sin
// pasar por construirAcciones (que es por-rol y trae acciones de negocio que
// no aplican acá — esta lista es de solo lectura).
function renderTablaDashboard(vales) {
  const tbody = $('#dashboard-lista-tbody');
  if (!tbody) return;
  if (vales.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="8" class="tabla-vacia">
        <div class="buzon-vacio">
          <ion-icon name="file-tray-outline"></ion-icon>
          <h3>Sin resultados</h3>
          <p>No hay vales de arte para este filtro en la ventana de tiempo actual.</p>
        </div>
      </td></tr>`;
    return;
  }
  tbody.innerHTML = vales.map(v => `
    <tr>
      <td data-label="Correlativo"><strong>${v.correlativo}</strong>${v.urgente ? '<span class="badge badge-urgente">URGENTE</span>' : ''}</td>
      <td data-label="Fecha Ingreso">${formatearFechaHora(v.creado_en || `${v.fecha_creacion} ${v.hora_creacion}`)}</td>
      <td data-label="Fecha Entrega">${formatearFecha(v.fecha_entrega)}</td>
      <td data-label="Atraso">${v.venceHoy ? '<span class="badge badge-hoy">Hoy</span>' : (v.atrasado ? `<span class="badge badge-atraso">${v.diasAtraso}d</span>` : `<span class="badge badge-ok">Al día</span>`)}</td>
      <td data-label="Fecha Evento">${formatearFecha(v.fecha_evento)}</td>
      <td data-label="Taller" class="col-taller">${celdaTaller(v)}</td>
      <td data-label="Estado"><span class="estado-pill ${claseEstado(v)}">${etiquetaEstado(v)}</span></td>
      <td data-label="Acciones" class="acciones-cell" data-vale-id="${v.id}"></td>
    </tr>
  `).join('');

  vales.forEach(v => {
    const cell = tbody.querySelector(`.acciones-cell[data-vale-id="${v.id}"]`);
    // Los botones van en un <div> interno (.acciones-wrap), no directo en la
    // <td> — ver comentario en styles.css.
    const wrap = document.createElement('div');
    wrap.className = 'acciones-wrap';
    cell.appendChild(wrap);
    const acciones = [
      { icono: 'eye-outline', titulo: 'Ver vale de arte (PDF)', onClick: () => window.open(`/api/vales/${v.id}/pdf`, '_blank') }
    ];
    if (v.propuesta_general_url) {
      acciones.push({ icono: 'document-attach-outline', titulo: 'Ver propuesta', onClick: () => window.open(v.propuesta_general_url, '_blank') });
    }
    acciones.push({ icono: 'time-outline', titulo: 'Ver historial', onClick: abrirModalHistorial });
    acciones.forEach(accion => {
      const btn = document.createElement('button');
      btn.className = 'btn-icon';
      btn.title = accion.titulo;
      btn.innerHTML = `<ion-icon name="${accion.icono}"></ion-icon>`;
      btn.addEventListener('click', () => accion.onClick(v));
      wrap.appendChild(btn);
    });
  });
}
