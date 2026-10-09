import { state } from '../state.js';
import { abrirModal } from '../components/modal.js';
import { formatearFechaHora, escapeHtml } from '../utils/formato.js';
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
  // Registro de las conversaciones del rechazo (solo con el permiso de historial): hilo completo, de solo lectura.
  const conversaciones = (detalle.conversaciones || []).map(c => `
    <details class="registro-conversacion">
      <summary><ion-icon name="chatbubbles-outline" aria-hidden="true"></ion-icon>Conversación del rechazo — ${escapeHtml(c.taller)} <span>${c.mensajes.length} mensaje${c.mensajes.length === 1 ? '' : 's'}</span></summary>
      <ul class="registro-mensajes">
        ${c.mensajes.map(m => `<li class="registro-mensaje registro-mensaje--${m.lado === 'TALLER' ? 'taller' : 'asesor'}">
          <span class="registro-meta"><strong>${escapeHtml(m.autor)}</strong> · ${m.lado === 'TALLER' ? 'Taller' : 'Asesor'} · ${escapeHtml(formatearFechaHora(m.creado_en))}</span>
          <span>${escapeHtml(m.mensaje)}</span>
        </li>`).join('')}
      </ul>
    </details>`).join('');
  overlay.querySelector('.modal-body').innerHTML = `
    <ul class="historial-list">
      ${(detalle.historial || []).map(h => `<li><span class="fecha">${formatearFechaHora(h.creado_en)}</span>${h.actor_nombre ? `<strong>${escapeHtml(h.actor_nombre)}:</strong> ` : ''}${escapeHtml(h.accion)}</li>`).join('') || '<li>Sin movimientos registrados.</li>'}
    </ul>
    ${conversaciones}
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
