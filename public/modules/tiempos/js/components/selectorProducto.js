// public/modules/tiempos/js/components/selectorProducto.js
// El campo «Producto»: abre la lista por categorías (hoja desde abajo en el celular) con buscador, líneas y usados hace poco.
import { h, icono } from '../utils/dom.js';
import { crearFlotante } from './flotante.js';
import { nuevoId } from './ui.js';
import { listaProductos, metaClientes, leerRecientes, guardarReciente } from './listaProductos.js';

// `alElegir(clave)`. El botón muestra el producto con su línea como etiqueta.
export function selectorProducto({ catalogo, valor, alElegir, id = nuevoId('producto') }) {
  const actual = catalogo.productos.find(p => p.clave === valor);
  const lineaActual = actual ? (catalogo.lineas.find(l => l.clave === actual.linea) || {}).nombre : '';
  const boton = h('button', { class: `tm-selector${actual ? '' : ' tm-selector--vacio'}`, type: 'button', id },
    h('span', { class: 'tm-selector-texto', text: actual ? actual.nombre : 'Elige un producto' }), lineaActual ? h('span', { class: 'tm-etiqueta-gris', text: lineaActual }) : null, icono('chevron-down-outline'));

  return crearFlotante({
    boton, titulo: 'Elegir producto', subtitulo: `${catalogo.productos.length} productos en ${catalogo.lineas.length} líneas`, clase: 'tm-flotante--lista',
    construir: (cerrar) => {
      const lista = listaProductos({
        datos: { lineas: catalogo.lineas, productos: catalogo.productos, valor }, metaDe: metaClientes, recientes: leerRecientes, rol: 'listbox',
        alElegir: (clave) => { guardarReciente(clave); alElegir(clave); cerrar(); }
      });
      return h('div', { class: 'tm-flotante-cuerpo' }, lista.nodo);
    }
  });
}
