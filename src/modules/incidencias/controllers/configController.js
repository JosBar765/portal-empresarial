// src/modules/incidencias/controllers/configController.js
// HTTP de la configuración del módulo. Solo traduce la petición; las reglas viven en los servicios.
const configService = require('../services/configService');
const personalConfigService = require('../services/personalConfigService');
const rolesConfigService = require('../services/rolesConfigService');
const { responderError } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');
const { extraDeError } = require('../errores');

const comoObjeto = (valor) => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});

const accion = (estado, fn) => async (req, res) => {
  try {
    return res.status(estado).json(await fn(req));
  } catch (error) {
    return responderError(res, error, 400, extraDeError(error));
  }
};

class ConfigController {
  constructor() {
    this.estado = accion(200, () => configService.estado());
    this.historial = accion(200, req => configService.historial(comoObjeto(req.query)));

    this.paises = accion(200, () => configService.paises());
    this.actualizarPais = accion(200, req => configService.actualizarPais(req.user, idObligatorio(req.params.id), comoObjeto(req.body)));

    this.listarCatalogo = accion(200, req => configService.listarCatalogo(req.params.catalogo));
    this.crearEnCatalogo = accion(201, req => configService.crearEnCatalogo(req.user, req.params.catalogo, comoObjeto(req.body)));
    this.actualizarEnCatalogo = accion(200, req => configService.actualizarEnCatalogo(req.user, req.params.catalogo, idObligatorio(req.params.id), comoObjeto(req.body)));

    this.prioridades = accion(200, () => configService.listarPrioridades());
    this.crearPrioridad = accion(201, req => configService.crearPrioridad(req.user, comoObjeto(req.body)));
    this.actualizarPrioridad = accion(200, req => configService.actualizarPrioridad(req.user, idObligatorio(req.params.id), comoObjeto(req.body)));
    this.guardarReglas = accion(200, req => configService.guardarReglas(req.user, comoObjeto(req.body)));

    this.parametros = accion(200, () => configService.listarParametros());
    this.guardarParametros = accion(200, req => configService.guardarParametros(req.user, comoObjeto(req.body)));

    this.tecnicos = accion(200, () => personalConfigService.tecnicos());
    this.candidatos = accion(200, req => personalConfigService.candidatos(comoObjeto(req.query)));
    this.agregarTecnico = accion(201, req => personalConfigService.agregarTecnico(req.user, comoObjeto(req.body)));
    this.actualizarTecnico = accion(200, req => personalConfigService.actualizarTecnico(req.user, idObligatorio(req.params.usuarioId), comoObjeto(req.body)));

    this.verificadores = accion(200, () => personalConfigService.verificadores());
    this.agregarVerificador = accion(201, req => personalConfigService.agregarVerificador(req.user, comoObjeto(req.body)));
    this.quitarVerificador = accion(200, req => personalConfigService.quitarVerificador(req.user, idObligatorio(req.params.id)));

    this.roles = accion(200, () => rolesConfigService.listar());
    this.actualizarRol = accion(200, req => rolesConfigService.actualizar(req.user, idObligatorio(req.params.rolId), comoObjeto(req.body)));
  }
}

module.exports = new ConfigController();
