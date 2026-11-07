// src/modules/proyectos/errores.js
const { ErrorDeNegocio } = require('../../core/utils/erroresHttp');

// Error 400 con el detalle por campo: { error, campos: { clave: mensaje } }.
function errorDeValidacion(mensaje, campos) {
  const error = new ErrorDeNegocio(mensaje, 400);
  error.campos = campos;
  return error;
}

// Campos extra del cuerpo de error para que la pantalla marque cada campo.
function extraDeError(error) {
  return error && error.campos ? { campos: error.campos } : {};
}

module.exports = { errorDeValidacion, extraDeError };
