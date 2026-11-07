// Piezas pequeñas que repiten todas las pantallas del módulo.
import { h, icono } from '../utils/dom.js';
import { pluralizar } from '../utils/formato.js';

export const avisar = (tipo, titulo, mensaje) => window.toast && window.toast[tipo](titulo, mensaje);

export function cabecera({ titulo, subtitulo, acciones }) {
  return h('div', { class: 'pagina-cabecera' },
    h('div', null,
      h('h1', { class: 'pagina-titulo', text: titulo }),
      subtitulo ? h('p', { class: 'pagina-subtitulo', text: subtitulo }) : null),
    acciones || null);
}

const ICONOS_AVISO = { info: 'information-circle-outline', advertencia: 'warning-outline', error: 'alert-circle-outline' };

export function aviso({ tipo = 'info', titulo, texto }) {
  return h('div', { class: `aviso${tipo === 'info' ? '' : ` aviso--${tipo}`}`, role: tipo === 'info' ? 'note' : 'alert' },
    icono(ICONOS_AVISO[tipo]),
    h('div', null,
      h('div', { class: 'aviso-titulo', text: titulo }),
      texto ? h('div', { class: 'aviso-texto', text: texto }) : null));
}

export function interruptor({ marcado, alCambiar, deshabilitado = false, etiqueta }) {
  const entrada = h('input', { type: 'checkbox', role: 'switch', 'aria-label': etiqueta });
  entrada.checked = Boolean(marcado);
  entrada.disabled = deshabilitado;
  if (alCambiar) entrada.addEventListener('change', () => alCambiar(entrada.checked));
  return h('label', { class: 'interruptor' }, entrada, h('span', { class: 'interruptor-pista' }));
}

export function cargando(texto = 'Cargando…') {
  const nodo = h('div', { class: 'estado-vacio' }, icono('sync-outline'), h('p', { text: texto }));
  nodo.querySelector('ion-icon').classList.add('spin-animation');
  return nodo;
}

export function estadoError(error) {
  return h('div', { class: 'estado-vacio estado-vacio--error' },
    icono('alert-circle-outline'),
    h('h3', { text: 'No se pudo cargar' }),
    h('p', { text: error.message }));
}

export function estadoVacio(titulo, texto, nombreIcono = 'file-tray-outline') {
  return h('div', { class: 'estado-vacio' }, icono(nombreIcono), h('h3', { text: titulo }), texto ? h('p', { text: texto }) : null);
}

// Barra de «N cambios sin guardar» con Descartar y Guardar; `actualizar(n)` cambia el texto y habilita los botones.
export function barraGuardado({ alDescartar, alGuardar }) {
  const punto = h('span', { class: 'punto-pendiente' });
  const texto = h('span');
  const descartar = h('button', { class: 'btn btn--ghost', type: 'button', onclick: alDescartar }, 'Descartar');
  const guardar = h('button', { class: 'btn btn--primary', type: 'button', onclick: alGuardar }, icono('checkmark-outline'), 'Guardar cambios');
  const nodo = h('div', { class: 'barra-guardado' },
    h('span', { class: 'barra-estado' }, punto, texto),
    h('div', { class: 'acciones' }, descartar, guardar));
  return {
    nodo,
    actualizar(cambios) {
      texto.textContent = cambios ? pluralizar(cambios, 'cambio sin guardar', 'cambios sin guardar') : 'Sin cambios pendientes';
      punto.style.display = cambios ? '' : 'none';
      descartar.disabled = !cambios;
      guardar.disabled = !cambios;
    },
    ocupado(valor) {
      guardar.classList.toggle('btn--loading', valor);
      if (valor) { guardar.disabled = true; descartar.disabled = true; }
    }
  };
}
