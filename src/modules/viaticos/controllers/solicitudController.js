// src/modules/viaticos/controllers/solicitudController.js
// Solicitudes del propio usuario: la identidad sale siempre de req.user.
const service = require('../services/solicitudService');
const { manejar } = require('./manejar');

module.exports = {
  catalogos: manejar(req => service.catalogosSolicitud(req.user, req.query)),
  calcular: manejar(req => service.calcular(req.user, req.body)),
  listar: manejar(req => service.listar(req.user, req.query)),
  obtener: manejar(req => service.obtener(req.user, req.params.id))
};
