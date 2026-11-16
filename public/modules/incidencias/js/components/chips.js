// public/modules/incidencias/js/components/chips.js
import { h } from '../utils/dom.js';

// «P2 · Alta» con el color que el administrador eligió para esa prioridad.
export const chipPrioridad = (p) => h('span', { class: `inc-chip inc-chip--prio-${p.color || 'gris'}`, text: `${p.codigo} · ${p.nombre}` });

// El estado en palabras completas.
export const chipEstado = (estado, etiqueta) => h('span', { class: `inc-chip inc-chip--estado-${estado}` }, h('span', { class: 'inc-chip-punto', 'aria-hidden': 'true' }), etiqueta);

export const chipTexto = (texto, clase = '') => h('span', { class: `inc-chip ${clase}`.trim(), text: texto });

const EVOLUCION = {
  mejoro: { texto: 'Mejoró', clase: 'inc-chip--mejoro' },
  sin_cambios: { texto: 'Sin cambios', clase: 'inc-chip--sin-cambios' },
  empeoro: { texto: 'Empeoró', clase: 'inc-chip--empeoro' }
};
export const chipEvolucion = (evolucion) => (EVOLUCION[evolucion] ? chipTexto(EVOLUCION[evolucion].texto, EVOLUCION[evolucion].clase) : null);
export const etiquetaEvolucion = (evolucion) => (EVOLUCION[evolucion] || {}).texto || '';
