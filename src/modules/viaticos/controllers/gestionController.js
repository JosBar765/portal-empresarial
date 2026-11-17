// src/modules/viaticos/controllers/gestionController.js
// Gestiones: ven y deciden las solicitudes de cualquier persona; los permisos se exigen en routes.js.
const service = require('../services/gestionService');
const documentos = require('../services/documentoService');
const liquidacion = require('../services/liquidacionService');
const vistos = require('../services/vistoService');
const { manejar } = require('./manejar');

module.exports = {
  listar: manejar(req => service.listar(req.user, req.query)),
  obtener: manejar(req => service.obtener(req.user, req.params.id)),
  documentos: manejar(req => documentos.listarDeGestion(req.params.id)),
  visto: manejar(req => vistos.marcarVisto(req.user, req.params.id)),
  autorizar: manejar(req => service.autorizar(req.user, req.params.id)),
  rechazar: manejar(req => service.rechazar(req.user, req.params.id, req.body)),
  liquidacion: manejar(req => liquidacion.obtenerDeGestion(req.params.id))
};
