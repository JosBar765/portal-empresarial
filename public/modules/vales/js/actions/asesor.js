import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { abrirVisorVale } from '../components/visorDocumento.js';
import { confirmarRecibido, darDeBajaVale, reenviarVale } from '../api/valesApi.js';
import { escapeHtml } from '../utils/formato.js';
import { state } from '../state.js';
import { puede } from '../permisos.js';
import { ESTADOS_LABEL } from '../config/estados.js';
import { abrirModalBajaTaller } from './adjuntos.js';
import { cargarBuzon } from '../views/buzon.js';
import { abrirSelectorModificacion } from './modificacionTipo.js';
import { abrirConversacionesRechazo, abrirModalRechazarPropuesta } from './rechazoPropuesta.js';
import { rechazosSinLeer, textoRechazos } from '../utils/modificacionesVistas.js';

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

// Vale multitaller con algún taller en adjuntos rechazados/respondidos: se elige entre quitar un taller o todo el vale.
const ofreceBajaPorTaller = (vale) => !(Number(vale.vale_original_id) > 0)
  && (vale.talleres_estado || []).length >= 2 && (vale.adjuntos || []).length > 0;

// Punto de entrada del icono «Dar de baja» del buzón.
export function abrirDarDeBaja(vale) {
  if (ofreceBajaPorTaller(vale)) abrirModalDarDeBajaMultitaller(vale);
  else abrirModalDarDeBaja(vale);
}

function abrirModalDarDeBajaMultitaller(vale) {
  const reclamados = new Map((vale.adjuntos || []).map(a => [a.taller_id, a]));
  const tarjetas = vale.talleres_estado.map(t => {
    const adjunto = reclamados.get(t.taller_id);
    const clase = !adjunto ? '' : t.estado === 'ADJUNTOS_RESPONDIDOS' ? ' chip-estado--info' : ' chip-estado--alerta';
    return `<li class="rechazo-tarjeta">
      <div class="rechazo-cab"><strong>${escapeHtml(t.taller)}</strong><span class="chip-estado${clase}">${escapeHtml(ESTADOS_LABEL[t.estado] || t.estado)}</span></div>
      ${adjunto ? `<div class="rechazo-acciones"><button class="btn btn--ghost btn--sm" data-baja-taller="${Number(t.taller_id)}"><ion-icon name="ban-outline"></ion-icon> Dar de baja a este taller</button></div>` : ''}
    </li>`;
  }).join('');
  const { overlay, cerrar } = abrirModal({
    title: `Dar de baja — ${vale.correlativo}`,
    bodyHtml: `
      <p style="font-size:13px;margin-bottom:10px;">Puedes quitar solo a un taller que rechazó o ya respondió sobre los adjuntos, o dar de baja el vale completo.</p>
      <ul class="rechazo-lista">${tarjetas}</ul>
    `,
    footerHtml: '<button class="btn btn--ghost" id="btn-cerrar">Cerrar</button><button class="btn btn--danger" id="btn-vale-completo">Dar de baja el vale completo</button>'
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-vale-completo').addEventListener('click', () => { cerrar(); abrirModalDarDeBaja(vale); });
  overlay.querySelectorAll('[data-baja-taller]').forEach(btn => {
    btn.addEventListener('click', () => {
      const adjunto = reclamados.get(Number(btn.dataset.bajaTaller));
      if (adjunto) abrirModalBajaTaller(vale, adjunto, cerrar);
    });
  });
}

// -----------------------------------------------------------------------
// Asesor: decidir sobre un vale PENDIENTE_CONFIRMACION (paso 5)
// -----------------------------------------------------------------------
// Un solo botón abre el visor con el vale y la propuesta; abajo a la derecha van «Rechazar propuesta», «Solicitar modificación» y «Confirmar recibido».
export function abrirVisorDecisionAsesor(vale, propuesta) {
  // Si un taller rechazó la solicitud del asesor y este aún no la abrió, el visor lo avisa con acceso a la conversación.
  const rechazos = rechazosSinLeer(vale);
  const aviso = rechazos.length ? {
    texto: `${textoRechazos(rechazos)}. El vale sigue igual: puedes confirmarlo, rechazar de nuevo o pedir una modificación.`,
    boton: { etiqueta: 'Ver chat', onClick: ({ quitar }) => { quitar(); abrirConversacionesRechazo(vale, { ids: rechazos.map(r => r.id) }); } }
  } : null;
  const puedeRechazar = puede('rechazarPropuesta') && vale.asesor_id === state.user.id;
  return abrirVisorVale({
    aviso,
    id: vale.id, correlativo: vale.correlativo, propuesta, subtitulo: 'Revisa el vale y la propuesta, y decide.',
    acciones: [
      ...(puedeRechazar ? [{ etiqueta: 'Rechazar propuesta', icono: 'close-circle-outline', clase: 'btn--ghost', onClick: ({ cerrar }) => { cerrar(); abrirModalRechazarPropuesta(vale); } }] : []),
      { etiqueta: 'Solicitar modificación', icono: 'create-outline', clase: 'btn--ghost', onClick: ({ cerrar }) => { cerrar(); abrirSelectorModificacion(vale); } },
      {
        etiqueta: 'Confirmar recibido', icono: 'checkmark-outline', clase: 'btn--primary',
        onClick: async ({ cerrar, boton }) => {
          boton.disabled = true;
          try {
            await confirmarRecibido(vale.id);
            window.toast.success('Recibido', `${vale.correlativo} confirmado.`);
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
