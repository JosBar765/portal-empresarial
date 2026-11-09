// src/modules/proyectos/errores.js
const { ErrorDeNegocio } = require('../../core/utils/erroresHttp');

// Error 400 con el detalle por campo: { error, campos: { clave: mensaje } }.
function errorDeValidacion(mensaje, campos) {
  const error = new ErrorDeNegocio(mensaje, 400);
  error.campos = campos;
  return error;
}

// Error 409 que lleva las empresas parecidas para que la pantalla las muestre: { error, codigo, duplicados }.
function errorDePosibleDuplicado(duplicados) {
  const error = new ErrorDeNegocio('Esta empresa se parece a una que ya está en la base.', 409);
  error.codigo = 'POSIBLE_DUPLICADO';
  error.duplicados = duplicados;
  return error;
}

// Campos extra del cuerpo de error para que la pantalla marque cada campo o muestre los duplicados.
function extraDeError(error) {
  const extra = {};
  if (error && error.campos) extra.campos = error.campos;
  if (error && error.codigo) extra.codigo = error.codigo;
  if (error && error.duplicados) extra.duplicados = error.duplicados;
  if (error && error.detalle) extra.detalle = error.detalle;
  return extra;
}

module.exports = { errorDeValidacion, errorDePosibleDuplicado, extraDeError };
