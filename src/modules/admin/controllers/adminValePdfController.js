// src/modules/admin/controllers/adminValePdfController.js
const service = require('../services/adminValePdfService');
const { validarArchivos } = require('../../../core/files/fileSignature');
const { responderError, responderErrorInterno } = require('../../../core/utils/erroresHttp');

class AdminValePdfController {
  async opciones(req, res) {
    try {
      return res.json(await service.opciones());
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async listar(req, res) {
    try {
      return res.json(await service.listar());
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async generar(req, res) {
    try {
      const body = req.body || {};
      // La contraseña se verifica antes de validar o procesar los archivos.
      await service.verificarContrasena(req.user.id, body.password);
      const archivos = validarArchivos(req.files);
      const resultado = await service.generar(req.user.id, body, archivos);
      return res.status(201).json(resultado);
    } catch (error) {
      return responderError(res, error);
    }
  }
}

module.exports = new AdminValePdfController();
