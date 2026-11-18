// src/modules/viaticos/controllers/historialController.js
// Historial de movimientos de una solicitud; los permisos (viaticos.gestionar y viaticos.ver_historial) se exigen en routes.js.
const service = require('../services/historialService');
const { manejar } = require('./manejar');

module.exports = {
  listar: manejar(req => service.listar(req.params.id))
};
