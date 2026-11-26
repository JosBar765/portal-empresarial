import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { ROL, esEncargadoTaller, esDeTallerODisenador, rolVista } from '../config/roles.js';
import { obtenerDisenadoresAsignables, obtenerCalendarioBuzon } from '../api/valesApi.js';
import { crearBarraPeriodo } from '../components/barraPeriodoReportes.js';
import { cargarBuzon } from '../views/buzon.js';
import { crearFiltroTiendas } from '/js/menuCascada.js';
import { sincronizarAlcance, guardarAlcance } from '../utils/alcanceVales.js';
import { resolverTiendaIds, resolverAsesorIds, valorDeAsesor } from '/js/filtroCascada.js';
import { restaurarFiltrosReportes2 } from '../utils/filtrosReportes2.js';

// «Ver reporte de este día»: abre la pestaña Reportes con período «Día» en esa fecha de entrega.
function verReporteDelDia(iso) {
  restaurarFiltrosReportes2(); // antes de fijar la ventana: lo fijado aquí debe ganar sobre lo guardado
  state.reporte2.ventana = { tipo: 'dia', fecha: iso, desde: '', hasta: '' };
  const boton = document.querySelector('.sidebar-item[data-vista="reportes2"]');
  if (boton && boton.style.display !== 'none') boton.click();
}

// El filtro de tienda del Buzón y de Trabajo realizado se recuerda por usuario en este navegador (Reportes no).
const claveFiltroTienda = () => `vales.filtroTienda.${state.user.id}`;
const leerFiltroTienda = () => { try { return localStorage.getItem(claveFiltroTienda()); } catch { return null; } };
function guardarFiltroTienda(valor) {
  try {
    if (valor) localStorage.setItem(claveFiltroTienda(), String(valor));
    else localStorage.removeItem(claveFiltroTienda());
  } catch { /* sin almacenamiento el filtro simplemente no se recuerda */ }
}

// Controles de la barra que hay que repintar cuando el buzón se acomoda solo (al abrir un aviso).
let barraPeriodo = null;
let menuTienda = null;
// Se cumple cuando la selección guardada en el servidor ya está aplicada al selector.
export let filtroSincronizado = Promise.resolve();

export function mostrarEnBuzon(ventana, busqueda) {
  Object.assign(state, {
    ventana, busqueda, filtroContador: null, soloAtrasados: false, soloRechazos: false, soloModificados: false,
    disenadorFiltro: '', tiendaId: null, sort: { key: null, dir: null }
  });
  $('#filtro-texto').value = busqueda;
  const selectDisenador = $('#filtro-disenador');
  if (selectDisenador) selectDisenador.value = '';
  // El filtro de tienda recordado no se borra: solo se quita mientras se muestra este vale.
  menuTienda?.actualizar('');
  barraPeriodo?.pintar();
  actualizarIndicadoresOrden();
  cargarBuzon();
}

export function wireToolbar() {
  // Misma barra de período que Reportes (Hoy · Día · Semana · Mes · Desde–Hasta), con su propio estado: state.ventana.
  const cambiarVentana = (ventana) => { state.ventana = ventana; barra.pintar(); cargarBuzon(); };
  // Quien tiene vales.ver_cupo ve el cupo de los talleres por día; el Encargado/Asistente, cuántos vales tiene
  // su taller; el Diseñador, cuántas asignaciones suyas.
  const permisos = state.user.permissions || [];
  const conInfoPorDia = permisos.includes('vales.ver_cupo') || esDeTallerODisenador(state.user);
  const barra = crearBarraPeriodo($('#ventana-barra'), {
    prefijo: 'vt',
    obtener: () => state.ventana,
    alCambiar: cambiarVentana,
    cargarInfoMes: conInfoPorDia ? obtenerCalendarioBuzon : null,
    alVerVales: (iso) => cambiarVentana({ ...state.ventana, tipo: 'dia', fecha: iso }),
    alVerReporte: permisos.includes('vales.ver_reportes') ? verReporteDelDia : null
  });
  barraPeriodo = barra;
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
  if (esEncargadoTaller(state.user)) {
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
  if ([ROL.SUPERVISOR, ROL.GERENTE, ROL.ADMINISTRADOR].includes(rolVista(state.user))) {
    const contenedorTienda = $('#filtro-tienda');
    contenedorTienda.style.display = '';
    const tiendasMenu = state.catalogos.tiendasGerencia || state.catalogos.tiendas || [];
    // Asesores con supervisión especial (solo el Supervisor los recibe); sin ellos el selector queda como antes.
    const asesoresMenu = state.catalogos.asesoresEspeciales || [];
    // El valor recordado puede ser un id, «pais:X», «grupo:Y» o una lista (con «a<id>» por asesor); se pasa a ids y se descartan las tiendas y asesores que ya no están en el catálogo de este usuario.
    const recordado = state.tiendaId == null ? leerFiltroTienda() : state.tiendaId;
    if (recordado) {
      const ids = [
        ...resolverTiendaIds(recordado, tiendasMenu).filter(id => tiendasMenu.some(t => Number(t.id) === id)),
        ...resolverAsesorIds(recordado, asesoresMenu).map(valorDeAsesor)
      ];
      state.tiendaId = ids.length ? ids.join(',') : null;
      guardarFiltroTienda(state.tiendaId);
    }
    menuTienda = crearFiltroTiendas({
      tiendas: tiendasMenu,
      asesores: asesoresMenu,
      multiple: true,
      valorActual: state.tiendaId ? String(state.tiendaId) : '',
      // Vacío = sin filtro; si no, lista «3,7,9» (los asesores como «a12»).
      onSeleccionar: (valor) => {
        state.tiendaId = valor ? String(valor) : null;
        guardarFiltroTienda(state.tiendaId);
        cargarBuzon();
        guardarAlcance(state.tiendaId);
      }
    });
    contenedorTienda.appendChild(menuTienda.elemento);

    // La campana sigue esta misma selección. «Ver» y «Ver todas» desde la campana pasan por aquí.
    const aplicarValor = (valor) => {
      state.tiendaId = valor || null;
      guardarFiltroTienda(state.tiendaId);
      menuTienda.actualizar(valor);
      cargarBuzon();
    };
    filtroSincronizado = sincronizarAlcance(state.tiendaId || '', (valor) => { aplicarValor(valor); guardarAlcance(valor); })
      .then((valor) => { if (valor !== null && valor !== (state.tiendaId || '')) aplicarValor(valor); });
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
