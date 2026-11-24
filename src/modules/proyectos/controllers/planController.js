// src/modules/proyectos/controllers/planController.js
// HTTP del plan del año (A2). Solo llega quien tiene proyectos.administrar; las reglas viven en planService.
const planService = require('../services/planService');
const { responderError } = require('../../../core/utils/erroresHttp');
const { extraDeError } = require('../errores');

const comoObjeto = valor => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});

const accion = (fn) => async (req, res) => {
  try {
    return res.json(await fn(req));
  } catch (error) {
    return responderError(res, error, 400, extraDeError(error));
  }
};

class PlanController {
  constructor() {
    this.anio = accion(req => planService.anio(req.params.anio));
    this.guardarMes = accion(req => planService.guardarMes(req.params.anio, req.params.mes, comoObjeto(req.body), req.user.id));
    this.quitarMes = accion(req => planService.quitarMes(req.params.anio, req.params.mes, req.user.id));
  }
}

module.exports = new PlanController();
