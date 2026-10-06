// src/core/notifications/notificacionService.js
// Centro de notificaciones: se guardan por usuario (las leídas se purgan a los 60 días)
// y se empujan en vivo a la sala personal `usuario:<id>` de cada destinatario.
const notificacionRepository = require('./notificacionRepository');
const socketManager = require('../websocket/socketManager');

const POR_PAGINA = 20;

class NotificacionService {
  async registrar(usuariosIds, datos) {
    for (const usuarioId of usuariosIds) {
      const notificacion = await notificacionRepository.crear(usuarioId, datos);
      socketManager.sendToRooms([`usuario:${usuarioId}`], 'notificacion_nueva', notificacion);
    }
  }

  async listar(usuarioId, { limite, desplazamiento }) {
    const limiteSeguro = Math.min(Math.max(Number(limite) || POR_PAGINA, 1), 50);
    const desde = Math.max(Number(desplazamiento) || 0, 0);
    const filas = await notificacionRepository.listar(usuarioId, limiteSeguro + 1, desde);
    return {
      notificaciones: filas.slice(0, limiteSeguro),
      hayMas: filas.length > limiteSeguro,
      noLeidas: await notificacionRepository.contarNoLeidas(usuarioId)
    };
  }

  marcarLeida(usuarioId, id) {
    return notificacionRepository.marcarLeida(usuarioId, id);
  }

  purgarLeidasAntiguas(dias) {
    return notificacionRepository.purgarLeidasAntiguas(dias);
  }

  marcarTodasLeidas(usuarioId) {
    return notificacionRepository.marcarTodasLeidas(usuarioId);
  }
}

module.exports = new NotificacionService();
