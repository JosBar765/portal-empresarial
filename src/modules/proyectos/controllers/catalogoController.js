// src/modules/proyectos/controllers/catalogoController.js
// HTTP de los catálogos del módulo. Solo quien tiene proyectos.administrar llega aquí.
const catalogoService = require('../services/catalogoService');
const { responderError } = require('../../../core/utils/erroresHttp');
const { extraDeError } = require('../errores');

const comoObjeto = valor => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});

class CatalogoController {
  async listar(req, res) {
    try {
      return res.json({ items: await catalogoService.listar(req.params.catalogo) });
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async crear(req, res) {
    try {
      return res.status(201).json({ item: await catalogoService.crear(req.params.catalogo, comoObjeto(req.body), req.user.id) });
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async editar(req, res) {
    try {
      return res.json({ item: await catalogoService.editar(req.params.catalogo, req.params.id, comoObjeto(req.body), req.user.id) });
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async cambiarActivo(req, res) {
    try {
      const item = await catalogoService.cambiarActivo(req.params.catalogo, req.params.id, comoObjeto(req.body).activo, req.user.id);
      return res.json({ item });
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }
}

module.exports = new CatalogoController();
