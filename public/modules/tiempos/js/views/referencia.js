// public/modules/tiempos/js/views/referencia.js
// La tabla de referencia: los tiempos de todos los productos, sin calcular nada. Solo lectura.
import { h, icono, montar } from '../utils/dom.js';
import { cargando } from '../components/ui.js';
import { obtenerTabla } from '../api/tiemposApi.js';
import { textoRango, pluralDias } from '../utils/formato.js';

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function mostrarReferencia(cont) {
  montar(cont, cargando('Cargando la tabla…'));
  const catalogo = await obtenerTabla();
  const p = catalogo.parametros;
  const incluidos = p.colores_incluidos ?? 2;
  let seleccion = catalogo.productos[0] ? catalogo.productos[0].clave : '';
  let busqueda = '';

  // Los avisos de un producto: los que trae la tabla y los que salen de sus reglas.
  const avisosDe = (prod) => {
    const lista = [...prod.avisos];
    if (prod.permiteLanyard) lista.push('Si lleva listón o lanyard cosido, suma la costura de Protextil.');
    if (prod.permiteMoldes) lista.push(`La fundición cubre hasta 3.5 pulgadas; si es mayor, +${pluralDias(p.moldes_dias ?? 2)} por moldes.`);
    lista.push(`Los tiempos incluyen ${incluidos} colores; desde el ${incluidos + 1}.er, +${pluralDias(p.colores_dias ?? 1)} por cada ${p.colores_cada ?? 2} colores.`);
    return lista;
  };
  const coincide = (prod, q) => !q || sinAcentos(`${prod.nombre} ${prod.grupo || ''} ${avisosDe(prod).join(' ')}`).includes(q);

  const refs = { lista: h('nav', { class: 'tm-card tm-ref-lista', 'aria-label': 'Productos' }), detalle: h('section', { class: 'tm-card tm-ref-detalle', 'aria-live': 'polite' }), selector: h('select', { class: 'tm-ref-selector', 'aria-label': 'Producto' }) };
  const buscador = h('input', { type: 'search', class: 'tm-buscador tm-buscador--pagina', placeholder: 'Buscar producto (ej. lanyard)', 'aria-label': 'Buscar producto', autocomplete: 'off' });

  function filtrados() { const q = sinAcentos(busqueda.trim()); return catalogo.productos.filter(x => coincide(x, q)); }

  function pintarLista() {
    const productos = filtrados();
    if (productos.length && !productos.some(x => x.clave === seleccion)) seleccion = productos[0].clave;
    const nodos = [];
    if (busqueda.trim()) {
      nodos.push(h('div', { class: 'tm-lista-linea', text: `${productos.length} RESULTADO${productos.length === 1 ? '' : 'S'} PARA «${busqueda.trim().toUpperCase()}»` }));
    }
    for (const l of catalogo.lineas) {
      const delaLinea = productos.filter(x => x.linea === l.clave);
      if (!delaLinea.length) continue;
      if (!busqueda.trim()) nodos.push(h('div', { class: 'tm-lista-linea', text: l.nombre.toUpperCase() }));
      let grupo = Symbol('x');
      for (const x of delaLinea) {
        if (x.grupo !== grupo) { grupo = x.grupo; if (x.grupo) nodos.push(h('div', { class: 'tm-lista-grupo', text: x.grupo })); }
        nodos.push(h('button', { class: `tm-opcion${x.clave === seleccion ? ' tm-opcion--activa' : ''}`, type: 'button', 'aria-current': x.clave === seleccion ? 'true' : null, onclick: () => { seleccion = x.clave; pintarLista(); pintarDetalle(); }, text: busqueda.trim() ? `${x.nombre} · ${l.nombre}` : x.nombre }));
      }
    }
    if (!productos.length) nodos.push(h('div', { class: 'tm-vacio-lista' }, h('strong', { text: `No encontramos «${busqueda.trim()}»` }), h('p', { class: 'tm-tenue', text: 'Revisa cómo está escrito o prueba con otra palabra.' }), h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { buscador.value = ''; busqueda = ''; pintarLista(); pintarDetalle(); } }, 'Borrar búsqueda')));
    montar(refs.lista, nodos);
    refs.selector.replaceChildren(...productos.map(x => h('option', { value: x.clave, text: x.nombre })));
    refs.selector.value = seleccion;
  }

  function pintarDetalle() {
    const prod = catalogo.productos.find(x => x.clave === seleccion);
    if (!prod) { montar(refs.detalle, h('p', { class: 'tm-tenue', text: busqueda.trim() ? 'No hay un producto que coincida con la búsqueda.' : 'No hay productos en la tabla.' })); return; }
    const fijos = prod.rangos.filter(r => !r.aConvenir);
    const abierto = prod.rangos.find(r => r.aConvenir);
    const tabla = h('div', { class: 'tm-tabla-caja' }, h('table', { class: 'tm-tabla' },
      h('thead', null, h('tr', null, h('th', { text: 'Cantidad' }), prod.etapas.map(e => h('th', { class: 'tm-num', text: e.nombre })), h('th', { class: 'tm-num', text: 'Cliente' }))),
      h('tbody', null, fijos.map(r => h('tr', null, h('td', { text: textoRango(r) }), prod.etapas.map(e => h('td', { class: 'tm-num', text: String(r.dias[e.clave]) })), h('td', { class: 'tm-num tm-cliente', text: String(r.cliente) }))),
        abierto ? h('tr', { class: 'tm-fila-convenir' }, h('td', { text: `${abierto.desde}+` }), h('td', { colspan: String(prod.etapas.length + 1), text: 'Tiempo a convenir' })) : null)));
    const tarjetas = h('div', { class: 'tm-ref-tarjetas' }, prod.rangos.map(r => h('div', { class: `tm-ref-tarjeta${r.aConvenir ? ' tm-ref-tarjeta--convenir' : ''}` },
      h('div', { class: 'tm-ref-tarjeta-cab' }, h('strong', { text: r.aConvenir ? `${r.desde}+ piezas` : `${textoRango(r)} piezas` }), r.aConvenir ? null : h('span', { class: 'tm-ref-cliente', text: `Cliente ${pluralDias(r.cliente)}` })),
      h('p', { class: 'tm-tenue', text: r.aConvenir ? 'Tiempo a convenir' : prod.etapas.map(e => `${e.nombre} ${r.dias[e.clave]}`).join(' · ') }))));
    montar(refs.detalle,
      h('div', { class: 'tm-ref-titulo' }, h('h2', { text: prod.nombre }), prod.grupo ? h('span', { class: 'tm-etiqueta-gris', text: prod.grupo }) : null),
      tabla, tarjetas,
      h('p', { class: 'tm-tenue', text: 'Los números son días hábiles. «Cliente» es la suma de las etapas más 1 día de margen: es lo que se promete al cliente.' }),
      h('div', { class: 'tm-nota' }, h('strong', { text: 'Antes de prometer, revisa' }), h('ul', null, [...avisosDe(prod), ...catalogo.avisosGenerales].map(a => h('li', { text: a })))),
      h('p', { class: 'tm-tenue', text: `Tabla de tiempos v${catalogo.version.numero} · ${catalogo.version.fecha.split('-').reverse().join('/')}` }));
  }

  buscador.addEventListener('input', () => { busqueda = buscador.value; pintarLista(); pintarDetalle(); });
  refs.selector.addEventListener('change', () => { seleccion = refs.selector.value; pintarLista(); pintarDetalle(); });
  pintarLista(); pintarDetalle();
  montar(cont,
    h('div', { class: 'tm-titulo' }, h('div', null, h('h1', { text: 'Tabla de referencia' }), h('p', { text: 'Consulta los tiempos de todos los productos, sin calcular nada.' })), buscador),
    h('div', { class: 'tm-referencia' }, refs.lista, h('div', { class: 'tm-ref-movil' }, refs.selector), refs.detalle));
  return {};
}
