// src/modules/proyectos/controllers/valeVinculoController.js
// HTTP de la integración con Vales. Solo traduce la petición; las reglas viven en valeVinculoService.
const valeVinculoService = require('../services/valeVinculoService');
const { responderError } = require('../../../core/utils/erroresHttp');
const { extraDeError } = require('../errores');

const comoObjeto = valor => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});

const accion = (estado, fn) => async (req, res) => {
  try {
    return res.status(estado).json(await fn(req));
  } catch (error) {
    return responderError(res, error, 400, extraDeError(error));
  }
};

class ValeVinculoController {
  constructor() {
    this.prefill = accion(200, req => valeVinculoService.prefill(req.user, req.params.id));
    this.prefillRecompra = accion(200, req => valeVinculoService.prefillRecompra(req.user, req.params.clienteId));
    this.vincular = accion(200, req => valeVinculoService.vincular(req.user, req.params.id, comoObjeto(req.body)));
  }
}

module.exports = new ValeVinculoController();
