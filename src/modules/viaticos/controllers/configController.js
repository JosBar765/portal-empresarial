// src/modules/viaticos/controllers/configController.js
// Recursos de /config con forma propia (los demás usan crudController).
const { idObligatorio } = require('../../../core/utils/validar');
const referencias = require('../repositories/referenciaRepository');
const valorComidaService = require('../services/valorComidaService');
const reglaLicenciaService = require('../services/reglaLicenciaService');
const personaService = require('../services/personaService');
const ajusteService = require('../services/ajusteService');
const { manejar } = require('./manejar');

// La clave compuesta de una regla viaja en la URL: /:paisId/:tipoLicenciaId/:tipoPlacaId.
function claveDeRegla(params) {
  return {
    paisId: idObligatorio(params.paisId, 'El país'),
    tipoLicenciaId: idObligatorio(params.tipoLicenciaId, 'El tipo de licencia'),
    tipoPlacaId: idObligatorio(params.tipoPlacaId, 'El tipo de placa')
  };
}

module.exports = {
  listarPaises: manejar(() => referencias.listarPaises()),
  listarCombustibles: manejar(() => referencias.listarCombustibles()),

  obtenerValoresComida: manejar(() => valorComidaService.obtener()),
  guardarValoresComida: manejar(req => valorComidaService.guardar(req.body)),

  listarReglas: manejar(() => reglaLicenciaService.listar()),
  crearRegla: manejar(req => reglaLicenciaService.crear(req.body), { status: 201 }),
  editarRegla: manejar(req => reglaLicenciaService.editar(claveDeRegla(req.params), req.body)),
  eliminarRegla: manejar(req => reglaLicenciaService.eliminar(claveDeRegla(req.params))),

  listarPersonas: manejar(() => personaService.listar()),
  guardarPersona: manejar(req => personaService.guardar(idObligatorio(req.params.usuarioId, 'El usuario'), req.body)),

  listarAjustes: manejar(() => ajusteService.listar()),
  guardarAjuste: manejar(req => ajusteService.guardar(req.params.clave, req.body))
};
