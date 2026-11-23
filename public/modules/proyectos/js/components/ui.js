// Piezas pequeñas que repiten todas las pantallas del módulo.
import { h, icono } from '../utils/dom.js';
import { pluralizar } from '../utils/formato.js';
import { comoFunciona } from './ayuda.js';
import { confirmarModal } from './modal.js';
import { state } from '../state.js';

export const avisar = (tipo, titulo, mensaje) => window.toast && window.toast[tipo](titulo, mensaje);

// `ayuda`: clave de la explicación de la pantalla (js/ayuda/textos.js); agrega el botón «¿Cómo funciona?» bajo el título.
export const esAdministrador = () => state.user.permissions.includes('proyectos.administrar');

// La configuración es una sola para todas las tiendas y países: quien no es administrador lo ve antes de guardar.
export async function confirmarCambioGlobal() {
  if (esAdministrador()) return true;
  return confirmarModal({
    title: 'Este cambio afecta a todas las tiendas',
    mensaje: 'La configuración de Proyectos es una sola para todas las tiendas y países, no solo para las tuyas. Todo queda en el Historial, con tu nombre y el valor anterior. ¿Quieres guardar el cambio?',
    aceptar: 'Guardar el cambio'
  });
}

export const avisoCambioGlobal = () => (esAdministrador() ? null : h('div', { class: 'aviso', role: 'note' }, icono('globe-outline'),
  h('div', null, h('div', { class: 'aviso-titulo', text: 'Lo que cambies aquí vale para todas las tiendas' }), h('div', { class: 'aviso-texto', text: 'Es la configuración general del módulo. Queda en el Historial con tu nombre.' }))));

// `ayuda`: clave de la explicación; `global`: avisa a quien no es administrador que el cambio alcanza a todas las tiendas.
export function cabecera({ titulo, subtitulo, acciones, ayuda, global = false }) {
  const fila = h('div', { class: 'pagina-cabecera' },
    h('div', null,
      h('h1', { class: 'pagina-titulo', text: titulo }),
      subtitulo ? h('p', { class: 'pagina-subtitulo', text: subtitulo }) : null),
    acciones || null);
  const explicacion = ayuda ? comoFunciona(ayuda) : null;
  const aviso2 = global ? avisoCambioGlobal() : null;
  return explicacion || aviso2 ? h('div', { class: 'pagina-cabecera-grupo' }, fila, aviso2 ? h('div', { class: 'aviso-global' }, aviso2) : null, explicacion) : fila;
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
export function barraGuardado({ alDescartar, alGuardar, global = false }) {
  const punto = h('span', { class: 'punto-pendiente' });
  const texto = h('span');
  const descartar = h('button', { class: 'btn btn--ghost', type: 'button', onclick: alDescartar }, 'Descartar');
  const alPulsar = global ? async (e) => { if (await confirmarCambioGlobal()) alGuardar(e); } : alGuardar;
  const guardar = h('button', { class: 'btn btn--primary', type: 'button', onclick: alPulsar }, icono('checkmark-outline'), 'Guardar cambios');
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
