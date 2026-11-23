// src/modules/proyectos/controllers/configController.js
// HTTP de los ajustes del módulo (parámetros, reglas y país). Solo quien tiene proyectos.administrar llega aquí.
const configService = require('../services/configService');
const historialService = require('../services/historialService');
const resumenService = require('../services/resumenService');
const { responderError } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');
const { extraDeError } = require('../errores');

const comoObjeto = valor => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {});

class ConfigController {
  // Parámetros (A3) y reglas (A5) usan el mismo servicio; `pantalla` decide qué ajustes se ven y se pueden editar.
  listar(pantalla) {
    return async (req, res) => {
      try {
        return res.json({ grupos: await configService.describir(pantalla) });
      } catch (error) {
        return responderError(res, error, 500);
      }
    };
  }

  guardar(pantalla) {
    return async (req, res) => {
      try {
        const modificados = await configService.guardar(comoObjeto(req.body && req.body.cambios), req.user.id, pantalla);
        return res.json({ modificados, grupos: await configService.describir(pantalla) });
      } catch (error) {
        return responderError(res, error, 400, extraDeError(error));
      }
    };
  }

  async restaurar(req, res) {
    try {
      const valor = await configService.restaurar(req.params.clave, req.user.id);
      return res.json({ clave: req.params.clave, valor });
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async resumen(req, res) {
    try {
      return res.json(await resumenService.obtener());
    } catch (error) {
      return responderError(res, error, 500);
    }
  }

  async historial(req, res) {
    try {
      return res.json(await historialService.listar(req.query));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async restaurarCambio(req, res) {
    try {
      return res.json(await historialService.restaurar(idObligatorio(req.params.id, 'El cambio'), req.user.id));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }

  async listarPaises(req, res) {
    try {
      return res.json({ paises: await configService.paises() });
    } catch (error) {
      return responderError(res, error, 500);
    }
  }

  async guardarPais(req, res) {
    try {
      const paisId = idObligatorio(req.params.id, 'El país');
      const cambiado = await configService.guardarPais(paisId, comoObjeto(req.body), req.user.id);
      return res.json({ cambiado, pais: await configService.pais(paisId) });
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  }
}

module.exports = new ConfigController();
