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
  // Se une a la sala de este vale específico (independiente del rol) para
  // que socket.js reciba `vale_actualizado` sin importar si esta vista ya
  // estaba en alguna de las salas por rol que usa el resto de
  // notificaciones — antes el refresco en vivo dependía de esa coincidencia,
  // que casi siempre se daba para el Asesor pero no para el resto de roles.
  // No hace falta salir de la sala al cerrar: `vale_actualizado` es un
  // mensaje sin efectos (socket.js solo actúa si el modal sigue conectado
  // al DOM), así que una sala de más no causa ningún problema visible.
  if (state.socket) state.socket.emit('register_module', `vale:${vale.id}`);
  state.historialModal = { overlay, valeId: vale.id, actualizar: () => renderContenidoHistorial(overlay, vale.id) };
  await renderContenidoHistorial(overlay, vale.id);
}
