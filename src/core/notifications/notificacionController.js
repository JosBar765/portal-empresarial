// src/core/notifications/notificacionController.js
const notificacionService = require('./notificacionService');
const { responderErrorInterno } = require('../utils/erroresHttp');
const { idObligatorio } = require('../utils/validar');

class NotificacionController {
  async listar(req, res) {
    try {
      const data = await notificacionService.listar(req.user.id, { modulo: req.query.modulo, limite: req.query.limite, desplazamiento: req.query.desplazamiento });
      return res.json(data);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async resumen(req, res) {
    try {
      return res.json(await notificacionService.resumen(req.user.id));
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async marcarLeida(req, res) {
    try {
      await notificacionService.marcarLeida(req.user.id, idObligatorio(req.params.id));
      return res.json({ ok: true });
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async marcarTodasLeidas(req, res) {
    try {
      await notificacionService.marcarTodasLeidas(req.user.id, req.body && req.body.modulo);
      return res.json({ ok: true });
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }
}

module.exports = new NotificacionController();
