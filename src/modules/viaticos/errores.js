// src/modules/viaticos/errores.js
const { ErrorDeNegocio } = require('../../core/utils/erroresHttp');

// Error 400 con el detalle por campo: { error, campos: { clave: mensaje } }.
function errorDeValidacion(mensaje, campos) {
  const error = new ErrorDeNegocio(mensaje, 400);
  error.campos = campos;
  return error;
}

// Campos extra del cuerpo de error (detalle de validación).
function extraDeError(error) {
  return error && error.campos ? { campos: error.campos } : {};
}

// Violación de una clave única de MySQL.
function esDuplicado(error) {
  return Boolean(error) && error.code === 'ER_DUP_ENTRY';
}

module.exports = { errorDeValidacion, extraDeError, esDuplicado };
