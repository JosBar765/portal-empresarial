// public/modules/tiempos/js/components/ui.js
// Piezas pequeñas compartidas por las pantallas: campo con etiqueta, interruptor, confirmación y pantallas de mensaje.
import { h, icono, montar } from '../utils/dom.js';

let contadorId = 0;
export const nuevoId = (prefijo = 'tm') => `${prefijo}-${++contadorId}`;

// Etiqueta + control + pie (ayuda o error). `pie` es un nodo que la pantalla puede actualizar.
export function campo(etiqueta, control, pie, clase = '', paraId = '') {
  const id = paraId || control.id || (control.id = nuevoId('campo'));
  return h('div', { class: `tm-campo ${clase}`.trim() }, h('label', { for: id, text: etiqueta }), control, pie || null);
}

export const pie = (texto = '') => h('p', { class: 'tm-pie', text: texto });

// Interruptor con título y una línea de ayuda. `alCambiar(valor)`.
export function interruptor({ marcado, etiqueta, ayuda, alCambiar }) {
  const id = nuevoId('sw');
  const caja = h('input', { type: 'checkbox', role: 'switch', id, class: 'tm-sw-input' });
  caja.checked = Boolean(marcado);
  caja.addEventListener('change', () => alCambiar(caja.checked));
  return h('label', { class: 'tm-sw', for: id },
    caja, h('span', { class: 'tm-sw-pista', 'aria-hidden': 'true' }, h('span', { class: 'tm-sw-bola' })),
    h('span', { class: 'tm-sw-texto' }, h('strong', { text: etiqueta }), ayuda ? h('small', { text: ayuda }) : null));
}

// Ventana de confirmación; devuelve una promesa con true (aceptó) o false (canceló o Escape).
export function confirmar({ titulo, texto, aceptar = 'Aceptar', cancelar = 'Cancelar', peligro = false }) {
  return new Promise((resolver) => {
    const previo = document.activeElement;
    const idTitulo = nuevoId('titulo');
    const cerrar = (valor) => { document.removeEventListener('keydown', alTecla); overlay.remove(); if (previo && previo.focus) previo.focus(); resolver(valor); };
    const alTecla = (e) => { if (e.key === 'Escape') cerrar(false); };
    const botonAceptar = h('button', { class: `btn ${peligro ? 'btn--danger' : 'btn--primary'}`, type: 'button', onclick: () => cerrar(true), text: aceptar });
    const overlay = h('div', { class: 'tm-modal-fondo', onclick: (e) => { if (e.target === overlay) cerrar(false); } },
      h('div', { class: 'tm-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idTitulo },
        h('h2', { id: idTitulo, text: titulo }), texto ? h('p', { text: texto }) : null,
        h('div', { class: 'tm-modal-acciones' }, h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => cerrar(false), text: cancelar }), botonAceptar)));
    document.getElementById('modals-root').append(overlay);
    document.addEventListener('keydown', alTecla);
    botonAceptar.focus();
  });
}

// Pantalla de mensaje: estado vacío, error, sin acceso…
export function mensaje({ nombreIcono = 'information-circle-outline', tono = 'info', titulo, texto, acciones = [] }) {
  return h('div', { class: 'tm-mensaje' },
    h('div', { class: `tm-mensaje-icono tm-mensaje-icono--${tono}` }, icono(nombreIcono)),
    h('h2', { class: 'tm-mensaje-titulo', text: titulo }), texto ? h('p', { class: 'tm-mensaje-texto', text: texto }) : null,
    acciones.length ? h('div', { class: 'tm-mensaje-acciones' }, acciones) : null);
}

export function cargando(texto = 'Cargando…') {
  return h('div', { class: 'tm-cargando', role: 'status' }, icono('sync-outline', 'spin-animation'), h('p', { text: texto }));
}

export { montar };
