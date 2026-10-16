import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { abrirVisorVale } from '../components/visorDocumento.js';
import { confirmarRecibido, darDeBajaVale, reenviarVale } from '../api/valesApi.js';
import { escapeHtml } from '../utils/formato.js';
import { cargarBuzon } from '../views/buzon.js';
import { abrirSelectorModificacion } from './modificacionTipo.js';

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
// Asesor: decidir sobre un vale PENDIENTE_CONFIRMACION (paso 5)
// -----------------------------------------------------------------------
// Un solo botón abre el visor con el vale y la propuesta; abajo a la derecha van «Solicitar modificación» y «Confirmar recibido».
export function abrirVisorDecisionAsesor(vale, propuesta) {
  return abrirVisorVale({
    id: vale.id, correlativo: vale.correlativo, propuesta,
    acciones: [
      { etiqueta: 'Solicitar modificación', icono: 'create-outline', clase: 'btn--ghost', onClick: ({ cerrar }) => { cerrar(); abrirSelectorModificacion(vale); } },
      {
        etiqueta: 'Confirmar recibido', icono: 'checkmark-outline', clase: 'btn--primary',
        onClick: async ({ cerrar, boton }) => {
          boton.disabled = true;
          try {
            await confirmarRecibido(vale.id);
            window.toast.success('Recibido', `${vale.correlativo} confirmado como recibido.`);
            cerrar();
            cargarBuzon();
          } catch (error) {
            window.toast.error('No se pudo confirmar', error.message);
            boton.disabled = false;
            cargarBuzon();
          }
        }
      }
    ]
  });
}
