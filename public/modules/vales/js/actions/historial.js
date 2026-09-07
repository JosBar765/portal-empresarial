import { state } from '../state.js';
import { abrirModal } from '../components/modal.js';
import { formatearFechaHora } from '../utils/formato.js';
import { obtenerDetalleVale } from '../api/valesApi.js';

// Se mantiene actualizado en tiempo real mientras está abierto — mismo patrón
// que state.cargaTrabajoModal (ver socket.js, handler de vale_evento).
async function renderContenidoHistorial(overlay, valeId) {
  let detalle;
  try {
    detalle = await obtenerDetalleVale(valeId);
  } catch {
    detalle = { historial: [] };
  }
  overlay.querySelector('.modal-body').innerHTML = `
    <ul class="historial-list">
      ${(detalle.historial || []).map(h => `<li><span class="fecha">${formatearFechaHora(h.creado_en)}</span>${h.actor_nombre ? `<strong>${h.actor_nombre}:</strong> ` : ''}${h.accion}</li>`).join('') || '<li>Sin movimientos registrados.</li>'}
    </ul>
  `;
}

export async function abrirModalHistorial(vale) {
  const { overlay } = abrirModal({
    title: `Historial — ${vale.correlativo}`,
    bodyHtml: `<ul class="historial-list"></ul>`
  });
  state.historialModal = { overlay, actualizar: () => renderContenidoHistorial(overlay, vale.id) };
  await renderContenidoHistorial(overlay, vale.id);
}
