// public/modules/incidencias/js/views/estados.js
// Pantallas de mensaje: sin acceso, país no disponible, error y vacío.
import { h, icono, montar } from '../utils/dom.js';

export function pantallaMensaje({ icono: nombreIcono = 'information-circle-outline', titulo, texto, acciones = [], tono = '' }) {
  return h('section', { class: 'inc-card inc-mensaje' },
    h('div', { class: `inc-mensaje-icono ${tono ? `inc-mensaje-icono--${tono}` : ''}`.trim() }, icono(nombreIcono)),
    h('h2', { class: 'inc-mensaje-titulo', text: titulo }),
    texto ? h('p', { class: 'inc-mensaje-texto', text: texto }) : null,
    acciones.length ? h('div', { class: 'inc-mensaje-acciones' }, acciones) : null);
}

export const botonEnlace = (texto, href, primario = true, nombreIcono = null) =>
  h('a', { class: `btn ${primario ? 'btn--primary' : 'btn--ghost'}`, href }, nombreIcono ? icono(nombreIcono) : null, texto);

export const botonAccion = (texto, alHacerClic, primario = true) =>
  h('button', { class: `btn ${primario ? 'btn--primary' : 'btn--ghost'}`, type: 'button', onclick: alHacerClic }, texto);

export function mostrarSinAcceso(cont, mensaje) {
  montar(cont, pantallaMensaje({
    icono: 'shield-outline', tono: 'peligro', titulo: 'No encontramos esa incidencia',
    texto: mensaje || 'Puede que no exista o que no sea tuya ni de tus tiendas. Por seguridad no damos más detalles.',
    acciones: [botonEnlace('Volver a mis incidencias', '#/mis', true, 'arrow-back-outline')]
  }));
}

export function mostrarNoDisponible(cont, aviso) {
  montar(cont, pantallaMensaje({
    icono: 'earth-outline', tono: 'peligro', titulo: 'Todavía no está disponible en tu país',
    texto: aviso && !/^Todavía no está disponible/.test(aviso) ? aviso : 'Estamos preparando el servicio para tu país. Mientras tanto, avisa del problema a tu supervisor.',
    acciones: [botonEnlace('Volver al portal', '/dashboard/', true, 'home-outline')]
  }));
}

// Un error de carga con «Reintentar»; un 404 se explica como «no encontramos esa incidencia».
export function mostrarError(cont, error, reintentar) {
  if (error && error.status === 404) { mostrarSinAcceso(cont, error.message); return; }
  montar(cont, pantallaMensaje({
    icono: error && error.sinConexion ? 'cloud-offline-outline' : 'alert-circle-outline', tono: 'peligro',
    titulo: error && error.sinConexion ? 'Sin conexión' : 'No se pudo cargar',
    texto: (error && error.message) || 'Inténtalo de nuevo en unos minutos.',
    acciones: reintentar ? [botonAccion('Reintentar', reintentar)] : []
  }));
}

export const cargando = (texto = 'Cargando…') => h('div', { class: 'inc-cargando', role: 'status' }, icono('sync-outline', 'spin-animation'), h('p', { text: texto }));

export const vacio = ({ icono: nombreIcono = 'file-tray-outline', titulo, texto, acciones = [] }) =>
  h('div', { class: 'inc-vacio' }, icono(nombreIcono), h('h3', { text: titulo }), texto ? h('p', { text: texto }) : null, acciones.length ? h('div', { class: 'inc-mensaje-acciones' }, acciones) : null);
