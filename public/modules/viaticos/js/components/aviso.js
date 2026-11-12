// Aviso en caja (amarillo, rojo o azul) para advertencias, bloqueos y notas; el rol anuncia el cambio a los lectores de pantalla.
import { h, icono } from '../utils/dom.js';

const ICONOS = { warning: 'warning-outline', error: 'alert-circle-outline', info: 'information-circle-outline' };

export function crearAviso({ tipo = 'info', titulo, texto }) {
  return h('div', { class: `vi-aviso vi-aviso--${tipo}`, role: tipo === 'error' ? 'alert' : 'status' },
    icono(ICONOS[tipo] || ICONOS.info),
    h('div', { class: 'vi-aviso__cuerpo' },
      titulo && h('p', { class: 'vi-aviso__titulo', text: titulo }),
      texto && h('p', { class: 'vi-aviso__texto', text: texto })));
}
