// Textos y piezas visuales de una empresa que comparten la lista, la ficha y el formulario.
import { h } from './dom.js';

// Los estados se escriben completos, nunca abreviados.
export const ETIQUETA_ESTADO = { activa: 'Activa', inactiva: 'Inactiva', no_contactar: 'No contactar' };
export const ESTADOS_FILTRO = [['activa', 'Activas'], ['no_contactar', 'No contactar'], ['inactiva', 'Inactivas'], ['todas', 'Todas']];

export const chipEstado = (estado) => h('span', { class: `chip-estado chip-estado--${estado}`, text: ETIQUETA_ESTADO[estado] || estado });
export const chipEnProyecto = () => h('span', { class: 'chip-estado chip-estado--en_proyecto', text: 'En proyecto' });

// «+502 7765 4400» → enlace para marcar; sin teléfono, un guion.
export const telefonoVisible = (texto) => texto || '—';
