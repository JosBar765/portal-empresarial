// src/modules/viaticos/controllers/reporteController.js
// Reportes de inversión y reparto de viáticos; el permiso viaticos.reportes se exige en routes.js.
const { responderError } = require('../../../core/utils/erroresHttp');
const service = require('../services/reporteService');
const { extraDeError } = require('../errores');
const { manejar } = require('./manejar');

async function pdf(req, res) {
  try {
    const { buffer, nombreArchivo } = await service.generarPdf(req.query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);
    return res.status(200).send(buffer);
  } catch (error) {
    return responderError(res, error, 400, extraDeError(error));
  }
}

module.exports = {
  opciones: manejar(req => service.opciones(req.query)),
  obtener: manejar(req => service.generar(req.query)),
  pdf
};
