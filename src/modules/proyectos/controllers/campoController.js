// src/modules/proyectos/controllers/campoController.js
// HTTP de los campos propios (A6) y del alcance de usuarios por país (A7). Solo llega quien tiene proyectos.administrar.
const campoService = require('../services/campoService');
const alcanceAdminService = require('../services/alcanceAdminService');
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

class CampoController {
  constructor() {
    this.listar = accion(200, async () => ({ items: await campoService.listar() }));
    this.crear = accion(201, async req => ({ item: await campoService.crear(comoObjeto(req.body), req.user.id) }));
    this.editar = accion(200, async req => ({ item: await campoService.editar(req.params.id, comoObjeto(req.body), req.user.id) }));
    this.cambiarActivo = accion(200, async req => ({ item: await campoService.cambiarActivo(req.params.id, comoObjeto(req.body).activo, req.user.id) }));
    this.listarAlcance = accion(200, req => alcanceAdminService.listar(req.query));
    this.guardarAlcance = accion(200, async req => ({ item: await alcanceAdminService.guardar(req.params.usuarioId, comoObjeto(req.body), req.user.id) }));
  }
}

module.exports = new CampoController();
