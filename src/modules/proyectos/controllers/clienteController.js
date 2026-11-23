// src/modules/proyectos/controllers/clienteController.js
// HTTP de las empresas de la base global y sus contactos. Solo traduce la petición; las reglas viven en clienteService.
const clienteService = require('../services/clienteService');
const { responderError } = require('../../../core/utils/erroresHttp');
const { extraDeError } = require('../errores');

const comoObjeto = valor => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});

// Envuelve una acción: responde con `estado` y el resultado, o traduce el error (con el detalle por campo o los duplicados).
const accion = (estado, fn) => async (req, res) => {
  try {
    return res.status(estado).json(await fn(req));
  } catch (error) {
    return responderError(res, error, 400, extraDeError(error));
  }
};

class ClienteController {
  constructor() {
    this.opciones = accion(200, req => clienteService.opciones(req.user));
    this.listar = accion(200, req => clienteService.listar(req.user, req.query));
    this.duplicados = accion(200, req => clienteService.revisarDuplicados(req.user, comoObjeto(req.body)));
    this.crear = accion(201, req => {
      const { confirmarDuplicado, ...datos } = comoObjeto(req.body);
      return clienteService.crear(req.user, datos, { confirmarDuplicado: confirmarDuplicado === true });
    });
    this.obtener = accion(200, req => clienteService.obtener(req.user, req.params.id));
    this.actualizar = accion(200, req => {
      const { confirmarDuplicado, ...datos } = comoObjeto(req.body);
      return clienteService.actualizar(req.user, req.params.id, datos, { confirmarDuplicado: confirmarDuplicado === true });
    });
    this.cambiarEstado = accion(200, req => clienteService.cambiarEstado(req.user, req.params.id, comoObjeto(req.body)));
    this.agregarContacto = accion(201, req => clienteService.agregarContacto(req.user, req.params.id, comoObjeto(req.body)));
    this.actualizarContacto = accion(200, req => clienteService.actualizarContacto(req.user, req.params.contactoId, comoObjeto(req.body)));
    this.cambiarActivoContacto = accion(200, req => clienteService.cambiarActivoContacto(req.user, req.params.contactoId, comoObjeto(req.body).activo));
  }
}

module.exports = new ClienteController();
