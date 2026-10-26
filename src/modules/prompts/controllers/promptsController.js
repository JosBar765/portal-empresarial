// src/modules/prompts/controllers/promptsController.js
const service = require('../services/promptsService');
const recursoService = require('../services/recursoService');
const { responderError, responderErrorInterno } = require('../../../core/utils/erroresHttp');
const { extraDeError } = require('../errores');

class PromptsController {
  async listarProductos(req, res) {
    try {
      return res.json(await service.listarProductos());
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async obtenerConfig(req, res) {
    try {
      return res.json(await service.obtenerConfig());
    } catch (error) {
      return responderError(res, error, 500, extraDeError(error));
    }
  }

  // Imagen fija del producto: redirige si es local, y si no la sirve desde el almacenamiento permitido.
  async obtenerRecurso(req, res) {
    try {
      const recurso = await recursoService.obtener(req.params.productoId, req.params.clave);
      if (recurso.redirigir) return res.redirect(302, recurso.redirigir);
      res.set({
        'Content-Type': recurso.contentType,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" // un SVG no ejecuta scripts
      });
      return res.send(recurso.cuerpo);
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async obtenerContacto(req, res) {
    try {
      return res.json(await service.obtenerContacto(req.user.id));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async generar(req, res) {
    try {
      return res.json(await service.generar(req.user.id, req.body));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }
}

module.exports = new PromptsController();
