// Campos de formulario que repiten las pantallas de empresas: etiqueta + control + error o ayuda.
// Cada constructor recibe `valores` (el borrador, que se modifica al escribir) y `errores` (por clave).
import { h } from '../utils/dom.js';

function envoltura(id, etiqueta, control, { error, ayuda, obligatorio }) {
  return h('div', { class: `campo${error ? ' campo--error' : ''}` },
    h('label', { for: id, text: obligatorio ? `${etiqueta} *` : etiqueta }), control,
    error ? h('span', { class: 'campo-error', text: error }) : (ayuda ? h('span', { class: 'campo-ayuda', text: ayuda }) : null));
}

export function campoTexto({ clave, etiqueta, valores, errores, alCambiar, maximo = 150, tipo = 'text', ayuda, obligatorio, placeholder, prefijoId = 'f' }) {
  const id = `${prefijoId}-${clave.replace(/\./g, '-')}`;
  const control = h('input', { id, type: tipo, maxlength: maximo, autocomplete: 'off', placeholder: placeholder || null });
  control.value = valores[clave] || '';
  control.addEventListener('input', () => {
    valores[clave] = control.value;
    if (errores[clave]) { delete errores[clave]; control.closest('.campo').classList.remove('campo--error'); control.closest('.campo').querySelector('.campo-error')?.remove(); }
    if (alCambiar) alCambiar();
  });
  return envoltura(id, etiqueta, control, { error: errores[clave], ayuda, obligatorio });
}

// `opciones`: [{ id, nombre }]. Si hay una sola y es obligatoria, queda elegida.
export function campoLista({ clave, etiqueta, valores, errores, opciones, alCambiar, vacio = 'Elige…', obligatorio, prefijoId = 'f' }) {
  const id = `${prefijoId}-${clave.replace(/\./g, '-')}`;
  const control = h('select', { id }, h('option', { value: '', text: vacio }), opciones.map(o => h('option', { value: String(o.id), text: o.nombre })));
  if (!valores[clave] && opciones.length === 1 && obligatorio) valores[clave] = opciones[0].id;
  control.value = valores[clave] ? String(valores[clave]) : '';
  control.addEventListener('change', () => {
    valores[clave] = control.value ? Number(control.value) : '';
    delete errores[clave];
    if (alCambiar) alCambiar();
  });
  return envoltura(id, etiqueta, control, { error: errores[clave], obligatorio });
}

export function campoArea({ clave, etiqueta, valores, errores, maximo = 500, ayuda, prefijoId = 'f' }) {
  const id = `${prefijoId}-${clave}`;
  const control = h('textarea', { id, rows: 3, maxlength: maximo });
  control.value = valores[clave] || '';
  control.addEventListener('input', () => { valores[clave] = control.value; delete errores[clave]; });
  return envoltura(id, etiqueta, control, { error: errores[clave], ayuda });
}
