import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { ROL, ROLES_ENCARGADO_TALLER } from '../config/roles.js';
import { obtenerDisenadoresAsignables } from '../api/valesApi.js';
import { hoyMedianoche, isoLocal, parseIsoLocal, primerDiaDelMes, sumarDiaLocal } from '../utils/fechas.js';
import { htmlCampoFechaCompacto, wireCampoFecha } from '../components/datepicker.js';
import { wireSelectorPeriodo, etiquetaDia, etiquetaMes } from '../components/selectorPeriodo.js';
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

  const chipTodo = $('.chip[data-ventana="todo"]');
  const chipHoy = $('.chip[data-ventana="hoy"]');
  const mesNav = $('#mes-nav');

  // Refleja state.ventana: «Todo» o «Hoy» resaltados; el selector resaltado con un mes o un día elegido (su
  // etiqueta dice cuál) y las flechas solo activas en esos dos modos.
  const pintarVentana = () => {
    const { tipo, fecha } = state.ventana;
    chipTodo.classList.toggle('chip-active', tipo === 'todo');
    chipHoy.classList.toggle('chip-active', tipo === 'dia' && fecha === isoLocal(hoyMedianoche()));
    mesNav.classList.toggle('is-activo', tipo === 'mes' || tipo === 'dia');
    $('#mes-prev').disabled = $('#mes-next').disabled = tipo !== 'mes' && tipo !== 'dia';
    const ref = parseIsoLocal(fecha) || new Date();
    $('#mes-etiqueta-texto').textContent = tipo === 'dia' ? etiquetaDia(ref) : etiquetaMes(ref);
  };
  // Elegir un mes o un día reemplaza cualquier rango Desde/Hasta.
  const limpiarRango = () => {
    apiDesde.clear({ silent: true });
    apiHasta.clear({ silent: true });
    apiHasta.setMinDate(null);
  };
  const aplicarVentana = (ventana) => {
    state.ventana = { desde: null, hasta: null, ...ventana };
    limpiarRango();
    pintarVentana();
    cargarBuzon();
  };
  const irAlMes = (fechaMes) => aplicarVentana({ tipo: 'mes', fecha: isoLocal(primerDiaDelMes(fechaMes)) });
  const irAlDia = (fechaDia) => aplicarVentana({ tipo: 'dia', fecha: isoLocal(fechaDia) });
  const fechaElegida = () => parseIsoLocal(state.ventana.fecha);
  // Las flechas avanzan de mes en mes o de día en día según lo elegido.
  const mover = (paso) => {
    const f = fechaElegida();
    if (state.ventana.tipo === 'dia') irAlDia(sumarDiaLocal(f, paso));
    else irAlMes(new Date(f.getFullYear(), f.getMonth() + paso, 1));
  };

  chipTodo.addEventListener('click', () => aplicarVentana({ tipo: 'todo', fecha: state.ventana.fecha }));
  chipHoy.addEventListener('click', () => irAlDia(hoyMedianoche()));
  $('#mes-prev').addEventListener('click', () => mover(-1));
  $('#mes-next').addEventListener('click', () => mover(1));
  wireSelectorPeriodo($('#mes-etiqueta'), {
    obtener: () => state.ventana,
    alElegir: ({ tipo, fecha }) => (tipo === 'dia' ? irAlDia(fecha) : irAlMes(fecha))
  });
  pintarVentana();

  const onRangoChange = () => {
    const desde = apiDesde.getDate() ? isoLocal(apiDesde.getDate()) : null;
    const hasta = apiHasta.getDate() ? isoLocal(apiHasta.getDate()) : null;
    if (!desde && !hasta) {
      // Al limpiar el rango, vuelve a "Todo", el valor por defecto.
      state.ventana = { tipo: 'todo', fecha: state.ventana.fecha, desde: null, hasta: null };
      pintarVentana();
      cargarBuzon();
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
  // Combobox de diseñadores del encargado: filtra el Buzón por el diseñador asignado (se combina con los contadores).
  if (ROLES_ENCARGADO_TALLER.includes(state.user.rolId)) {
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
  if ([ROL.SUPERVISOR, ROL.GERENTE, ROL.ADMINISTRADOR].includes(state.user.rolId)) {
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
