// src/modules/prompts/controllers/adminProductoController.js
const service = require('../services/adminProductoService');
const { responderError, responderErrorInterno } = require('../../../core/utils/erroresHttp');
const { extraDeError } = require('../errores');

class AdminProductoController {
  async listar(req, res) {
    try {
      return res.json(await service.listar());
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async crear(req, res) {
    try {
      return res.status(201).json(await service.crear(req.body, req.user.id));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async duplicar(req, res) {
    try {
      return res.status(201).json(await service.duplicar(req.params.id, req.body, req.user.id));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async obtener(req, res) {
    try {
      return res.json(await service.obtener(req.params.id));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async crearBorrador(req, res) {
    try {
      return res.status(201).json(await service.crearBorrador(req.params.id, req.user.id));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async guardarBorrador(req, res) {
    try {
      return res.json(await service.guardarBorrador(req.params.id, req.body));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async descartarBorrador(req, res) {
    try {
      return res.json(await service.descartarBorrador(req.params.id));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async publicar(req, res) {
    try {
      return res.json(await service.publicar(req.params.id));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async cambiarEstado(req, res) {
    try {
      return res.json(await service.cambiarEstado(req.params.id, (req.body || {}).estado));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async previsualizar(req, res) {
    try {
      return res.json(await service.previsualizar(req.body));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }
}

module.exports = new AdminProductoController();
