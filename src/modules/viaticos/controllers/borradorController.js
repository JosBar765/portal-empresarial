// src/modules/viaticos/controllers/borradorController.js
// Borradores del propio usuario: la identidad sale siempre de req.user.
const service = require('../services/borradorService');
const { manejar } = require('./manejar');

module.exports = {
  listar: manejar(req => service.listar(req.user)),
  obtener: manejar(req => service.obtener(req.user, req.params.id)),
  crear: manejar(req => service.crear(req.user, req.body), { status: 201 }),
  actualizar: manejar(req => service.actualizar(req.user, req.params.id, req.body)),
  eliminar: manejar(req => service.eliminar(req.user, req.params.id))
};
