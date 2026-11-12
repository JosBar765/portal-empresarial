// Contenedores de campo del formulario: etiqueta asociada al control y campo calculado de solo lectura.
import { h } from '../utils/dom.js';
import { t } from '../textos.js';

// `soloMovil`: la etiqueta se oculta en escritorio (la dice el encabezado de la columna) y se ve en el celular; sigue disponible para lectores de pantalla.
export function crearCampo({ etiqueta, control, idControl, clase = '', soloMovil = false }) {
  return h('div', { class: `form-field ${clase}`.trim() },
    h('label', { for: idControl, class: soloMovil ? 'vi-solo-movil' : null, text: etiqueta }),
    control);
}

// Valor que viene del servidor: nunca se edita ni lo calcula el cliente. `id` es el del <output> que se actualiza con `ponerCalculado`.
export function crearCampoCalculado({ etiqueta, id, clase = '' }) {
  return h('div', { class: `form-field ${clase}`.trim() },
    h('label', { for: id, id: `${id}-etiqueta`, text: etiqueta }),
    h('div', { class: 'vi-calculado' },
      h('output', { id, class: 'vi-calculado__valor', text: '—' }),
      h('span', { class: 'vi-calculado__marca', text: t('formulario.calculado') })));
}

export function ponerCalculado(nodo, texto) {
  if (nodo) nodo.textContent = texto === null || texto === undefined || texto === '' ? '—' : texto;
}

// Sección del formulario: título, ayuda opcional y contenido; el título nombra la región para lectores de pantalla.
export function crearSeccionForm({ id, titulo, ayuda }, ...hijos) {
  return h('section', { class: 'vi-form-seccion', id, 'aria-labelledby': `${id}-titulo` },
    h('h4', { class: 'vi-form-seccion__titulo', id: `${id}-titulo`, text: titulo }),
    ayuda && h('p', { class: 'vi-ayuda', text: ayuda }),
    hijos);
}
