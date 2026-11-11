// src/modules/viaticos/controllers/crudController.js
// Handlers HTTP de cualquier recurso de /config con la interfaz listar/crear/editar/cambiarActivo.
const { idObligatorio } = require('../../../core/utils/validar');
const { manejar } = require('./manejar');

function crearCrud(servicio) {
  return {
    listar: manejar(() => servicio.listar()),
    crear: manejar(req => servicio.crear(req.body), { status: 201 }),
    editar: manejar(req => servicio.editar(idObligatorio(req.params.id), req.body)),
    cambiarActivo: manejar(req => servicio.cambiarActivo(idObligatorio(req.params.id), req.body))
  };
}

module.exports = { crearCrud };
