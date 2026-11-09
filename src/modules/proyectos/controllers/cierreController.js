// src/modules/proyectos/controllers/cierreController.js
// HTTP del informe, el cierre, el visto bueno y el panel gerencial. Solo traduce la petición; las reglas viven en los servicios.
const informeService = require('../services/informeService');
const informePdfService = require('../services/informePdfService');
const cierreService = require('../services/cierreService');
const gerenciaService = require('../services/gerenciaService');
const { responderError } = require('../../../core/utils/erroresHttp');
const { extraDeError } = require('../errores');

const comoObjeto = valor => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});

const accion = (estado, fn) => async (req, res) => {
  try {
    return res.status(estado).json(await fn(req));
  } catch (error) {
    return responderError(res, error, 400, extraDeError(error));
  }
};

class CierreController {
  constructor() {
    this.informe = accion(200, req => informeService.obtener(req.user, req.params.id));
    this.cerrar = accion(200, req => cierreService.cerrar(req.user, req.params.id, comoObjeto(req.body)));
    this.vistoBueno = accion(200, req => cierreService.darVistoBueno(req.user, req.params.id, comoObjeto(req.body)));
    this.devolver = accion(200, req => cierreService.devolver(req.user, req.params.id, comoObjeto(req.body)));
    this.reenviar = accion(200, req => cierreService.reenviar(req.user, req.params.id, comoObjeto(req.body)));
    this.panel = accion(200, req => gerenciaService.panel(req.user, req.query));
    this.porDarVistoBueno = accion(200, req => gerenciaService.porDarVistoBueno(req.user));
  }

  async pdf(req, res) {
    try {
      const { bytes, nombre } = await informePdfService.generar(req.user, req.params.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(Buffer.from(bytes));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }
}

module.exports = new CierreController();
