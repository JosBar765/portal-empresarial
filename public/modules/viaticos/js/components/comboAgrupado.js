// <select> con opciones sueltas o agrupadas. `grupos`: [{ etiqueta?, opciones: [{ valor, texto, deshabilitada?, titulo? }] }].
import { h } from '../utils/dom.js';

export function llenarCombo(select, { placeholder, grupos = [], valor = '' }) {
  const opcion = (o) => h('option', { value: String(o.valor), disabled: !!o.deshabilitada, title: o.titulo, text: o.texto });
  const nodos = grupos.map(g => (g.etiqueta ? h('optgroup', { label: g.etiqueta }, g.opciones.map(opcion)) : g.opciones.map(opcion)));
  select.replaceChildren(...(placeholder ? [h('option', { value: '', text: placeholder })] : []), ...nodos.flat());
  select.value = valor === '' || valor === null || valor === undefined ? '' : String(valor);
  // Un valor que ya no existe deja el combo en blanco, no en la primera opción.
  if (select.value !== String(valor) && valor !== '') select.value = '';
  return select;
}

export function crearCombo({ id, name, etiquetaAria, placeholder, grupos, valor, deshabilitado = false, alCambiar }) {
  const select = h('select', { id, name, 'aria-label': etiquetaAria, disabled: deshabilitado });
  llenarCombo(select, { placeholder, grupos, valor });
  if (alCambiar) select.addEventListener('change', () => alCambiar(select.value));
  return select;
}

// Atajo para una lista plana de { id, ...}: `texto(item)` arma la etiqueta.
export const opcionesDe = (items, texto) => items.map(item => ({ valor: item.id, texto: texto(item) }));
