// src/modules/prompts/errores.js
const { ErrorDeNegocio } = require('../../core/utils/erroresHttp');

// Error 400 con el detalle por campo: { error, campos: { clave: mensaje } }.
function errorDeValidacion(mensaje, campos) {
  const error = new ErrorDeNegocio(mensaje, 400);
  error.campos = campos;
  return error;
}

// Campos extra del cuerpo de error (campos de validación y código estable).
function extraDeError(error) {
  const extra = {};
  if (error && error.campos) extra.campos = error.campos;
  if (error && error.codigo) extra.codigo = error.codigo;
  return extra;
}

module.exports = { errorDeValidacion, extraDeError };
