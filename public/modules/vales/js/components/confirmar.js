import { abrirModal } from './modal.js';
import { escapeHtml } from '../utils/formato.js';

// Confirmación previa a una acción sin vuelta atrás; mismo marcado que el modal de eliminar borrador.
export function confirmarAccion({ title, mensaje, textoConfirmar, claseConfirmar = 'btn--primary', alConfirmar }) {
  const { overlay, cerrar } = abrirModal({
    title,
    bodyHtml: `
      <p style="font-size:14px;font-weight:600;margin-bottom:8px;">¿Estás seguro?</p>
      <p style="font-size:13px;">${escapeHtml(mensaje)}</p>
    `,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn ${claseConfirmar}" id="btn-confirmar">${escapeHtml(textoConfirmar)}</button>`
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-confirmar').addEventListener('click', () => {
    cerrar();
    alConfirmar();
  });
}
