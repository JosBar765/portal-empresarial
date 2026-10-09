import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { verificarAdjuntos, rechazarAdjuntos, responderAdjuntos } from '../api/valesApi.js';
import { escapeHtml, formatearFechaHora, tiempoRestante } from '../utils/formato.js';
import { puedeResponderAdjuntos } from '../permisos.js';
import { cargarBuzon } from '../views/buzon.js';

const MAX_PALABRAS = 200;
const MENSAJE_POR_DEFECTO = 'Adjuntos enviados al correo';

// -----------------------------------------------------------------------
// Encargado/asistente: verificar o rechazar los adjuntos de su taller
// -----------------------------------------------------------------------
export function abrirModalVerificarAdjuntos(vale) {
  const { overlay, cerrar } = abrirModal({
    title: `Verificar adjuntos — ${vale.correlativo}`,
    bodyHtml: `
      <p style="font-size:14px;font-weight:600;margin-bottom:8px;">¿Estás seguro que recibiste los adjuntos del vale de arte antes de trabajar?</p>
      <p style="font-size:13px;">Al confirmar, el vale queda listo para asignarse a un diseñador.</p>
    `,
    footerHtml: '<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-confirmar">Sí, los recibí</button>'
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-confirmar');
    btn.disabled = true;
    try {
      await verificarAdjuntos(vale.id);
      window.toast.success('Adjuntos verificados', `${vale.correlativo} ya puede asignarse a un diseñador.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
      cargarBuzon();
    }
  });
}

export function abrirModalRechazarAdjuntos(vale) {
  const { overlay, cerrar } = abrirModal({
    title: `Rechazar: sin adjuntos — ${vale.correlativo}`,
    bodyHtml: `
      <p style="font-size:14px;font-weight:600;margin-bottom:8px;">¿No recibiste los adjuntos?</p>
      <p style="font-size:13px;">El vale volverá al asesor, que tendrá 24 horas para avisar que los envió. Si no responde, el vale se elimina.</p>
    `,
    footerHtml: '<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--danger" id="btn-confirmar">Rechazar</button>'
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-confirmar');
    btn.disabled = true;
    try {
      await rechazarAdjuntos(vale.id);
      window.toast.success('Vale rechazado', `${vale.correlativo} volvió al asesor por falta de adjuntos.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
      cargarBuzon();
    }
  });
}

// Encargado: leer el mensaje con el que el asesor avisó que envió los adjuntos.
export function abrirModalMensajeAdjuntos(vale) {
  const { overlay, cerrar } = abrirModal({
    title: `Mensaje del asesor — ${vale.correlativo}`,
    bodyHtml: `
      <p class="mensaje-adjuntos">${escapeHtml(vale.adjuntos_mensaje || MENSAJE_POR_DEFECTO)}</p>
      <p style="font-size:12px;color:var(--color-text-secondary);margin-top:8px;">Enviado el ${escapeHtml(formatearFechaHora(vale.adjuntos_respondido_en))}</p>
    `,
    footerHtml: '<button class="btn btn--primary" id="btn-cerrar">Entendido</button>'
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
}

// -----------------------------------------------------------------------
// Asesor (y supervisor): vale con adjuntos pendientes. Solo el dueño responde.
// -----------------------------------------------------------------------
export function abrirModalAdjuntosPendientes(vale) {
  const adjuntos = vale.adjuntos || [];
  const puedeResponder = puedeResponderAdjuntos(vale);
  const filas = adjuntos.map(a => {
    if (a.estado === 'ADJUNTOS_RESPONDIDOS') {
      return `<li class="adjuntos-item">
        <p style="font-size:13px;font-weight:600;">${escapeHtml(a.taller)}</p>
        <p style="font-size:13px;">Adjuntos enviados, esperando verificación del taller.</p>
        <p class="mensaje-adjuntos">${escapeHtml(a.mensaje || MENSAJE_POR_DEFECTO)}</p>
      </li>`;
    }
    const resta = tiempoRestante(a.vence_en);
    return `<li class="adjuntos-item">
      <p style="font-size:13px;font-weight:600;">${escapeHtml(a.taller)}</p>
      <p class="motivo-rechazo">Faltan los adjuntos de este taller. ${a.vence_en ? `El vale se elimina automáticamente el ${escapeHtml(formatearFechaHora(a.vence_en))}${resta ? ` (quedan ${escapeHtml(resta)})` : ''}.` : ''}</p>
      ${puedeResponder ? `<button class="btn btn--primary" style="margin-top:8px;" data-responder="${Number(a.taller_id)}">Adjuntos enviados al correo</button>` : ''}
    </li>`;
  }).join('');

  const hayRechazados = adjuntos.some(a => a.estado === 'ADJUNTOS_RECHAZADOS');
  const { overlay, cerrar } = abrirModal({
    title: `${hayRechazados ? 'Faltan adjuntos' : 'Adjuntos enviados'} — ${vale.correlativo}`,
    bodyHtml: `
      <ul class="historial-list">${filas}</ul>
      ${hayRechazados && !puedeResponder ? '<p style="font-size:12px;color:var(--color-text-secondary);margin-top:10px;">Solo el asesor del vale puede responder.</p>' : ''}
    `,
    footerHtml: '<button class="btn btn--ghost" id="btn-cerrar">Cerrar</button>'
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelectorAll('[data-responder]').forEach(btn => {
    btn.addEventListener('click', () => {
      const adjunto = adjuntos.find(a => a.taller_id === Number(btn.dataset.responder));
      if (adjunto) abrirModalResponderAdjuntos(vale, adjunto, cerrar);
    });
  });
}

function abrirModalResponderAdjuntos(vale, adjunto, cerrarPadre) {
  const { overlay, cerrar } = abrirModal({
    title: `Adjuntos enviados — ${adjunto.taller}`,
    bodyHtml: `
      <div class="form-field full">
        <label>Mensaje para el taller</label>
        <textarea id="mensaje-adjuntos" rows="4">${MENSAJE_POR_DEFECTO}</textarea>
        <div class="contador-palabras" id="mensaje-palabras"></div>
      </div>
    `,
    footerHtml: '<button class="btn btn--ghost" id="btn-volver">Volver</button><button class="btn btn--primary" id="btn-enviar">Enviar</button>'
  });
  const textarea = overlay.querySelector('#mensaje-adjuntos');
  const contador = overlay.querySelector('#mensaje-palabras');
  const btn = overlay.querySelector('#btn-enviar');
  const actualizar = () => {
    const n = textarea.value.trim().split(/\s+/).filter(Boolean).length;
    contador.textContent = `${n}/${MAX_PALABRAS} palabras`;
    contador.classList.toggle('is-excedido', n > MAX_PALABRAS);
    btn.disabled = n === 0 || n > MAX_PALABRAS;
  };
  textarea.addEventListener('input', actualizar);
  actualizar();
  overlay.querySelector('#btn-volver').addEventListener('click', cerrar);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await responderAdjuntos(vale.id, adjunto.taller_id, textarea.value.trim());
      window.toast.success('Respuesta enviada', `${adjunto.taller} verificará los adjuntos de ${vale.correlativo}.`);
      cerrar();
      cerrarPadre();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      actualizar();
      cargarBuzon();
    }
  });
}
