// public/modules/tiempos/js/components/listaProductos.js
// La lista de productos por categorías, compartida por el selector de la calculadora, la Tabla de referencia y la Administración:
// buscador, pestañas por línea con contador, «usados hace poco», categorías plegables con contador y los días de cada producto.
import { h, icono } from '../utils/dom.js';

export const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const LIMITE_GRUPO = 5; // un grupo largo muestra los primeros y un enlace «Ver los N restantes»

// `datos`: { lineas, productos, valor }. `metaDe(p)`: texto corto a la derecha (p. ej. «11–16 d»).
// `coincide(p, q)`: búsqueda propia (q ya sin acentos). `filtros`: [{ clave, nombre, prueba(p) }] (chips bajo las pestañas).
// `recientes`: claves a mostrar arriba. `alElegir(clave)`. Devuelve { nodo, actualizar(datos), enfocar() }.
export function listaProductos({ datos, metaDe = () => '', coincide, filtros = [], recientes = () => [], alElegir, placeholder = 'Buscar producto…', rol = null }) {
  let d = datos;
  let q = '';
  let linea = '';
  let filtro = filtros.length ? filtros[0].clave : '';
  const abiertos = new Set();
  const completos = new Set();
  const lineaDe = (clave) => ((d.productos.find(p => p.clave === clave) || {}).linea) || '';
  const claveGrupo = (p) => `${p.linea}|${p.grupo || ''}`;

  const buscador = h('input', { type: 'search', class: 'tm-buscador', placeholder, 'aria-label': 'Buscar producto', autocomplete: 'off' });
  const tabs = h('div', { class: 'tm-tabs-linea', role: 'tablist', 'aria-label': 'Línea' });
  const chipsFiltro = h('div', { class: 'tm-filtros-lista' });
  const bloqueRecientes = h('div', { class: 'tm-recientes' });
  const cuerpo = h('div', { class: 'tm-lista-productos', role: rol });
  const nodo = h('div', { class: 'tm-lista-cat' }, buscador, tabs, chipsFiltro, bloqueRecientes, cuerpo);

  const pruebaFiltro = () => (filtros.find(f => f.clave === filtro) || {}).prueba || (() => true);
  const pasaBusqueda = (p) => !q || (coincide ? coincide(p, q) : sinAcentos(`${p.nombre} ${p.grupo || ''}`).includes(q));
  const visibles = () => d.productos.filter(p => pasaBusqueda(p) && pruebaFiltro()(p));
  const mostrarSeleccion = () => {
    const sel = d.productos.find(p => p.clave === d.valor);
    if (!sel) { if (!linea || !d.lineas.some(l => l.clave === linea)) linea = (d.lineas[0] || {}).clave || ''; return; }
    linea = sel.linea; abiertos.add(claveGrupo(sel));
  };

  function pintar() {
    const todos = visibles();
    const cuenta = (l) => todos.filter(p => p.linea === l).length;
    // Con una búsqueda, si la pestaña activa no tiene resultados se pasa a la primera que sí.
    if (!d.lineas.some(l => l.clave === linea)) linea = (d.lineas[0] || {}).clave || '';
    if (q && cuenta(linea) === 0) { const otra = d.lineas.find(l => cuenta(l.clave) > 0); if (otra) linea = otra.clave; }

    tabs.replaceChildren(...d.lineas.map(l => h('button', { class: `tm-tab-linea${l.clave === linea ? ' tm-tab-linea--activa' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(l.clave === linea), onclick: () => { linea = l.clave; pintar(); } },
      h('span', { text: l.nombre }), h('em', { text: String(cuenta(l.clave)) }))));

    chipsFiltro.hidden = !filtros.length;
    chipsFiltro.replaceChildren(...filtros.map(f => {
      const n = d.productos.filter(p => pasaBusqueda(p) && f.prueba(p)).length;
      return h('button', { class: `tm-pill tm-pill--chica${f.clave === filtro ? ' tm-pill--activa' : ''}`, type: 'button', 'aria-pressed': String(f.clave === filtro), onclick: () => { filtro = f.clave; pintar(); }, text: `${f.nombre} · ${n}` });
    }));

    const rec = q ? [] : recientes().map(c => d.productos.find(p => p.clave === c)).filter(Boolean).slice(0, 4);
    bloqueRecientes.hidden = !rec.length;
    bloqueRecientes.replaceChildren(...(rec.length ? [h('div', { class: 'tm-lista-linea', text: 'USADOS HACE POCO' }), h('div', { class: 'tm-pills' }, rec.map(p => h('button', { class: 'tm-pill tm-pill--chica', type: 'button', onclick: () => alElegir(p.clave), text: p.nombre })))] : []));

    const nodos = [];
    const delaLinea = todos.filter(p => p.linea === linea);
    const grupos = [];
    for (const p of delaLinea) { let g = grupos.find(x => x.nombre === (p.grupo || '')); if (!g) { g = { nombre: p.grupo || '', items: [] }; grupos.push(g); } g.items.push(p); }
    const fila = (p) => h('button', { class: `tm-opcion${p.clave === d.valor ? ' tm-opcion--activa' : ''}`, type: 'button', role: rol ? 'option' : null, 'aria-selected': rol ? String(p.clave === d.valor) : null, 'aria-current': !rol && p.clave === d.valor ? 'true' : null, onclick: () => alElegir(p.clave) },
      h('span', { class: 'tm-opcion-nombre', text: p.nombre }), p.activo === false ? h('span', { class: 'tm-etiqueta-gris', text: 'Oculto' }) : h('span', { class: 'tm-opcion-meta', text: metaDe(p) }));
    for (const g of grupos) {
      if (!g.nombre) { g.items.forEach(p => nodos.push(fila(p))); continue; }
      const k = `${linea}|${g.nombre}`;
      const abierto = Boolean(q) || abiertos.has(k);
      nodos.push(h('button', { class: 'tm-grupo-cab', type: 'button', 'aria-expanded': String(abierto), onclick: () => { if (abiertos.has(k)) abiertos.delete(k); else abiertos.add(k); pintar(); } },
        icono(abierto ? 'chevron-down-outline' : 'chevron-forward-outline'), h('span', { class: 'tm-grupo-nombre', text: g.nombre }), h('em', { text: String(g.items.length) })));
      if (!abierto) continue;
      const indiceSel = g.items.findIndex(p => p.clave === d.valor);
      const todo = Boolean(q) || completos.has(k) || g.items.length <= LIMITE_GRUPO + 1 || indiceSel >= LIMITE_GRUPO;
      (todo ? g.items : g.items.slice(0, LIMITE_GRUPO)).forEach(p => nodos.push(fila(p)));
      if (!todo) nodos.push(h('button', { class: 'tm-ver-mas', type: 'button', onclick: () => { completos.add(k); pintar(); }, text: `Ver los ${g.items.length - LIMITE_GRUPO} productos restantes…` }));
    }
    if (!todos.length) nodos.push(h('div', { class: 'tm-vacio-lista' }, h('strong', { text: q ? `No encontramos «${buscador.value.trim()}»` : 'No hay productos con este filtro' }), h('p', { class: 'tm-tenue', text: q ? 'Revisa cómo está escrito o prueba con otra palabra.' : 'Prueba con otro filtro.' }),
      q ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { buscador.value = ''; q = ''; pintar(); } }, 'Borrar búsqueda') : null));
    else if (!delaLinea.length) nodos.push(h('p', { class: 'tm-tenue tm-lista-vacia', text: 'Esta línea no tiene productos con este filtro.' }));
    cuerpo.replaceChildren(...nodos);
  }

  buscador.addEventListener('input', () => { q = sinAcentos(buscador.value.trim()); pintar(); });
  mostrarSeleccion(); pintar();
  return {
    nodo,
    actualizar(nuevo) { const cambioValor = nuevo.valor !== d.valor; d = nuevo; if (cambioValor) mostrarSeleccion(); pintar(); },
    enfocar() { buscador.focus({ preventScroll: true }); }
  };
}

// Productos recientes de este navegador (solo una comodidad: si no hay almacenamiento, no pasa nada).
const CLAVE_RECIENTES = 'tiempos.recientes';
export function leerRecientes() { try { const v = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch (e) { return []; } }
export function guardarReciente(clave) { try { localStorage.setItem(CLAVE_RECIENTES, JSON.stringify([clave, ...leerRecientes().filter(c => c !== clave)].slice(0, 6))); } catch (e) { /* sin almacenamiento */ } }

// «11–16 d» con los días al cliente de un producto de la tabla de usuario (rangos con `cliente`).
export function metaClientes(p) {
  const v = (p.rangos || []).filter(r => !r.aConvenir && Number.isFinite(r.cliente)).map(r => r.cliente);
  if (!v.length) return '';
  const a = Math.min(...v); const b = Math.max(...v);
  return a === b ? `${a} d` : `${a}–${b} d`;
}
