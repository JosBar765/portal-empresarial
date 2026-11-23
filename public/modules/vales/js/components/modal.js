import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { cerrarPanelFechaActivo } from './datepicker.js';
import { registrarCapa } from '../utils/historialCapas.js';

// `alCerrar` (opcional) se ejecuta una sola vez, con el modal ya retirado, sea cual sea la forma de cerrarlo.
// `confirmarCierre(cerrar)` (opcional) intercepta los cierres del usuario (×, Escape, clic fuera, `intentarCerrar`); `cerrar` sigue siendo directo.
export function abrirModal({ title, bodyHtml, footerHtml, size, alCerrar, confirmarCierre }) {
  const root = $('#modals-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box ${size === 'lg' ? 'modal-lg' : ''}">
      <div class="modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;
  root.appendChild(overlay);
  // Cerrar con Escape mientras este modal esté abierto; el listener se quita
  // al cerrar para no dejar huérfanos con modales anidados.
  // Con confirmación, Escape solo actúa en el modal superior (si no, el aviso de salida abriría otro aviso encima).
  const intentarCerrar = () => (confirmarCierre ? confirmarCierre(cerrar) : cerrar());
  const onKeydown = (e) => {
    if (e.key !== 'Escape') return;
    if (confirmarCierre && root.lastElementChild !== overlay) return;
    intentarCerrar();
  };
  document.addEventListener('keydown', onKeydown);
  let alCerrarEjecutado = false;
  const cerrar = () => {
    soltarHistorial();
    document.removeEventListener('keydown', onKeydown);
    cerrarPanelFechaActivo(); // por si el modal se cierra con un calendario todavía abierto
    overlay.remove();
    if (alCerrar && !alCerrarEjecutado) {
      alCerrarEjecutado = true;
      alCerrar();
    }
  };
  const soltarHistorial = registrarCapa(intentarCerrar);
  overlay.querySelector('.modal-close').addEventListener('click', intentarCerrar);
  // Cerrar solo si el click EMPEZÓ (mousedown) y TERMINÓ (click) sobre el
  // propio backdrop: un `click` del DOM se dispara sobre el ancestro común de
  // mousedown y mouseup, así que arrastrar una selección de texto desde un
  // campo del formulario hasta soltar fuera del modal cerraba el modal aunque
  // el arrastre haya empezado adentro.
  let mousedownEnOverlay = false;
  overlay.addEventListener('mousedown', (e) => { mousedownEnOverlay = (e.target === overlay); });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && mousedownEnOverlay) intentarCerrar();
    mousedownEnOverlay = false;
  });
  return { overlay, cerrar, intentarCerrar };
}

export function mostrarErrorModal(overlay, mensaje) {
  let box = overlay.querySelector('.form-error');
  if (!box) {
    box = document.createElement('div');
    box.className = 'form-error';
    overlay.querySelector('.modal-body').prepend(box);
  }
  box.textContent = mensaje;
}
