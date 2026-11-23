// src/modules/tiempos/controllers/tiemposController.js
// HTTP de la Calculadora de Tiempos: solo recibe, delega en el servicio y responde.
const tablaService = require('../services/tablaService');
const { responderError } = require('../../../core/utils/erroresHttp');

function extraDeError(error) { return error && error.campos ? { campos: error.campos } : {}; }

class TiemposController {
  async tabla(req, res) {
    try { return res.json(await tablaService.catalogo()); } catch (error) { return responderError(res, error, 400, extraDeError(error)); }
  }

  async festivos(req, res) {
    try { return res.json({ festivos: await tablaService.festivosEntre(String(req.query.desde || ''), String(req.query.hasta || '')) }); } catch (error) { return responderError(res, error, 400, extraDeError(error)); }
  }

  async calcular(req, res) {
    try { return res.json(await tablaService.calcular(req.body)); } catch (error) { return responderError(res, error, 400, extraDeError(error)); }
  }
}

module.exports = new TiemposController();
