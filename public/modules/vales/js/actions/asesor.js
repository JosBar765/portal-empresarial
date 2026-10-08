import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { confirmarRecibido, darDeBajaVale, reenviarVale } from '../api/valesApi.js';
import { escapeHtml } from '../utils/formato.js';
import { cargarBuzon } from '../views/buzon.js';
import { abrirModalSolicitarModificacion } from '../forms/valeForm.js';

// Asesor: ver el motivo con el que el supervisor rechazó su vale.
export function abrirModalMotivoRechazo(vale) {
  const { overlay, cerrar } = abrirModal({
    title: `Vale rechazado — ${vale.correlativo}`,
    bodyHtml: `
      <p style="font-size:13px;margin-bottom:8px;">El supervisor devolvió este vale con el siguiente motivo:</p>
      <p class="motivo-rechazo">${escapeHtml(vale.rechazo_motivo || 'Sin motivo registrado.')}</p>
      <p style="font-size:13px;margin-top:12px;">Corrígelo con el botón de la tuerca y luego reenvíalo a autorización, o dalo de baja.</p>
    `,
    footerHtml: '<button class="btn btn--primary" id="btn-cerrar">Entendido</button>'
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
}

// Asesor: volver a mandar a autorización un vale rechazado.
export async function accionReenviar(vale) {
  try {
    await reenviarVale(vale.id);
    window.toast.success('Vale reenviado', `${vale.correlativo} volvió a quedar en espera de autorización.`);
    cargarBuzon();
  } catch (error) {
    window.toast.error('No se pudo reenviar', error.message);
    cargarBuzon();
  }
}

// Asesor: dar de baja un vale propio que aún no fue autorizado.
export function abrirModalDarDeBaja(vale) {
  const { overlay, cerrar } = abrirModal({
    title: `Dar de baja — ${vale.correlativo}`,
    bodyHtml: `
      <p style="font-size:14px;font-weight:600;margin-bottom:8px;">¿Estás seguro?</p>
      <p style="font-size:13px;">${(vale.adjuntos || []).length
        ? 'El vale se cancelará por completo, para todos sus talleres, y se eliminará permanentemente junto con sus archivos. Esta acción no se puede deshacer.'
        : vale.vale_original_id
        ? 'La solicitud de modificación se eliminará permanentemente junto con sus archivos; el vale original no cambia. Esta acción no se puede deshacer.'
        : 'El vale se eliminará permanentemente junto con sus imágenes y documentos. Esta acción no se puede deshacer.'}</p>
    `,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--danger" id="btn-confirmar">Dar de baja</button>`
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-confirmar');
    btn.disabled = true;
    try {
      await darDeBajaVale(vale.id);
      window.toast.success(vale.vale_original_id ? 'Solicitud dada de baja' : 'Vale dado de baja', `${vale.correlativo} fue eliminado.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
      cargarBuzon();
    }
  });
}

// -----------------------------------------------------------------------
// Asesor: decidir sobre un vale PENDIENTE_CONFIRMACION (confirmar / corregir)
// -----------------------------------------------------------------------
// Rechazar no es una acción separada de "solicitar corrección": un solo botón
// "Rechazar" pide el motivo y manda el vale a corrección — cae al buzón del
// encargado, nunca queda como un estado "Rechazado" persistido.
export function abrirModalDecisionAsesor(vale) {
  const { overlay, cerrar } = abrirModal({
    title: `Vale pendiente de confirmación — ${vale.correlativo}`,
    bodyHtml: `
      <p style="font-size:13px;margin-bottom:14px;">Revisa el vale de arte final y decide qué hacer.</p>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <a href="/api/vales/${vale.id}/pdf" target="_blank" class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver vale de arte (PDF)</a>
        ${vale.propuesta_general_url ? `<a href="${vale.propuesta_general_url}" target="_blank" class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver propuesta</a>` : ''}
      </div>
      <p class="form-nota">Si solicitas una modificación, este vale pasará a «Recibido» de inmediato y se creará un vale de modificación (MOD-) con la propuesta original adjunta. El supervisor debe autorizarlo; si lo rechaza o vence, el MOD- se elimina y puedes solicitar uno nuevo.</p>
    `,
    footerHtml: `
      <button class="btn btn--danger" id="btn-solicitar-modificacion">Solicitar Modificación</button>
      <button class="btn btn--primary" id="btn-confirmar-recibido">Confirmar Recibido</button>
    `
  });

  overlay.querySelector('#btn-confirmar-recibido').addEventListener('click', async () => {
    try {
      await confirmarRecibido(vale.id);
      window.toast.success('Recibido', `${vale.correlativo} confirmado como recibido.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
    }
  });

  // Reusa el modal completo de solicitar modificación, que ya sabe pedir la
  // justificación y talleres y llamar al endpoint correspondiente.
  overlay.querySelector('#btn-solicitar-modificacion').addEventListener('click', () => {
    cerrar();
    abrirModalSolicitarModificacion(vale);
  });
}
