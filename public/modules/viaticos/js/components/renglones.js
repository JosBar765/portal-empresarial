// Piezas de las listas de renglones (tramos, hospedajes, otros gastos): botones de agregar y quitar y cajas de totales.
import { h, icono } from '../utils/dom.js';

export function crearBotonAgregar({ texto, alPulsar, deshabilitado = false, titulo }) {
  return h('button', { class: 'btn btn--ghost btn--sm vi-btn-agregar', type: 'button', disabled: deshabilitado, title: titulo, onclick: alPulsar }, `+ ${texto}`);
}

export function crearBotonQuitar({ etiqueta, alPulsar, deshabilitado = false, titulo }) {
  return h('button', {
    class: 'btn-icon icon-danger vi-renglon__quitar', type: 'button', disabled: deshabilitado, title: titulo || etiqueta, 'aria-label': etiqueta, onclick: alPulsar
  }, icono('trash-outline'));
}

// `filas`: [{ id, etiqueta, valor, fuerte? }]; el valor se cambia después con `ponerTotal(id, texto)`.
export function crearTotales(filas, { id } = {}) {
  return h('div', { class: 'vi-totales', id },
    filas.map(f => h('div', { class: 'vi-totales__fila' },
      h('span', { text: f.etiqueta }),
      h('strong', { id: f.id, class: f.fuerte ? 'vi-totales__fuerte' : null, text: f.valor }))));
}

export function ponerTotal(raiz, id, texto) {
  const nodo = raiz.querySelector(`#${id}`);
  if (nodo) nodo.textContent = texto;
}
