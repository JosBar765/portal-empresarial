import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { confirmarRecibido } from '../api/valesApi.js';
import { cargarBuzon } from '../views/buzon.js';
import { abrirModalSolicitarModificacion } from '../forms/valeForm.js';

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
        ${vale.propuesta_general_url ? `<a href="/${vale.propuesta_general_url}" target="_blank" class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver propuesta</a>` : ''}
      </div>
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
