// src/modules/proyectos/controllers/ganadosController.js
// HTTP de la cartera de clientes ganados. Solo traduce la petición; las reglas viven en ganadosService.
const ganadosService = require('../services/ganadosService');
const { responderError } = require('../../../core/utils/erroresHttp');
const { extraDeError } = require('../errores');

class GanadosController {
  async listar(req, res) {
    try {
      return res.json(await ganadosService.listar(req.user, req.query));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }
}

module.exports = new GanadosController();
