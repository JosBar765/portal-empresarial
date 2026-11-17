// Fila de filtros rápidos (uno activo a la vez), como botones con `aria-pressed` para teclado y lectores de pantalla.
import { h } from '../utils/dom.js';

// `opciones`: [{ valor, texto }]. Devuelve { nodo, marcar(valor) }; `alCambiar(valor)` se llama solo cuando cambia la opción activa.
export function crearFiltrosRapidos({ etiquetaAria, opciones, activo, idBase, alCambiar }) {
  let actual = activo;
  const botones = opciones.map(opcion => h('button', {
    type: 'button', class: 'vi-filtro-rapido', id: `${idBase}-${opcion.valor}`, 'data-filtro': opcion.valor, text: opcion.texto,
    onclick: () => { if (actual !== opcion.valor) { marcar(opcion.valor); alCambiar(opcion.valor); } }
  }));
  const nodo = h('div', { class: 'vi-filtros-rapidos', role: 'group', 'aria-label': etiquetaAria }, botones);

  function marcar(valor) {
    actual = valor;
    botones.forEach(boton => {
      const esActivo = boton.dataset.filtro === valor;
      boton.classList.toggle('is-activo', esActivo);
      boton.setAttribute('aria-pressed', esActivo ? 'true' : 'false');
    });
  }

  marcar(activo);
  return { nodo, marcar };
}
