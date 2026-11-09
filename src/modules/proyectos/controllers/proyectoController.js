// src/modules/proyectos/controllers/proyectoController.js
// HTTP de los proyectos del mes. Solo traduce la petición; las reglas viven en proyectoService.
const proyectoService = require('../services/proyectoService');
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

class ProyectoController {
  constructor() {
    this.opciones = accion(200, req => proyectoService.opciones(req.user));
    this.candidatos = accion(200, async req => ({ candidatos: await proyectoService.candidatos(req.user, comoObjeto(req.body).tiendaIds) }));
    this.listar = accion(200, req => proyectoService.listar(req.user, req.query));
    this.crear = accion(201, req => proyectoService.crear(req.user, comoObjeto(req.body)));
    this.obtener = accion(200, req => proyectoService.obtener(req.user, req.params.id));
    this.editar = accion(200, req => proyectoService.editar(req.user, req.params.id, comoObjeto(req.body)));
    this.vistaPrevia = accion(200, req => proyectoService.vistaPrevia(req.user, req.params.id));
    this.activar = accion(200, req => proyectoService.activar(req.user, req.params.id, { idempotencyKey: comoObjeto(req.body).idempotencyKey }));
    this.cancelar = accion(200, req => proyectoService.cancelar(req.user, req.params.id, comoObjeto(req.body)));
  }
}

module.exports = new ProyectoController();
