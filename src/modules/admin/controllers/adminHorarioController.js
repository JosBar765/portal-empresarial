// src/modules/admin/controllers/adminHorarioController.js
const service = require('../services/horarioService');
const { responderError, responderErrorInterno } = require('../../../core/utils/erroresHttp');

class AdminHorarioController {
  async listarHorarios(req, res) {
    try {
      return res.json(await service.listarHorarios());
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async guardarHorarios(req, res) {
    try {
      return res.json(await service.guardarHorarios(req.body));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async obtenerParametros(req, res) {
    try {
      return res.json(await service.obtenerParametros());
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async guardarParametros(req, res) {
    try {
      return res.json(await service.guardarParametros(req.body));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async listarPaises(req, res) {
    try {
      return res.json(await service.listarPaises());
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async listarFeriados(req, res) {
    try {
      return res.json(await service.listarFeriados(req.query.paisId));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async crearFeriado(req, res) {
    try {
      return res.status(201).json(await service.crearFeriado(req.body));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async actualizarFeriado(req, res) {
    try {
      return res.json(await service.actualizarFeriado(req.params.id, req.body));
    } catch (error) {
      return responderError(res, error);
    }
  }

  async eliminarFeriado(req, res) {
    try {
      return res.json(await service.eliminarFeriado(req.params.id));
    } catch (error) {
      return responderError(res, error);
    }
  }
}

module.exports = new AdminHorarioController();
