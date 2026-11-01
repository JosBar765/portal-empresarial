// src/modules/prompts/services/tipos/_utilidades.js
// Helpers puros compartidos por esquemaService, plantillaService y las definiciones de tipo.
const { msg } = require('../../mensajes');

const tiene = (objeto, clave) => Object.prototype.hasOwnProperty.call(objeto, clave);
const esObjeto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const esTextoNoVacio = valor => typeof valor === 'string' && valor.trim() !== '';
const esNumero = valor => typeof valor === 'number' && Number.isFinite(valor);

// «Etiqueta» (clave): así el mensaje nombra el parámetro como lo ve el administrador.
const nombreDe = p => (esTextoNoVacio(p.etiqueta) ? `«${p.etiqueta.trim()}» (${p.clave})` : `«${p.clave}»`);
// El asesor ve solo la etiqueta; la clave no le dice nada.
const etiquetaDe = p => (esTextoNoVacio(p.etiqueta) ? p.etiqueta.trim() : p.clave);
const verValor = valor => (valor === undefined ? 'ninguno' : JSON.stringify(valor)); // el dato recibido, tal cual, para que se vea el error

const sinControl = texto => String(texto).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const aLinea = texto => sinControl(texto).replace(/\s+/g, ' ').trim(); // un dato de usuario no puede romper la estructura del prompt

// La opción de un parámetro `opciones` cuyo `valor` es el dado (undefined si no existe).
const opcionDe = (p, valor) => (p.opciones || []).find(o => o.valor === valor);

// Resultado de validarValor cuando falta el dato: error solo si el parámetro es requerido.
const faltante = p => (p.requerido ? { error: msg('valor.obligatorio', { etiqueta: etiquetaDe(p) }) } : {});

module.exports = { tiene, esObjeto, esTextoNoVacio, esNumero, nombreDe, etiquetaDe, verValor, sinControl, aLinea, opcionDe, faltante };
