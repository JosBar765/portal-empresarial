// src/modules/prompts/controllers/ajustesController.js
const service = require('../services/ajustesService');
const { responderError, responderErrorInterno } = require('../../../core/utils/erroresHttp');
const { extraDeError } = require('../errores');

class AjustesController {
  async listar(req, res) {
    try {
      return res.json(await service.listar());
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async guardar(req, res) {
    try {
      return res.json(await service.guardar(req.params.clave, (req.body || {}).valor));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }
}

module.exports = new AjustesController();
