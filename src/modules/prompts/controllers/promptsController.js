// src/modules/prompts/controllers/promptsController.js
const service = require('../services/promptsService');
const { responderError, responderErrorInterno } = require('../../../core/utils/erroresHttp');
const { extraDeError } = require('../errores');

class PromptsController {
  async listarProductos(req, res) {
    try {
      return res.json(await service.listarProductos());
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async obtenerContacto(req, res) {
    try {
      return res.json(await service.obtenerContacto(req.user.id));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async generar(req, res) {
    try {
      return res.json(await service.generar(req.user.id, req.body));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }
}

module.exports = new PromptsController();
