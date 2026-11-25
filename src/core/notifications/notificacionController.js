// src/core/notifications/notificacionController.js
const notificacionService = require('./notificacionService');
const pushService = require('./pushService');
const preferenciaService = require('./preferenciaService');
const { responderError, responderErrorInterno } = require('../utils/erroresHttp');
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

  pushConfig(req, res) {
    // `usuarioId`: el navegador recuerda quién activó el dispositivo.
    return res.json({ habilitado: pushService.habilitado(), clavePublica: pushService.clavePublica(), usuarioId: req.user.id });
  }

  async pushSuscribir(req, res) {
    try {
      await pushService.suscribir(req.user.id, req.body, req.get('user-agent'));
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async pushDesuscribir(req, res) {
    try {
      await pushService.desuscribir(req.user.id, req.body && req.body.endpoint);
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
    }
  }

  async listarPreferencias(req, res) {
    try {
      return res.json(await preferenciaService.listar(req.user, req.query.modulo));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async guardarPreferencia(req, res) {
    try {
      await preferenciaService.guardar(req.user, req.body);
      return res.json({ ok: true });
    } catch (error) {
      return responderError(res, error);
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
