import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { htmlAdjuntosPropuesta, wireAdjuntosPropuesta } from '../components/adjuntosPropuesta.js';
import { comenzarVale, entregarPropuesta, cancelarProceso, pausarVale, reanudarVale } from '../api/valesApi.js';
import { cargarBuzon } from '../views/buzon.js';

// -----------------------------------------------------------------------
// Diseñador: comenzar / entregar / cancelar / pausar / reanudar
// -----------------------------------------------------------------------
export async function accionComenzar(vale) {
  try {
    await comenzarVale(vale.id);
    window.toast.success('En proceso', `${vale.correlativo} marcado como en proceso.`);
    cargarBuzon();
  } catch (error) {
    window.toast.error('No se pudo actualizar', error.message);
  }
}

export function abrirModalEntregar(vale) {
  const { overlay, cerrar } = abrirModal({
    title: `Entregar propuesta — ${vale.correlativo}`,
    size: 'lg',
    bodyHtml: htmlAdjuntosPropuesta({ idArchivo: 'input-propuesta' }),
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-enviar" disabled>Entregar</button>`
  });
  const btn = overlay.querySelector('#btn-enviar');
  const adjuntos = wireAdjuntosPropuesta(overlay, {
    idArchivo: 'input-propuesta',
    // El botón se habilita con un archivo o al menos un enlace válido; el resumen dice qué falta o qué se enviará.
    onCambio: ({ valido }) => { btn.disabled = !valido; }
  });
  // Una sola key por apertura del modal — si el envío falla y el usuario
  // reintenta con "Entregar" de nuevo, se reenvía con la misma key para que
  // el backend detecte el reintento y no duplique la propuesta.
  const idempotencyKey = crypto.randomUUID();
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  btn.addEventListener('click', async () => {
    const problema = adjuntos.validar();
    if (problema) { mostrarErrorModal(overlay, problema); return; }
    const formData = new FormData();
    adjuntos.agregarAFormData(formData, 'propuesta');
    formData.append('idempotencyKey', idempotencyKey);
    btn.disabled = true;
    try {
      await entregarPropuesta(vale.id, formData);
      window.toast.success('Propuesta entregada', `Propuesta de ${vale.correlativo} entregada.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}

export async function accionCancelarProceso(vale) {
  if (!confirm(`¿Cancelar el proceso del vale ${vale.correlativo}? Se notificará al encargado.`)) return;
  try {
    await cancelarProceso(vale.id);
    window.toast.success('Proceso cancelado', `Proceso de ${vale.correlativo} cancelado.`);
    cargarBuzon();
  } catch (error) {
    window.toast.error('No se pudo cancelar', error.message);
  }
}

// El diseñador puede pausar/reanudar un vale EN_PROCESO sin entregar propuesta,
// para tomar otro más urgente.
export async function accionPausar(vale) {
  try {
    await pausarVale(vale.id);
    window.toast.success('Proceso pausado', `${vale.correlativo} quedó en pausa.`);
    cargarBuzon();
  } catch (error) {
    window.toast.error('No se pudo pausar', error.message);
  }
}

export async function accionReanudar(vale) {
  try {
    await reanudarVale(vale.id);
    window.toast.success('Proceso reanudado', `${vale.correlativo} está en proceso de nuevo.`);
    cargarBuzon();
  } catch (error) {
    window.toast.error('No se pudo reanudar', error.message);
  }
}
