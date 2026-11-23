// src/modules/tiempos/errores.js
const { ErrorDeNegocio } = require('../../core/utils/erroresHttp');

// Error 400 con el detalle por campo: { error, campos: { clave: mensaje } }.
function errorDeValidacion(mensaje, campos) {
  const error = new ErrorDeNegocio(mensaje, 400);
  error.campos = campos;
  return error;
}

const sinTabla = () => new ErrorDeNegocio('Todavía no hay una tabla de tiempos publicada. Pide al administrador que publique la primera versión.', 409);

module.exports = { errorDeValidacion, sinTabla };
