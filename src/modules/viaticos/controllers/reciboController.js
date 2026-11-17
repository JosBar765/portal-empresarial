// src/modules/viaticos/controllers/reciboController.js
// Recibos firmados de la liquidación del propio solicitante: la identidad sale siempre de req.user.
const service = require('../services/reciboService');
const { manejar } = require('./manejar');

module.exports = {
  letras: manejar(req => service.letras(req.user, req.params.id, req.body)),
  // Multer deja la firma (PNG) en req.file y el JSON del recibo en req.body.datos.
  agregar: manejar(req => service.agregar(req.user, req.params.id, req.body, req.file || null), { status: 201 }),
  quitar: manejar(req => service.quitar(req.user, req.params.id, req.params.reciboId))
};
