// public/modules/tiempos/js/views/referencia.js
// La tabla de referencia: los tiempos de todos los productos, sin calcular nada. Solo lectura.
import { h, icono, montar } from '../utils/dom.js';
import { cargando } from '../components/ui.js';
import { listaProductos, sinAcentos, metaClientes, guardarReciente } from '../components/listaProductos.js';
import { selectorProducto } from '../components/selectorProducto.js';
import { obtenerTabla } from '../api/tiemposApi.js';
import { textoRango, pluralDias, rangoDe } from '../utils/formato.js';


export async function mostrarReferencia(cont) {
  montar(cont, cargando('Cargando la tabla…'));
  const catalogo = await obtenerTabla();
  let seleccion = catalogo.productos[0] ? catalogo.productos[0].clave : '';
  let cantidad = ''; // la que se escribe en «¿Cuántas piezas?»
  const pedido = new URLSearchParams((window.location.hash.split('?')[1]) || '').get('producto');
  if (pedido && catalogo.productos.some(x => x.clave === pedido)) seleccion = pedido;

  // Los avisos de un producto: los que trae la tabla y, por cada extra que se le ofrece, cuánto suma.
  const avisosDe = (prod) => [
    ...prod.avisos,
    ...prod.extras.map(k => catalogo.extras.find(e => e.clave === k)).filter(Boolean).map(e => `${e.nombre}: ${e.resumen.charAt(0).toLowerCase()}${e.resumen.slice(1)}.`)
  ];
  const coincide = (prod, q) => !q || sinAcentos(`${prod.nombre} ${prod.grupo || ''} ${avisosDe(prod).join(' ')}`).includes(q);

  const refs = { lista: h('nav', { class: 'tm-card tm-ref-lista', 'aria-label': 'Productos' }), detalle: h('section', { class: 'tm-card tm-ref-detalle', 'aria-live': 'polite' }), movil: h('div', { class: 'tm-ref-movil' }), barra: h('div', { class: 'tm-barra-accion' }) };
  const datos = () => ({ lineas: catalogo.lineas, productos: catalogo.productos, valor: seleccion });
  const lista = listaProductos({ datos: datos(), metaDe: metaClientes, coincide: (x, q) => coincide(x, q), placeholder: 'Buscar producto (ej. lanyard)', alElegir: (clave) => elegir(clave) });
  refs.lista.append(lista.nodo);

  function elegir(clave) { seleccion = clave; guardarReciente(clave); lista.actualizar(datos()); pintarMovil(); pintarDetalle(); }
  function pintarMovil() { montar(refs.movil, selectorProducto({ catalogo, valor: seleccion, alElegir: elegir }).nodo); }
  const hashCalcular = () => `#/calculadora?producto=${encodeURIComponent(seleccion)}${/^\d{1,9}$/.test(cantidad) ? `&cantidad=${cantidad}` : ''}`;

  function pintarDetalle() {
    const prod = catalogo.productos.find(x => x.clave === seleccion);
    if (!prod) { montar(refs.detalle, h('p', { class: 'tm-tenue', text: 'No hay productos en la tabla.' })); refs.barra.hidden = true; return; }
    refs.barra.hidden = false;
    const fijos = prod.rangos.filter(r => !r.aConvenir);
    const abierto = prod.rangos.find(r => r.aConvenir);
    const n = /^\d{1,9}$/.test(cantidad) ? Number(cantidad) : null;
    const suyo = n === null ? null : rangoDe(prod, n);
    const tuyo = (r) => Boolean(suyo) && suyo === r;
    let frase = 'Escribe una cantidad para marcar su rango en la tabla.';
    if (n !== null && n < prod.minimo) frase = `Este producto se trabaja desde ${prod.minimo} piezas.`;
    else if (suyo) frase = suyo.aConvenir ? `Rango ${suyo.desde} piezas en adelante · tiempo a convenir` : `Rango ${textoRango(suyo)} piezas · Cliente ${pluralDias(suyo.cliente)}`;
    const entradaCant = h('input', { type: 'text', inputmode: 'numeric', class: 'tm-cant-ref', 'aria-label': '¿Cuántas piezas?', maxlength: 9, value: cantidad, placeholder: 'Ej. 300', autocomplete: 'off' });
    const frasePie = h('span', { class: 'tm-cant-frase', text: frase });
    entradaCant.addEventListener('input', () => { cantidad = entradaCant.value.trim(); const pos = entradaCant.selectionStart; pintarDetalle(); const nueva = refs.detalle.querySelector('.tm-cant-ref'); if (nueva) { nueva.focus(); nueva.setSelectionRange(pos, pos); } });
    const buscadorCant = h('div', { class: 'tm-cant-caja' }, h('strong', { text: '¿Cuántas piezas?' }), entradaCant, frasePie);
    const tabla = h('div', { class: 'tm-tabla-caja' }, h('table', { class: 'tm-tabla' },
      h('thead', null, h('tr', null, h('th', { text: 'Cantidad' }), prod.etapas.map(e => h('th', { class: 'tm-num', text: e.nombre })), h('th', { class: 'tm-num', text: 'Cliente' }))),
      h('tbody', null, fijos.map(r => h('tr', { class: tuyo(r) ? 'tm-fila-tuya' : null }, h('td', { text: textoRango(r) }), prod.etapas.map(e => h('td', { class: 'tm-num', text: String(r.dias[e.clave]) })), h('td', { class: 'tm-num tm-cliente', text: String(r.cliente) }))),
        abierto ? h('tr', { class: 'tm-fila-convenir' }, h('td', { text: `${abierto.desde}+` }), h('td', { colspan: String(prod.etapas.length + 1), text: 'Tiempo a convenir' })) : null)));
    const tarjetas = h('div', { class: 'tm-ref-tarjetas' }, prod.rangos.map(r => h('div', { class: `tm-ref-tarjeta${r.aConvenir ? ' tm-ref-tarjeta--convenir' : ''}${tuyo(r) ? ' tm-ref-tarjeta--tuya' : ''}` },
      h('div', { class: 'tm-ref-tarjeta-cab' }, h('strong', { text: `${r.aConvenir ? `${r.desde}+ piezas` : `${textoRango(r)} piezas`}${tuyo(r) ? ' · es tu cantidad' : ''}` }), r.aConvenir ? null : h('span', { class: 'tm-ref-cliente', text: `Cliente ${pluralDias(r.cliente)}` })),
      h('p', { class: 'tm-tenue', text: r.aConvenir ? 'Tiempo a convenir' : prod.etapas.map(e => `${e.nombre} ${r.dias[e.clave]}`).join(' · ') }))));
    const lin = catalogo.lineas.find(l => l.clave === prod.linea);
    const botonCalcular = () => h('a', { class: 'btn btn--primary', href: hashCalcular() }, icono('calculator-outline'), 'Calcular este producto');
    montar(refs.barra, botonCalcular());
    montar(refs.detalle,
      h('div', { class: 'tm-migas' }, h('span', { text: lin ? lin.nombre : '' }), prod.grupo ? [icono('chevron-forward-outline'), h('span', { text: prod.grupo })] : null),
      h('div', { class: 'tm-ref-titulo' }, h('h2', { text: prod.nombre }), prod.minimo ? h('span', { class: 'tm-etiqueta-gris', text: `Desde ${prod.minimo} piezas` }) : null, h('span', { class: 'tm-ref-calcular' }, botonCalcular())),
      buscadorCant,
      tabla, tarjetas,
      h('p', { class: 'tm-tenue', text: 'Los números son días hábiles. «Cliente» es la suma de las etapas más 1 día de margen: es lo que se promete al cliente.' }),
      h('div', { class: 'tm-nota' }, h('strong', { text: 'Antes de prometer, revisa' }), h('ul', null, [...avisosDe(prod), ...catalogo.avisosGenerales].map(a => h('li', { text: a })))),
      h('p', { class: 'tm-tenue', text: `Tabla de tiempos v${catalogo.version.numero} · ${catalogo.version.fecha.split('-').reverse().join('/')}` }));
  }

  pintarMovil(); pintarDetalle();
  montar(cont,
    h('div', { class: 'tm-titulo' }, h('div', null, h('h1', { text: 'Tabla de referencia' }), h('p', { text: 'Consulta los tiempos de todos los productos, sin calcular nada.' }))),
    h('div', { class: 'tm-referencia' }, refs.lista, refs.movil, refs.detalle), refs.barra);
  return {};
}
