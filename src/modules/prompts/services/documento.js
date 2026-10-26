// src/modules/prompts/services/documento.js
// mysql2 devuelve JSON como objeto y MariaDB (LONGTEXT) como texto: se acepta ambos.
function leerJson(valor) {
  return typeof valor === 'string' ? JSON.parse(valor) : valor;
}

module.exports = { leerJson };
