// Campo de texto para números: teclado numérico en el celular y solo deja escribir lo que forma un número («,» y «.» valen como decimal).
import { h } from '../utils/dom.js';
import { limpiarEntradaNumerica } from '../utils/numero.js';

export function crearCampoNumerico({ id, name, valor = '', placeholder = '', etiquetaAria, entero = false, alCambiar }) {
  const input = h('input', {
    type: 'text', inputmode: entero ? 'numeric' : 'decimal', autocomplete: 'off', id, name, placeholder, value: valor, 'aria-label': etiquetaAria
  });
  input.addEventListener('input', () => {
    const limpio = limpiarEntradaNumerica(input.value, { entero });
    if (limpio !== input.value) input.value = limpio;
    if (alCambiar) alCambiar(input.value);
  });
  return input;
}
