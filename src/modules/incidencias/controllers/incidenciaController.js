// src/modules/incidencias/controllers/incidenciaController.js
// HTTP de Incidencias. Solo traduce la petición; las reglas viven en los servicios. La identidad sale siempre de `req.user`.
const incidenciaService = require('../services/incidenciaService');
const flujoService = require('../services/flujoService');
const { responderError } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');
const { extraDeError } = require('../errores');

const comoObjeto = (valor) => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});
const claveDe = (req) => ({ idempotencyKey: comoObjeto(req.body).idempotencyKey || req.get('Idempotency-Key') });

const accion = (estado, fn) => async (req, res) => {
  try {
    return res.status(estado).json(await fn(req));
  } catch (error) {
    return responderError(res, error, 400, extraDeError(error));
  }
};

class IncidenciaController {
  constructor() {
    this.formulario = accion(200, req => incidenciaService.formulario(req.user));
    this.similares = accion(200, req => incidenciaService.similares(comoObjeto(req.query)));
    this.atencion = accion(200, req => incidenciaService.atencion(comoObjeto(req.query)));
    this.crear = accion(201, req => incidenciaService.crear(req.user, comoObjeto(req.body), req.files, claveDe(req)));
    this.listar = accion(200, req => incidenciaService.listar(req.user, comoObjeto(req.query)));
    this.resumen = accion(200, req => incidenciaService.resumen(req.user));
    this.detalle = accion(200, req => incidenciaService.detalle(req.user, idObligatorio(req.params.id)));

    this.tomar = accion(200, req => flujoService.tomar(req.user, idObligatorio(req.params.id)));
    this.avance = accion(201, req => flujoService.avance(req.user, idObligatorio(req.params.id), comoObjeto(req.body), req.files, claveDe(req)));
    this.espera = accion(200, req => flujoService.ponerEnEspera(req.user, idObligatorio(req.params.id), comoObjeto(req.body)));
    this.reanudar = accion(200, req => flujoService.reanudar(req.user, idObligatorio(req.params.id)));
    this.verificacion = accion(200, req => flujoService.enviarVerificacion(req.user, idObligatorio(req.params.id), comoObjeto(req.body), req.files, claveDe(req)));
    this.devolver = accion(200, req => flujoService.devolver(req.user, idObligatorio(req.params.id), comoObjeto(req.body)));
    this.aprobar = accion(200, req => flujoService.aprobar(req.user, idObligatorio(req.params.id), comoObjeto(req.body)));
    this.correccion = accion(200, req => flujoService.pedirCorreccion(req.user, idObligatorio(req.params.id), comoObjeto(req.body), req.files));
    this.reasignar = accion(200, req => flujoService.reasignar(req.user, idObligatorio(req.params.id), comoObjeto(req.body)));
    this.descartar = accion(200, req => flujoService.descartar(req.user, idObligatorio(req.params.id), comoObjeto(req.body)));
    this.prioridad = accion(200, req => flujoService.cambiarPrioridad(req.user, idObligatorio(req.params.id), comoObjeto(req.body)));
    this.comentar = accion(201, req => flujoService.comentar(req.user, idObligatorio(req.params.id), comoObjeto(req.body), claveDe(req)));
  }
}

module.exports = new IncidenciaController();
