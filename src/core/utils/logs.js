// src/core/utils/logs.js
// Todo dato que viene del cliente (correo de un intento de login, nombres de
// sala…) se sanea antes de escribirse en el registro: sin saltos de línea ni
// caracteres de control (un correo con "\n[Auth] login exitoso…" fabricaría
// líneas falsas) y con largo acotado.
function esControl(codigo) {
  return codigo < 32 || (codigo >= 127 && codigo <= 159) || codigo === 0x2028 || codigo === 0x2029;
}

function paraLog(valor, max = 80) {
  const original = String(valor === undefined || valor === null ? '' : valor);
  let texto = '';
  for (const caracter of original) {
    texto += esControl(caracter.codePointAt(0)) ? ' ' : caracter;
  }
  texto = texto.replace(/ {2,}/g, ' ').trim();
  return texto.length > max ? `${texto.slice(0, max)}…` : texto;
}

module.exports = { paraLog };
