import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { t } from '../textos.js';

export function abrirModal({ title, bodyHtml, footerHtml, size, onCerrar }) {
  const root = $('#modals-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box ${size === 'lg' ? 'modal-lg' : ''}">
      <div class="modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="modal-close" type="button" aria-label="${escapeHtml(t('comun.cerrar'))}">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;
  root.appendChild(overlay);
  const onKeydown = (e) => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', onKeydown);
  const cerrar = () => {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
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

export function mostrarErrorModal(overlay, mensaje) {
  let box = overlay.querySelector('.form-error');
  if (!box) {
    box = document.createElement('div');
    box.className = 'form-error';
    overlay.querySelector('.modal-body').prepend(box);
  }
  box.textContent = mensaje;
}

// Confirmación sí/no; cerrar por cualquier otra vía equivale a cancelar.
export function confirmarModal({ title, mensaje, aceptar = t('comun.aceptar'), cancelar = t('comun.cancelar') }) {
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
