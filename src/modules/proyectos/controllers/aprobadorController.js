// src/modules/proyectos/controllers/aprobadorController.js
// HTTP de quién aprueba y quién da el visto bueno. La edición es solo de quien tiene proyectos.administrar.
const aprobadorService = require('../services/aprobadorService');
const { responderError } = require('../../../core/utils/erroresHttp');

const accion = (estado, trabajo) => async (req, res) => {
  try { res.status(estado).json(await trabajo(req)); } catch (error) { responderError(res, error); }
};

class AprobadorController {
  constructor() {
    this.listar = accion(200, () => aprobadorService.listar());
    this.guardar = accion(200, (req) => aprobadorService.guardar(req.body && typeof req.body === 'object' ? req.body : {}, req.user.id));
    // Los permisos de la sesión ya con los pasos de aprobación de esta persona (la interfaz decide el menú con ellos).
    this.yo = accion(200, (req) => ({ permisos: req.user.permissions }));
  }
}

module.exports = new AprobadorController();
