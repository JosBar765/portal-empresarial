// src/modules/proyectos/controllers/kitController.js
// HTTP del kit del nicho: la edición (A9, solo proyectos.administrar) y el kit con los datos de la empresa del asesor (M15).
const kitService = require('../services/kitService');
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

class KitController {
  constructor() {
    this.listar = accion(200, () => kitService.listar());
    this.obtener = accion(200, req => kitService.obtener(req.params.nichoId));
    this.guardar = accion(200, req => kitService.guardar(req.params.nichoId, comoObjeto(req.body), req.user.id));
    this.deLaEmpresa = accion(200, req => kitService.paraParticipacion(req.user, req.params.id));
  }
}

module.exports = new KitController();
