// Clientes ganados (M14): las empresas con venta confirmada en cualquier proyecto, para posventa y recompra.
// Cada quien ve según su alcance (el servidor lo decide). Ruta: #/ganados.
import { h, icono, montar } from '../utils/dom.js';
import { cabecera, cargando, estadoVacio, avisar } from '../components/ui.js';
import { listarClientesGanados } from '../api/api.js';
import { formatoMonto, diaCorto } from '../utils/gestion.js';
import { accionesDeContacto } from './miProyecto.js';
import { state } from '../state.js';

const ESPERA_BUSQUEDA_MS = 350;
const RECOMPRA = [['', 'Toda la cartera'], ['vencida', 'Recompra vencida'], ['proxima', 'Recompra próxima (30 días)']];
let filtrosRecordados = { busqueda: '', nicho: '', periodo: '', recompra: '' };

const fechaLarga = (dia) => `${diaCorto(dia)} ${String(dia).slice(0, 4)}`;
const textoRecompra = (r) => {
  if (r.estado === 'vencida') return r.dias === -1 ? 'Recompra sugerida: venció ayer' : `Recompra sugerida: venció hace ${Math.abs(r.dias)} días`;
  if (r.dias === 0) return 'Recompra sugerida: hoy';
  return r.estado === 'proxima' ? `Recompra sugerida: en ${r.dias} ${r.dias === 1 ? 'día' : 'días'}` : `Recompra sugerida: ${fechaLarga(r.fecha)}`;
};
const ubicacion = (e) => [e.ciudad, e.pais].filter(Boolean).join(' · ') || '—';
const ultimaVenta = (e) => `${fechaLarga(e.ultimaVenta.fecha)} · ${formatoMonto(e.ultimaVenta.monto, e.ultimaVenta.moneda)}${e.ultimaVenta.referencia ? ` · ${e.ultimaVenta.referencia}` : ''}`;
const totales = (e) => e.totales.map(t => formatoMonto(t.monto, t.moneda)).join(' · ');

// «Crear vale» abre Vales con el vale prellenado para la recompra: solo viaja el id de la empresa, nunca datos personales.
const hrefCrearVale = (e) => `/modules/vales/?prellenar=clientes:${encodeURIComponent(e.id)}`;

function filaDeTabla(e, puedeVale) {
  return h('tr', null,
    h('td', null, h('a', { class: 'cliente-enlace', href: `#/clientes/${e.id}`, text: e.nombre })),
    h('td', { text: e.nicho }),
    h('td', { text: ubicacion(e) }),
    h('td', { text: ultimaVenta(e) }),
    h('td', { class: 'num', text: String(e.ventas) }),
    h('td', { text: totales(e) }),
    h('td', null, h('span', { class: `recompra recompra--${e.recompra.estado}`, text: textoRecompra(e.recompra).replace('Recompra sugerida: ', '') })),
    h('td', null, accionesDeContacto(e.telefono, { texto: false }), puedeVale ? h('a', { class: 'btn btn--ghost btn--chico', href: hrefCrearVale(e), 'aria-label': 'Crear vale' }, icono('document-text-outline')) : null));
}

function tarjeta(e, puedeVale) {
  return h('article', { class: 'tarjeta-hoy tarjeta-hoy--grande' },
    h('a', { class: 'tarjeta-hoy-enlace', href: `#/clientes/${e.id}` },
      h('div', { class: 'tarjeta-hoy-fila' }, h('strong', { text: e.nombre })),
      h('div', { class: 'texto-tenue', text: ubicacion(e) }),
      h('div', { class: 'alerta-linea alerta-linea--neutra' }, icono('cash-outline'), `Última venta ${ultimaVenta(e)}`),
      h('div', { class: `alerta-linea${e.recompra.estado === 'vencida' ? ' alerta-linea--roja' : ' alerta-linea--neutra'}` }, icono('refresh-outline'), textoRecompra(e.recompra))),
    h('div', { class: 'contacto-acciones' }, accionesDeContacto(e.telefono, { texto: true }), puedeVale ? h('a', { class: 'btn btn--ghost btn--chico', href: hrefCrearVale(e) }, icono('document-text-outline'), 'Crear vale') : null));
}

function exportar(filtros) {
  const limpios = Object.entries(filtros).filter(([, v]) => v !== '' && v != null);
  const enlace = document.createElement('a');
  enlace.href = `/api/proyectos/clientes-ganados/exportar.csv${limpios.length ? `?${new URLSearchParams(limpios)}` : ''}`;
  enlace.download = '';
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
}

