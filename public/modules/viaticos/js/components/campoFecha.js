// Campo de fecha para formularios: mismo markup que espera `wireCampoFecha` (datepicker.js) pero con la etiqueta asociada al botón.
import { h, icono } from '../utils/dom.js';
import { t } from '../textos.js';

export function crearCampoFecha({ id, name, etiqueta }) {
  const valor = h('span', { class: 'date-field-value is-placeholder', text: t('periodo.seleccionarFecha') });
  const boton = h('button', { type: 'button', class: 'date-field-trigger', id, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, valor, icono('calendar-outline'));
  return h('div', { class: 'form-field' },
    h('label', { for: id, text: etiqueta }),
    h('div', { class: 'date-field', 'data-date-field': name }, boton, h('input', { type: 'hidden', name })));
}
