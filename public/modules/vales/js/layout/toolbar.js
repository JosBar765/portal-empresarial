import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { ROL, ROLES_ENCARGADO_TALLER, rolEncargadoDe } from '../config/roles.js';
import { obtenerDisenadoresAsignables, obtenerCalendarioBuzon } from '../api/valesApi.js';
import { crearBarraPeriodo } from '../components/barraPeriodoReportes.js';
import { ROLES_TALLER_Y_DISENADOR } from '../config/roles.js';
import { cargarBuzon } from '../views/buzon.js';

// «Ver reporte de este día»: abre la pestaña Reportes con período «Día» en esa fecha de entrega.
function verReporteDelDia(iso) {
  state.reporte.ventana = { tipo: 'dia', fecha: iso, desde: '', hasta: '' };
  state.reporte.expandidos.clear();
  const boton = document.querySelector('.sidebar-item[data-vista="reportes"]');
  if (boton && boton.style.display !== 'none') boton.click();
}

export function wireToolbar() {
  // Misma barra de período que Reportes (Hoy · Día · Semana · Mes · Desde–Hasta), con su propio estado: state.ventana.
  const cambiarVentana = (ventana) => { state.ventana = ventana; barra.pintar(); cargarBuzon(); };
  // El Supervisor (con vales.ver_cupo) ve el cupo de los talleres por día; el Diseñador y el Encargado/Asistente, cuántos vales tienen.
  const permisos = state.user.permissions || [];
  const conInfoPorDia = permisos.includes('vales.ver_cupo') || ROLES_TALLER_Y_DISENADOR.includes(rolEncargadoDe(state.user));
  const barra = crearBarraPeriodo($('#ventana-barra'), {
    prefijo: 'vt',
    obtener: () => state.ventana,
    alCambiar: cambiarVentana,
    cargarInfoMes: conInfoPorDia ? obtenerCalendarioBuzon : null,
    alVerVales: (iso) => cambiarVentana({ ...state.ventana, tipo: 'dia', fecha: iso }),
    alVerReporte: permisos.includes('vales.ver_reportes') ? verReporteDelDia : null
  });
  // Búsqueda contra el servidor — corre sobre TODOS los vales del buzón, no
  // solo la página ya cargada; debounced para no disparar una petición por
  // cada tecla.
  let debounceBusqueda;
  $('#filtro-texto').addEventListener('input', (e) => {
    clearTimeout(debounceBusqueda);
    const valor = e.target.value.trim();
    debounceBusqueda = setTimeout(() => { state.busqueda = valor; cargarBuzon(); }, 300);
  });
  // Combobox de diseñadores del encargado: filtra el Buzón por el diseñador asignado (se combina con los contadores).
  if (ROLES_ENCARGADO_TALLER.includes(rolEncargadoDe(state.user))) {
    const selectDisenador = $('#filtro-disenador');
    obtenerDisenadoresAsignables().then(disenadores => {
      (Array.isArray(disenadores) ? disenadores : []).forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.nombre;
        selectDisenador.appendChild(opt);
      });
    }).catch(() => { /* sin la lista el combobox queda solo con «Todos los diseñadores» */ });
    selectDisenador.addEventListener('change', (e) => {
      state.disenadorFiltro = e.target.value;
      cargarBuzon();
    });
  }

  // Filtro de tienda — Gerencia y Supervisor de Ventas. `tiendasGerencia`
  // (catalogos) ya viene acotado a lo que cada uno puede filtrar: el catálogo
  // completo para Gerente/Administrador, solo sus tiendas cubiertas para
  // Supervisor.
  if ([ROL.SUPERVISOR, ROL.GERENTE, ROL.ADMINISTRADOR].includes(rolEncargadoDe(state.user))) {
    const selectTienda = $('#filtro-tienda');
    selectTienda.style.display = '';
    (state.catalogos.tiendasGerencia || state.catalogos.tiendas || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.nombre;
      selectTienda.appendChild(opt);
    });
    selectTienda.addEventListener('change', () => {
      state.tiendaId = selectTienda.value || null;
      cargarBuzon();
    });
  }
}

export function wireSortHeaders() {
  $$('.buzon-table thead th[data-sort-key]').forEach(th => {
    th.innerHTML = `${th.textContent}<span class="sort-arrow">⇅</span>`;
    th.addEventListener('click', () => {
      const key = th.dataset.sortKey;
      if (state.sort.key !== key) {
        state.sort = { key, dir: 'asc' };
      } else if (state.sort.dir === 'asc') {
        state.sort.dir = 'desc';
      } else {
        state.sort = { key: null, dir: null };
      }
      actualizarIndicadoresOrden();
      // El orden por columna corre en el servidor sobre el conjunto completo,
      // no solo sobre la página ya cargada — hace falta un refetch, no solo
      // repintar.
      cargarBuzon();
    });
  });
}

export function actualizarIndicadoresOrden() {
  $$('.buzon-table thead th[data-sort-key]').forEach(th => {
    const activo = th.dataset.sortKey === state.sort.key;
    th.classList.toggle('sort-active', activo);
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) arrow.textContent = activo ? (state.sort.dir === 'asc' ? '▲' : '▼') : '⇅';
  });
}
