// src/modules/incidencias/errores.js
const { ErrorDeNegocio } = require('../../core/utils/erroresHttp');
const { quitarInvisibles } = require('../../core/utils/texto');

// Error 400 con el detalle por campo: { error, campos: { clave: mensaje } }.
function errorDeValidacion(mensaje, campos) {
  const error = new ErrorDeNegocio(mensaje, 400);
  error.campos = campos;
  return error;
}

// Una incidencia fuera del alcance de quien pregunta responde igual que una que no existe (no se revela cuál de las dos).
const noEncontrada = () => new ErrorDeNegocio('No encontramos esa incidencia. Puede que no exista o que no sea tuya ni de tus tiendas.', 404);
const sinPermiso = (mensaje = 'No tienes permiso para hacer esto.') => new ErrorDeNegocio(mensaje, 403);
const conflicto = (mensaje) => new ErrorDeNegocio(mensaje, 409);

function extraDeError(error) {
  const extra = {};
  if (error && error.campos) extra.campos = error.campos;
  if (error && error.codigo) extra.codigo = error.codigo;
  if (error && error.similares) extra.similares = error.similares;
  return extra;
}

// Texto de entrada: sin caracteres invisibles y sin espacios sobrantes en los extremos.
const limpio = (valor) => quitarInvisibles(valor).trim();

module.exports = { errorDeValidacion, noEncontrada, sinPermiso, conflicto, extraDeError, limpio };
