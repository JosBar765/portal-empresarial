import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { t } from '../textos.js';

// `subtitle` va bajo el título; `clase` se suma a la caja; `antesDeCerrar()` (sí/no, puede ser asíncrona) filtra X, Escape y clic fuera,
// y `cerrar()` siempre cierra sin preguntar.
export function abrirModal({ title, subtitle, bodyHtml, footerHtml, size, clase, alCerrar, antesDeCerrar }) {
  const root = $('#modals-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box ${size === 'lg' ? 'modal-lg' : ''} ${clase ? escapeHtml(clase) : ''}">
      <div class="modal-header">
        ${subtitle ? `<div class="modal-titulos"><h3>${escapeHtml(title)}</h3><p class="modal-subtitulo">${escapeHtml(subtitle)}</p></div>` : `<h3>${escapeHtml(title)}</h3>`}
        <button class="modal-close" type="button" aria-label="${escapeHtml(t('comun.cerrar'))}">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;
  root.appendChild(overlay);
  const onKeydown = (e) => { if (e.key === 'Escape') intentarCerrar(); };
  document.addEventListener('keydown', onKeydown);
  const cerrar = () => {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    if (alCerrar) alCerrar();
  };
  let consultando = false;
  const intentarCerrar = async () => {
    if (!antesDeCerrar) { cerrar(); return; }
    if (consultando) return; // una confirmación abierta ya está decidiendo
    consultando = true;
    try {
      if (await antesDeCerrar()) cerrar();
    } finally {
      consultando = false;
    }
  };
  overlay.querySelector('.modal-close').addEventListener('click', intentarCerrar);
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

const htmlDetalles = (detalles) => (detalles.length
  ? `<dl class="vi-confirmar-detalle">${detalles.map(d => `<div class="vi-confirmar-detalle__fila${d.destacado ? ' is-destacado' : ''}"><dt>${escapeHtml(d.etiqueta)}</dt><dd>${escapeHtml(d.valor)}</dd></div>`).join('')}</dl>`
  : '');

// Confirmación sí/no; cerrar por cualquier otra vía equivale a cancelar. Con `peligro` el botón de aceptar es rojo (acciones que no se pueden deshacer).
// `detalles` ([{ etiqueta, valor, destacado }]) agrega una tabla de datos bajo el mensaje, p. ej. el resumen de lo que se va a autorizar.
export function confirmarModal({ title, mensaje, detalles = [], aceptar = t('comun.aceptar'), cancelar = t('comun.cancelar'), peligro = false }) {
  return new Promise((resolve) => {
    const { overlay, cerrar } = abrirModal({
      title,
      bodyHtml: `<p>${escapeHtml(mensaje)}</p>${htmlDetalles(detalles)}`,
      footerHtml: `<button class="btn btn--ghost" type="button" data-accion="cancelar">${escapeHtml(cancelar)}</button><button class="btn ${peligro ? 'btn--danger' : 'btn--primary'}" type="button" data-accion="aceptar">${escapeHtml(aceptar)}</button>`,
      alCerrar: () => resolve(false)
    });
    overlay.querySelector('[data-accion="cancelar"]').addEventListener('click', cerrar);
    overlay.querySelector('[data-accion="aceptar"]').addEventListener('click', () => {
      resolve(true); // la primera resolución gana; el resolve(false) de alCerrar no la cambia
      cerrar();
    });
  });
}
