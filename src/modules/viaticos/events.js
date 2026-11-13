// src/modules/viaticos/events.js
// Tiempo real del módulo: la sala de gestión (solo con viaticos.gestionar) y el aviso de que una solicitud cambió.
const socketManager = require('../../core/websocket/socketManager');
const { PERMISOS, TIEMPO_REAL } = require('./constantes');

// Se valida en el servidor con el usuario ya autenticado del socket: el cliente nunca decide a qué sala tiene derecho.
async function puedeUnirseASala(socket, sala) {
  return sala === TIEMPO_REAL.SALA_GESTION && (socket.user.permissions || []).includes(PERMISOS.GESTIONAR);
}
socketManager.registrarValidadorSala(puedeUnirseASala);

// El aviso es idempotente (el cliente solo refresca); un fallo se registra y nunca deshace la operación que lo originó.
function emitirActualizacion({ id, correlativo, estado, solicitanteId, actorId, accion }) {
  try {
    // El solicitante va en el aviso para que el cliente sepa si la solicitud es suya y decida a quién mostrarle el toast.
    // El actor va en el aviso para que quien hizo la acción no reciba además un aviso de lo que acaba de hacer.
    const datos = { id, correlativo, estado, solicitanteId, actorId, accion };
    socketManager.sendToModule(TIEMPO_REAL.SALA_GESTION, TIEMPO_REAL.EVENTO_ACTUALIZADA, datos);
    socketManager.sendToUsers([solicitanteId], TIEMPO_REAL.EVENTO_ACTUALIZADA, datos);
  } catch (error) {
    console.error('[Viáticos] No se pudo emitir el evento de tiempo real:', error.message);
  }
}

module.exports = { emitirActualizacion, puedeUnirseASala };
