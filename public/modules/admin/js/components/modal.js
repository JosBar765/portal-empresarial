import { $ } from '../utils/dom.js';

export function abrirModal({ title, bodyHtml, footerHtml, size }) {
  const root = $('#modals-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box ${size === 'lg' ? 'modal-lg' : ''}">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close">&times;</button>
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
