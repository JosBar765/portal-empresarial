// src/modules/vales/events.js
// Todos los clientes del módulo Vales se unen al canal 'vales' (register_module).
// Se transmite un evento genérico y el cliente refresca su buzón; mantiene la
// integración en tiempo real simple y evita mantener salas por rol/usuario sincronizadas.
const socketManager = require('../../core/websocket/socketManager');

const CANAL = 'vales';

function notificarNuevoVale(vale) {
  socketManager.sendToModule(CANAL, 'vale_evento', {
    tipo: 'creado',
    valeId: vale.id,
    correlativo: vale.correlativo,
    estado: vale.estado,
    asesorId: vale.asesor_id
  });
}

function notificarCambioEstado(vale) {
  socketManager.sendToModule(CANAL, 'vale_evento', {
    tipo: 'estado',
    valeId: vale.id,
    correlativo: vale.correlativo,
    estado: vale.estado,
    asesorId: vale.asesor_id
  });
}

module.exports = {
  notificarNuevoVale,
  notificarCambioEstado
};
