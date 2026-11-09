// src/modules/proyectos/controllers/plantillaController.js
// HTTP de las plantillas de proyecto (A4 y A4b). Solo llega quien tiene proyectos.administrar.
const plantillaService = require('../services/plantillaService');
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

class PlantillaController {
  constructor() {
    this.listar = accion(200, async () => ({ items: await plantillaService.listar() }));
    this.crear = accion(201, async req => ({ item: await plantillaService.crear(comoObjeto(req.body), req.user.id) }));
    this.editar = accion(200, async req => ({ item: await plantillaService.editar(req.params.id, comoObjeto(req.body), req.user.id) }));
    this.cambiarActivo = accion(200, async req => ({ item: await plantillaService.cambiarActivo(req.params.id, comoObjeto(req.body).activa, req.user.id) }));
  }
}

module.exports = new PlantillaController();
