// src/modules/proyectos/controllers/gestionController.js
// HTTP del trabajo del asesor. Solo traduce la petición; las reglas viven en gestionService.
const gestionService = require('../services/gestionService');
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

class GestionController {
  constructor() {
    this.miProyecto = accion(200, req => gestionService.miProyecto(req.user));
    this.paraHoy = accion(200, req => gestionService.paraHoy(req.user));
    this.anteriores = accion(200, req => gestionService.proyectosAnteriores(req.user));
    this.opciones = accion(200, () => gestionService.opciones());
    this.listar = accion(200, req => gestionService.listar(req.user, req.query));
    this.ficha = accion(200, req => gestionService.ficha(req.user, req.params.id));
    this.gestion = accion(201, req => gestionService.registrarGestion(req.user, req.params.id, comoObjeto(req.body)));
    this.cotizacion = accion(201, req => gestionService.registrarCotizacion(req.user, req.params.id, comoObjeto(req.body)));
    this.venta = accion(201, req => gestionService.registrarVenta(req.user, req.params.id, comoObjeto(req.body)));
    this.perdida = accion(200, req => gestionService.marcarPerdida(req.user, req.params.id, comoObjeto(req.body)));
    this.descartar = accion(200, req => gestionService.descartar(req.user, req.params.id, comoObjeto(req.body)));
  }
}

module.exports = new GestionController();
