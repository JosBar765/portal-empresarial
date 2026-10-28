// src/modules/vales/controllers/borradorController.js
const borradorService = require('../services/borradorService');
const { validarArchivos } = require('../../../core/files/fileSignature');
const { responderError, responderErrorInterno } = require('../../../core/utils/erroresHttp');

class BorradorController {
  async listar(req, res) {
    try {
      return res.json(await borradorService.listar(req.user));
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async obtener(req, res) {
    try {
      return res.json(await borradorService.obtener(req.user, req.params.id));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async crear(req, res) {
    try {
      const archivos = validarArchivos(req.files);
      return res.status(201).json(await borradorService.crear(req.user, req.body, archivos));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async actualizar(req, res) {
    try {
      const archivos = validarArchivos(req.files);
      return res.json(await borradorService.actualizar(req.user, req.params.id, req.body, archivos));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async eliminar(req, res) {
    try {
      return res.json(await borradorService.eliminar(req.user, req.params.id));
    } catch (error) {
      return responderError(res, error);
    }
  }
}

module.exports = new BorradorController();
