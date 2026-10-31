// src/modules/prompts/services/tipos/index.js
// Registro de tipos de parámetro. Para agregar un tipo: crear su archivo (contrato en _base.js) y sumar UNA línea a DEFINICIONES.
// El orden de la lista es el que ven los mensajes («Elige uno de estos: ...»).
const { definirTipo } = require('./_base');

const DEFINICIONES = [
  require('./texto'),
  require('./textoLargo'),
  require('./numero'),
  require('./opciones'),
  require('./siNo'),
  require('./imagenes'),
  require('./calculado')
];

const TIPOS = Object.freeze(Object.fromEntries(DEFINICIONES.map(d => [d.clave, d])));
const TIPO_DESCONOCIDO = definirTipo({ clave: null }); // un tipo fuera del registro: sin validación propia, sin valor y sin texto

/** @returns {object|undefined} la definición de la clave, o undefined si no está registrada */
const obtenerTipo = clave => (typeof clave === 'string' && Object.prototype.hasOwnProperty.call(TIPOS, clave) ? TIPOS[clave] : undefined);

const clavesDeTipos = () => Object.keys(TIPOS);

/** La definición del tipo de un parámetro; nunca undefined (los tipos desconocidos los reporta validarEsquema). */
const tipoDe = p => (p && obtenerTipo(p.tipo)) || TIPO_DESCONOCIDO;

module.exports = { TIPOS, obtenerTipo, clavesDeTipos, tipoDe };
