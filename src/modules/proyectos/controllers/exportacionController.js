// src/modules/proyectos/controllers/exportacionController.js
// HTTP de las exportaciones a CSV. Solo traduce la petición; las reglas viven en exportacionService.
const exportacionService = require('../services/exportacionService');
const { responderError } = require('../../../core/utils/erroresHttp');
const { extraDeError } = require('../errores');

const descargar = (fn) => async (req, res) => {
  try {
    const { nombre, contenido, truncado } = await fn(req);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Cache-Control', 'no-store');
    if (truncado) res.setHeader('X-Exportacion-Truncada', '1');
    return res.send(contenido);
  } catch (error) {
    return responderError(res, error, 400, extraDeError(error));
  }
};

class ExportacionController {
  constructor() {
    this.cartera = descargar(req => exportacionService.cartera(req.user, req.query));
    this.ganados = descargar(req => exportacionService.ganados(req.user, req.query));
    this.resultados = descargar(req => exportacionService.resultados(req.user, req.params.id));
    this.informe = descargar(req => exportacionService.informe(req.user, req.params.id, req.query.tabla));
  }
}

module.exports = new ExportacionController();
