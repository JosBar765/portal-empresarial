// src/modules/vales/events.js
// Cada evento se envía SOLO a las salas del rol/usuario a quien concierne (más la
// sala del administrador, que ve todo). Esto es lo que hace que el sonido de
// notificación en el cliente suene únicamente "del lado que cae la notificación"
// (ver .agents/correciones_mod_vales_de_arte_1.md, Cambios generales #1): si un
// cliente no está en ninguna de las salas objetivo, simplemente no recibe el evento.
const socketManager = require('../../core/websocket/socketManager');

const SALA_ADMIN = 'vales:admin';

function _emitir(tipo, vale, targets) {
  const salas = [...new Set([...(targets || []), SALA_ADMIN])];
  socketManager.sendToRooms(salas, 'vale_evento', {
    tipo,
    valeId: vale.id,
    correlativo: vale.correlativo,
    estado: vale.estado,
    asesorId: vale.asesor_id
  });
}

function notificarNuevoVale(vale, targets = []) {
  _emitir('creado', vale, targets);
}

function notificarCambioEstado(vale, targets = []) {
  _emitir('estado', vale, targets);
}

module.exports = {
  notificarNuevoVale,
  notificarCambioEstado
};
