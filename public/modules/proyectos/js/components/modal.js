import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';

let contadorModal = 0;
const ENFOCABLES = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function abrirModal({ title, bodyHtml, footerHtml, onCerrar }) {
  const root = $('#modals-root');
  const idTitulo = `modal-titulo-${++contadorModal}`;
  const previo = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="${idTitulo}" tabindex="-1">
      <div class="modal-header">
        <h3 id="${idTitulo}">${escapeHtml(title)}</h3>
        <button class="modal-close" type="button" aria-label="Cerrar">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;
  root.appendChild(overlay);
  const caja = overlay.querySelector('.modal-box');
  // El foco entra al diálogo (el lector de pantalla lo anuncia) y el Tab no se escapa a la página de atrás.
  caja.focus({ preventScroll: true });
  const onKeydown = (e) => {
    if (e.key === 'Escape') { cerrar(); return; }
    if (e.key !== 'Tab' || overlay !== root.lastElementChild) return;
    const lista = [...caja.querySelectorAll(ENFOCABLES)].filter(x => x.offsetParent !== null);
    if (!lista.length) { e.preventDefault(); return; }
    const primero = lista[0]; const ultimo = lista[lista.length - 1];
    if (e.shiftKey && (document.activeElement === primero || document.activeElement === caja)) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  };
  document.addEventListener('keydown', onKeydown);
  const cerrar = () => {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    if (previo && document.contains(previo) && typeof previo.focus === 'function') previo.focus({ preventScroll: true });
    if (onCerrar) onCerrar();
  };
  overlay.querySelector('.modal-close').addEventListener('click', cerrar);
  let mousedownEnOverlay = false;
  overlay.addEventListener('mousedown', (e) => { mousedownEnOverlay = (e.target === overlay); });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && mousedownEnOverlay) cerrar();
    mousedownEnOverlay = false;
  });
  return { overlay, cerrar };
}

// Confirmación sí/no; cerrar por cualquier otra vía equivale a cancelar.
export function confirmarModal({ title, mensaje, aceptar = 'Aceptar', cancelar = 'Cancelar' }) {
  return new Promise((resolve) => {
    const { overlay, cerrar } = abrirModal({
      title,
      bodyHtml: `<p>${escapeHtml(mensaje)}</p>`,
      footerHtml: `<button class="btn btn--ghost" type="button" data-accion="cancelar">${escapeHtml(cancelar)}</button><button class="btn btn--primary" type="button" data-accion="aceptar">${escapeHtml(aceptar)}</button>`,
      onCerrar: () => resolve(false)
    });
    overlay.querySelector('[data-accion="cancelar"]').addEventListener('click', cerrar);
    overlay.querySelector('[data-accion="aceptar"]').addEventListener('click', () => {
      resolve(true); // la primera resolución gana; el resolve(false) de onCerrar no la cambia
      cerrar();
    });
  });
}
