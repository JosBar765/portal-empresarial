// public/modules/incidencias/js/components/campos.js
// Campos de formulario compartidos por las acciones de una incidencia y la Configuración. Cada campo lleva `data-campo` para que
// la hoja marque el que el servidor rechazó, y devuelve `valor()` para leerlo.
import { h, icono } from '../utils/dom.js';

export const errorDeCampos = (campos) => Object.assign(new Error('Revisa los datos marcados.'), { campos });

export function campoTexto({ etiqueta, nombre, filas = 3, max, placeholder, ayuda, obligatorio = false, valor = '' }) {
  const area = h('textarea', { id: `acc-${nombre}`, name: nombre, rows: filas, maxlength: max, placeholder: placeholder || '' });
  area.value = valor;
  return {
    el: h('div', { class: 'inc-campo inc-campo--ancho', 'data-campo': nombre }, h('label', { for: `acc-${nombre}`, text: `${etiqueta}${obligatorio ? ' *' : ''}` }), area, ayuda ? h('p', { class: 'inc-tenue', text: ayuda }) : null),
    valor: () => area.value.trim()
  };
}

// Una sola línea (nombres, títulos cortos).
export function campoLinea({ etiqueta, nombre, max, placeholder, ayuda, obligatorio = false, valor = '', deshabilitado = false }) {
  const input = h('input', { id: `acc-${nombre}`, name: nombre, type: 'text', maxlength: max, placeholder: placeholder || '', autocomplete: 'off', disabled: deshabilitado });
  input.value = valor;
  return {
    el: h('div', { class: 'inc-campo inc-campo--ancho', 'data-campo': nombre }, h('label', { for: `acc-${nombre}`, text: `${etiqueta}${obligatorio ? ' *' : ''}` }), input, ayuda ? h('p', { class: 'inc-tenue', text: ayuda }) : null),
    valor: () => input.value.trim()
  };
}

export function campoNumero({ etiqueta, nombre, min, max, ayuda, obligatorio = false, valor = '' }) {
  const input = h('input', { id: `acc-${nombre}`, name: nombre, type: 'number', min, max, step: 1, inputmode: 'numeric' });
  input.value = valor === null || valor === undefined ? '' : String(valor);
  return {
    el: h('div', { class: 'inc-campo', 'data-campo': nombre }, h('label', { for: `acc-${nombre}`, text: `${etiqueta}${obligatorio ? ' *' : ''}` }), input, ayuda ? h('p', { class: 'inc-tenue', text: ayuda }) : null),
    valor: () => input.value.trim()
  };
}

export function campoSelect({ etiqueta, nombre, opciones, vacio = 'Elige una opción', obligatorio = true, valor = '' }) {
  const sel = h('select', { id: `acc-${nombre}`, name: nombre }, h('option', { value: '', text: vacio }), opciones.map(o => h('option', { value: String(o.valor), text: o.texto })));
  sel.value = valor === null || valor === undefined ? '' : String(valor);
  return { el: h('div', { class: 'inc-campo inc-campo--ancho', 'data-campo': nombre }, h('label', { for: `acc-${nombre}`, text: `${etiqueta}${obligatorio ? ' *' : ''}` }), sel), valor: () => sel.value };
}

// Un recuadro de aviso dentro de una hoja o una pantalla.
export const nota = (texto, tipo = 'info') => h('div', { class: `inc-aviso inc-aviso--${tipo}` }, icono(tipo === 'peligro' ? 'warning-outline' : 'information-circle-outline'), h('span', { text: texto }));

// Interruptor (encendido/apagado) accesible. `alCambiar(nuevo)` puede ser async y lanzar: entonces vuelve a como estaba.
export function interruptor({ activo, etiqueta, alCambiar }) {
  const boton = h('button', { class: `inc-interruptor${activo ? ' inc-interruptor--encendido' : ''}`, type: 'button', role: 'switch', 'aria-checked': String(Boolean(activo)), 'aria-label': etiqueta }, h('span', { class: 'inc-interruptor-perilla' }));
  let estado = Boolean(activo);
  boton.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (boton.disabled) return;
    const nuevo = !estado;
    boton.disabled = true;
    try {
      await alCambiar(nuevo);
      estado = nuevo;
      boton.classList.toggle('inc-interruptor--encendido', estado);
      boton.setAttribute('aria-checked', String(estado));
    } catch (error) { /* quien lo usa ya avisó del error; se queda como estaba */ } finally { boton.disabled = false; }
  });
  return boton;
}

// Una lista de casillas (varias a la vez). `seleccion`: Set de valores marcados; devuelve los marcados con `valores()`.
export function casillas({ etiqueta, nombre, opciones, seleccion = new Set(), ayuda }) {
  const marcados = new Set(seleccion);
  const lista = h('div', { class: 'inc-casillas', role: 'group', 'aria-label': etiqueta },
    opciones.map(o => {
      const caja = h('input', { type: 'checkbox', value: String(o.valor), checked: marcados.has(o.valor) });
      caja.addEventListener('change', () => { if (caja.checked) marcados.add(o.valor); else marcados.delete(o.valor); });
      return h('label', { class: 'inc-casilla' }, caja, h('span', { text: o.texto }));
    }));
  return {
    el: h('div', { class: 'inc-campo inc-campo--ancho', 'data-campo': nombre }, h('span', { class: 'inc-etiqueta', text: etiqueta }), ayuda ? h('p', { class: 'inc-tenue', text: ayuda }) : null, lista),
    valores: () => [...marcados]
  };
}
