// src/modules/proyectos/controllers/avisosController.js
// HTTP de la matriz de avisos (A8). Solo traduce la petición; las reglas viven en avisosService.
const avisosService = require('../services/avisosService');
const { responderError } = require('../../../core/utils/erroresHttp');
const { extraDeError } = require('../errores');

const comoObjeto = valor => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});

const accion = (fn) => async (req, res) => {
  try {
    return res.status(200).json(await fn(req));
  } catch (error) {
    return responderError(res, error, 400, extraDeError(error));
  }
};

class AvisosController {
  constructor() {
    this.matriz = accion(() => avisosService.matriz());
    this.guardar = accion(async (req) => ({ cambio: await avisosService.guardar(req.user.id, comoObjeto(req.body)), ...(await avisosService.matriz()) }));
    this.restaurar = accion(async (req) => ({ cambio: await avisosService.restaurar(req.user.id), ...(await avisosService.matriz()) }));
  }
}

module.exports = new AvisosController();
