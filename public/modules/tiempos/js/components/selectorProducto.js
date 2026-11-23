// public/modules/tiempos/js/components/selectorProducto.js
// El campo «Producto»: abre una lista con buscador, agrupada por línea y grupo (hoja desde abajo en el celular).
import { h, icono } from '../utils/dom.js';
import { crearFlotante } from './flotante.js';
import { nuevoId } from './ui.js';

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// `linea`: clave de la línea elegida (filtra la lista) o ''. `alElegir(clave)`.
export function selectorProducto({ catalogo, linea, valor, alElegir, id = nuevoId('producto') }) {
  const actual = catalogo.productos.find(p => p.clave === valor);
  const boton = h('button', { class: `tm-selector${actual ? '' : ' tm-selector--vacio'}`, type: 'button', id },
    h('span', { class: 'tm-selector-texto', text: actual ? actual.nombre : 'Elige un producto' }), icono('chevron-down-outline'));
  const lineas = catalogo.lineas.filter(l => !linea || l.clave === linea);

  return crearFlotante({
    boton, titulo: 'Elegir producto', subtitulo: linea ? `Línea ${(catalogo.lineas.find(l => l.clave === linea) || {}).nombre || ''}` : 'Todas las líneas', clase: 'tm-flotante--lista',
    construir: (cerrar) => {
      const lista = h('div', { class: 'tm-lista-productos', role: 'listbox' });
      const buscador = h('input', { type: 'search', class: 'tm-buscador', placeholder: 'Buscar producto…', 'aria-label': 'Buscar producto', autocomplete: 'off' });
      const pintar = () => {
        const q = sinAcentos(buscador.value.trim());
        const nodos = [];
        for (const l of lineas) {
          const delaLinea = catalogo.productos.filter(p => p.linea === l.clave && (!q || sinAcentos(`${p.nombre} ${p.grupo || ''}`).includes(q)));
          if (!delaLinea.length) continue;
          let grupoActual = Symbol('x');
          nodos.push(h('div', { class: 'tm-lista-linea', text: l.nombre.toUpperCase() }));
          for (const p of delaLinea) {
            if (p.grupo !== grupoActual) { grupoActual = p.grupo; if (p.grupo) nodos.push(h('div', { class: 'tm-lista-grupo', text: p.grupo })); }
            nodos.push(h('button', { class: `tm-opcion${p.clave === valor ? ' tm-opcion--activa' : ''}`, type: 'button', role: 'option', 'aria-selected': String(p.clave === valor), onclick: () => { alElegir(p.clave); cerrar(); }, text: p.nombre }));
          }
        }
        lista.replaceChildren(...(nodos.length ? nodos : [h('p', { class: 'tm-tenue tm-lista-vacia', text: `No encontramos «${buscador.value.trim()}». Revisa cómo está escrito o prueba con otra palabra.` })]));
      };
      buscador.addEventListener('input', pintar);
      pintar();
      return h('div', { class: 'tm-flotante-cuerpo' }, buscador, lista);
    }
  });
}