export async function renderClientesGanados(cont) {
  montar(cont, cargando());
  const filtros = { ...filtrosRecordados };
  const items = [];
  let datos = null;
  let pagina = 0;
  let numeroConsulta = 0;
  let temporizador = null;
  const zonaResultados = h('div');
  const zonaPie = h('div', { class: 'tabla-pie' });
  const zonaFiltros = h('div', { class: 'panel filtros filtros--clientes' });
  const entrada = h('input', { type: 'search', placeholder: 'Buscar por nombre', maxlength: 100, 'aria-label': 'Buscar empresa', autocomplete: 'off' });
  entrada.value = filtros.busqueda;

  const lista = (clave, etiqueta, opciones) => {
    const control = h('select', { 'aria-label': etiqueta }, opciones.map(([v, t]) => h('option', { value: String(v), text: t })));
    control.value = String(filtros[clave]);
    control.addEventListener('change', () => { filtros[clave] = control.value; cargar(true); });
    return h('div', { class: 'campo' }, h('label', { text: etiqueta }), control);
  };
  const dibujarFiltros = () => montar(zonaFiltros,
    h('div', { class: 'campo campo--busqueda' }, h('label', { text: 'Buscar' }), entrada),
    lista('nicho', 'Nicho', [['', 'Todos los nichos'], ...datos.nichos.map(n => [n.id, n.nombre])]),
    lista('periodo', 'Última venta', [['', 'Sin límite'], ...datos.periodos.map(m => [m, `Últimos ${m} meses`])]),
    lista('recompra', 'Recompra', RECOMPRA));

  async function cargar(desdeCero) {
    const mia = ++numeroConsulta;
    if (desdeCero) { pagina = 0; items.length = 0; }
    filtrosRecordados = { ...filtros };
    try {
      const r = await listarClientesGanados({ ...filtros, pagina: pagina + 1 });
      if (mia !== numeroConsulta) return;
      const primera = datos === null;
      datos = r;
      pagina = r.pagina;
      items.push(...r.items);
      if (primera) dibujarFiltros();
      dibujar();
    } catch (error) {
      if (mia !== numeroConsulta) return;
      avisar('error', 'No se pudo cargar la lista', error.message);
    }
  }

  function dibujar() {
    const puedeVale = datos.permisos.crearVale;
    if (!items.length) {
      const filtrado = filtros.busqueda || filtros.nicho || filtros.periodo || filtros.recompra;
      montar(zonaResultados, h('div', { class: 'tabla-caja' }, filtrado
        ? estadoVacio('Ninguna empresa coincide', 'Prueba con otra búsqueda o quita algún filtro.', 'search-outline')
        : estadoVacio('Todavía no hay clientes ganados', 'Cuando una venta quede confirmada, la empresa aparecerá aquí para la posventa.', 'trophy-outline')));
      montar(zonaPie);
      return;
    }
    montar(zonaResultados,
      h('div', { class: 'tabla-caja clientes-tabla' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
        h('thead', null, h('tr', null, ['Empresa', 'Nicho', 'Ubicación', 'Última venta', 'Ventas', 'Total vendido', 'Recompra', 'Acciones'].map(t => h('th', { class: t === 'Ventas' ? 'num' : null, text: t })))),
        h('tbody', null, items.map(e => filaDeTabla(e, puedeVale)))))),
      h('div', { class: 'clientes-tarjetas' }, items.map(e => tarjeta(e, puedeVale))));
    montar(zonaPie,
      h('span', { text: `Mostrando ${items.length} de ${datos.total} ${datos.total === 1 ? 'empresa' : 'empresas'}` }),
      datos.hayMas ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => cargar(false) }, 'Cargar más') : null);
  }

  entrada.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { filtros.busqueda = entrada.value.trim(); cargar(true); }, ESPERA_BUSQUEDA_MS);
  });

  await cargar(true);
  if (!datos) return;
  montar(cont,
    cabecera({
      titulo: 'Clientes ganados',
      subtitulo: `Empresas con venta confirmada, ordenadas por recompra sugerida (${datos.mesesRecompra} ${datos.mesesRecompra === 1 ? 'mes' : 'meses'} después de la última venta).`,
      acciones: state.user.permissions.includes('proyectos.ver_reportes') ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => exportar(filtros) }, icono('grid-outline'), 'Exportar CSV') : null
    }),
    zonaFiltros, zonaResultados, zonaPie);
}
