// Selección múltiple con chips: cada opción es un botón que se marca y desmarca (Tab para moverse, Espacio o Enter para cambiarla).
import { h, icono } from '../utils/dom.js';

// `opciones`: [{ id, nombre }]; `seleccion`: ids elegidos. `nombreCampo` permite que el servidor marque el grupo por `data-campo`.
export function crearChipsSeleccion({ id, nombreCampo, etiquetaId, opciones, seleccion = [], alCambiar }) {
  const elegidos = new Set(seleccion.map(Number));
  const botones = opciones.map(opcion => {
    const boton = h('button', { type: 'button', class: 'vi-chip', role: 'checkbox', 'data-id': String(opcion.id), onclick: () => alternar(Number(opcion.id)) },
      icono('checkmark-outline'), h('span', { text: opcion.nombre }));
    return boton;
  });
  const nodo = h('div', { class: 'vi-chips', id, role: 'group', 'aria-labelledby': etiquetaId, 'data-campo': nombreCampo }, botones);

  function pintar() {
    botones.forEach(boton => {
      const marcado = elegidos.has(Number(boton.dataset.id));
      boton.setAttribute('aria-checked', marcado ? 'true' : 'false');
      boton.classList.toggle('is-marcado', marcado);
    });
  }

  function alternar(idOpcion) {
    if (elegidos.has(idOpcion)) elegidos.delete(idOpcion); else elegidos.add(idOpcion);
    pintar();
    if (alCambiar) alCambiar(valores());
  }

  // En el orden de las opciones, no en el de los clics.
  const valores = () => opciones.map(o => Number(o.id)).filter(n => elegidos.has(n));
  pintar();
  return { nodo, valores };
}
