// src/modules/viaticos/controllers/liquidacionController.js
// Liquidación del propio solicitante: la identidad sale siempre de req.user.
const service = require('../services/liquidacionService');
const { manejar } = require('./manejar');

module.exports = {
  obtener: manejar(req => service.obtener(req.user, req.params.id)),
  // Multer deja el comprobante en req.file; sin multipart no hay archivo.
  agregarComprobante: manejar(req => service.agregarComprobante(req.user, req.params.id, req.body, req.file || null), { status: 201 }),
  quitarComprobante: manejar(req => service.quitarComprobante(req.user, req.params.id, req.params.comprobanteId)),
  liquidar: manejar(req => service.liquidar(req.user, req.params.id))
};
