// src/modules/viaticos/controllers/manejar.js
// Envuelve una acción del servicio en un handler HTTP: respuesta JSON o error por responderError.
const { responderError } = require('../../../core/utils/erroresHttp');
const { extraDeError } = require('../errores');

function manejar(accion, { status = 200 } = {}) {
  return async (req, res) => {
    try {
      return res.status(status).json(await accion(req));
    } catch (error) {
      return responderError(res, error, 400, extraDeError(error));
    }
  };
}

module.exports = { manejar };
