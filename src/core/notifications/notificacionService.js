// src/core/notifications/notificacionService.js
// Centro de notificaciones: cada notificación pertenece a un módulo (`modulo`) y se guarda por usuario (las leídas se
// purgan a los 60 días); se empuja en vivo a la sala personal `usuario:<id>` de cada destinatario.
const notificacionRepository = require('./notificacionRepository');
const socketManager = require('../websocket/socketManager');
const { MODULOS } = require('../permissions/modulesCatalog');
const { ErrorDeNegocio } = require('../utils/erroresHttp');

const POR_PAGINA = 20;

// El módulo debe existir en el catálogo del portal.
function validarModulo(modulo) {
  if (!MODULOS.some(m => m.id === modulo)) throw new ErrorDeNegocio('El módulo de las notificaciones no es válido.');
  return modulo;
}

class NotificacionService {
  async registrar(usuariosIds, datos) {
    validarModulo(datos.modulo);
    for (const usuarioId of usuariosIds) {
      const notificacion = await notificacionRepository.crear(usuarioId, datos);
      socketManager.sendToRooms([`usuario:${usuarioId}`], 'notificacion_nueva', notificacion);
    }
  }

  async listar(usuarioId, { modulo, limite, desplazamiento }) {
    validarModulo(modulo);
    const limiteSeguro = Math.min(Math.max(Number(limite) || POR_PAGINA, 1), 50);
    const desde = Math.max(Number(desplazamiento) || 0, 0);
    const filas = await notificacionRepository.listar(usuarioId, modulo, limiteSeguro + 1, desde);
    return {
      notificaciones: filas.slice(0, limiteSeguro),
      hayMas: filas.length > limiteSeguro,
      noLeidas: await notificacionRepository.contarNoLeidas(usuarioId, modulo)
    };
  }

  marcarLeida(usuarioId, id) {
    return notificacionRepository.marcarLeida(usuarioId, id);
  }

  purgarLeidasAntiguas(dias) {
    return notificacionRepository.purgarLeidasAntiguas(dias);
  }

  marcarTodasLeidas(usuarioId, modulo) {
    return notificacionRepository.marcarTodasLeidas(usuarioId, validarModulo(modulo));
  }

  // { vales: 3, admin: 0 }: las no leídas de cada módulo.
  async resumen(usuarioId) {
    const filas = await notificacionRepository.contarNoLeidasPorModulo(usuarioId);
    return Object.fromEntries(MODULOS.map(m => [m.id, Number((filas.find(f => f.modulo === m.id) || {}).n || 0)]));
  }
}

module.exports = new NotificacionService();
