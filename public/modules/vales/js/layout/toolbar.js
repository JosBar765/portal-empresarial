import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { ROL } from '../config/roles.js';
import { isoLocal, parseIsoLocal, primerDiaDelMes } from '../utils/fechas.js';
import { htmlCampoFechaCompacto, wireCampoFecha } from '../components/datepicker.js';
import { cargarBuzon } from '../views/buzon.js';

export function wireToolbar() {
  // El rango de fechas reusa el mismo componente de calendario propio de los
  // modales (antes eran <input type="date"> nativos, cuyo ícono/calendario de
  // fábrica del navegador desentonaba junto a los chips de la barra). Aquí sí
  // necesita ser limpiable (filtro opcional, a diferencia de un campo de
  // formulario requerido), de ahí el botón "×" propio de la variante compacta.
  const rangoRoot = $('#ventana-rango');
  rangoRoot.innerHTML = htmlCampoFechaCompacto('ventana-desde', 'Desde') +
    '<span class="ventana-rango-sep">—</span>' +
    htmlCampoFechaCompacto('ventana-hasta', 'Hasta');
  const apiDesde = wireCampoFecha(rangoRoot, 'ventana-desde', { placeholder: 'Desde' });
  const apiHasta = wireCampoFecha(rangoRoot, 'ventana-hasta', { placeholder: 'Hasta' });

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const chipTodo = $('.chip[data-ventana="todo"]');
  const mesNav = $('#mes-nav');

  // Refleja state.ventana: "Todo" resaltado, el mes resaltado y activo, o el mes desactivado mientras hay un rango.
  const pintarVentana = () => {
    const { tipo, fecha } = state.ventana;
    chipTodo.classList.toggle('chip-active', tipo === 'todo');
    mesNav.classList.toggle('is-activo', tipo === 'mes');
    mesNav.classList.toggle('is-desactivado', tipo === 'rango');
    mesNav.querySelectorAll('button').forEach(b => { b.disabled = tipo === 'rango'; });
    $('#mes-prev').disabled = $('#mes-next').disabled = tipo !== 'mes';
    const ref = parseIsoLocal(fecha || state.ventana.fecha) || new Date();
    $('#mes-etiqueta').textContent = `${MESES[ref.getMonth()]} ${ref.getFullYear()}`;
  };
  const irAlMes = (fechaMes) => {
    state.ventana = { tipo: 'mes', fecha: isoLocal(primerDiaDelMes(fechaMes)), desde: null, hasta: null };
    pintarVentana();
    cargarBuzon();
  };
  const mesElegido = () => parseIsoLocal(state.ventana.fecha);

  chipTodo.addEventListener('click', () => {
    state.ventana = { tipo: 'todo', fecha: state.ventana.fecha, desde: null, hasta: null };
    apiDesde.clear({ silent: true });
    apiHasta.clear({ silent: true });
    apiHasta.setMinDate(null);
    pintarVentana();
    cargarBuzon();
  });
  $('#mes-prev').addEventListener('click', () => { const m = mesElegido(); irAlMes(new Date(m.getFullYear(), m.getMonth() - 1, 1)); });
  $('#mes-next').addEventListener('click', () => { const m = mesElegido(); irAlMes(new Date(m.getFullYear(), m.getMonth() + 1, 1)); });
  // Desde "Todo", pulsar el mes vuelve al mes actual.
  $('#mes-etiqueta').addEventListener('click', () => irAlMes(new Date()));
  pintarVentana();

  const onRangoChange = () => {
    const desde = apiDesde.getDate() ? isoLocal(apiDesde.getDate()) : null;
    const hasta = apiHasta.getDate() ? isoLocal(apiHasta.getDate()) : null;
    if (!desde && !hasta) {
      // Al limpiar el rango, vuelve al mes actual.
      irAlMes(new Date());
      return;
    }
    state.ventana = { tipo: 'rango', fecha: state.ventana.fecha, desde, hasta };
    pintarVentana();
    cargarBuzon();
  };
  rangoRoot.querySelector('[data-date-field="ventana-desde"] input[type="hidden"]').addEventListener('change', () => {
    apiHasta.setMinDate(apiDesde.getDate());
    onRangoChange();
  });
  rangoRoot.querySelector('[data-date-field="ventana-hasta"] input[type="hidden"]').addEventListener('change', onRangoChange);
  // Búsqueda contra el servidor — corre sobre TODOS los vales del buzón, no
  // solo la página ya cargada; debounced para no disparar una petición por
  // cada tecla.
  let debounceBusqueda;
  $('#filtro-texto').addEventListener('input', (e) => {
    clearTimeout(debounceBusqueda);
    const valor = e.target.value.trim();
    debounceBusqueda = setTimeout(() => { state.busqueda = valor; cargarBuzon(); }, 300);
  });
  $('#filtro-estado').addEventListener('change', (e) => {
    state.estadoFiltro = e.target.value;
    cargarBuzon();
  });

  // Filtro de tienda — Gerencia y Supervisor de Ventas. `tiendasGerencia`
  // (catalogos) ya viene acotado a lo que cada uno puede filtrar: el catálogo
  // completo para Gerente/Administrador, solo sus tiendas cubiertas para
  // Supervisor.
  if ([ROL.SUPERVISOR, ROL.GERENTE].includes(state.user.rolId)) {
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
