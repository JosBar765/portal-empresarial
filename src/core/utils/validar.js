// src/core/utils/validar.js
// Validación de entrada compartida. Validar NO es sanear: aquí solo se acepta
// o se rechaza; los datos legítimos nunca se modifican.
const { ErrorDeNegocio } = require('./erroresHttp');

// Un id que llega en el cuerpo JSON o en la URL debe ser un entero positivo (o
// su texto): Number() a secas aceptaría [5], true o " 5 " como 5, y deja pasar
// NaN/Infinity hasta el SQL. Devuelve el entero o null.
function aEntero(valor) {
  if (typeof valor === 'number') return Number.isInteger(valor) && valor > 0 ? valor : null;
  if (typeof valor === 'string' && /^\d{1,10}$/.test(valor.trim())) return Number(valor.trim());
  return null;
}

// Id obligatorio (p. ej. req.params.id): lanza un error de negocio 400.
function idObligatorio(valor, etiqueta = 'Identificador') {
  const id = aEntero(valor);
  if (id === null) throw new ErrorDeNegocio(`${etiqueta} inválido.`, 400);
  return id;
}

// Id opcional (p. ej. un campo del body que puede venir vacío): null si no vino.
function idOpcional(valor, etiqueta = 'Identificador') {
  if (valor === undefined || valor === null || valor === '') return null;
  return idObligatorio(valor, etiqueta);
}

const MAX_DIGITOS_TELEFONO = 8;

// Teléfono "+código número": el número (sin el código de país) admite hasta 8 dígitos.
function validarTelefono(valor, etiqueta = 'El teléfono') {
  if (!valor) return;
  const numero = String(valor).trim().replace(/^\+\d{1,4}\s+/, '');
  if (numero.replace(/\D/g, '').length > MAX_DIGITOS_TELEFONO) {
    throw new ErrorDeNegocio(`${etiqueta} no puede tener más de ${MAX_DIGITOS_TELEFONO} números.`, 400);
  }
}

module.exports = { aEntero, idObligatorio, idOpcional, validarTelefono };
