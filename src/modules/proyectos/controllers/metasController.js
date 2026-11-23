// src/modules/proyectos/controllers/metasController.js
// HTTP de las metas por asesor y de las rondas de reparto de la reserva. Solo traduce la petición; las reglas viven en los servicios.
const metasService = require('../services/metasService');
const rondasService = require('../services/rondasService');
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

class MetasController {
  constructor() {
    this.metas = accion(req => metasService.ver(req.user, req.params.id));
    this.ajustar = accion(req => metasService.ajustar(req.user, req.params.id, req.params.asesorId, comoObjeto(req.body)));
    this.reserva = accion(req => rondasService.ver(req.user, req.params.id));
    this.repartir = accion(req => rondasService.repartir(req.user, req.params.id, comoObjeto(req.body)));
  }
}

module.exports = new MetasController();
