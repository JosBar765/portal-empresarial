// src/modules/proyectos/controllers/seguimientoController.js
// HTTP del seguimiento del supervisor. Solo traduce la petición; las reglas viven en seguimientoService.
const seguimientoService = require('../services/seguimientoService');
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

class SeguimientoController {
  constructor() {
    this.proyectos = accion(200, req => seguimientoService.proyectos(req.user));
    this.resumen = accion(200, req => seguimientoService.resumen(req.user, req.params.id));
    this.porAsesor = accion(200, req => seguimientoService.porAsesor(req.user, req.params.id));
    this.porTienda = accion(200, req => seguimientoService.porTienda(req.user, req.params.id));
    this.estancados = accion(200, req => seguimientoService.estancados(req.user, req.params.id, { todos: req.query.todos === '1' }));
    this.destinos = accion(200, req => seguimientoService.destinos(req.user, req.params.id));
    this.supervision = accion(200, req => seguimientoService.supervision(req.user, req.params.id));
    this.reasignar = accion(200, req => seguimientoService.reasignar(req.user, req.params.id, comoObjeto(req.body)));
    this.anularCotizacion = accion(200, req => seguimientoService.anularCotizacion(req.user, req.params.id, req.params.cotizacionId, comoObjeto(req.body)));
    this.anularVenta = accion(200, req => seguimientoService.anularVenta(req.user, req.params.id, req.params.ventaId, comoObjeto(req.body)));
    this.ventas = accion(200, req => seguimientoService.ventas(req.user, req.query));
    this.confirmarVenta = accion(200, req => seguimientoService.confirmarVenta(req.user, req.params.id, comoObjeto(req.body)));
    this.rechazarVenta = accion(200, req => seguimientoService.rechazarVenta(req.user, req.params.id, comoObjeto(req.body)));
  }
}

module.exports = new SeguimientoController();
