// src/core/utils/texto.js
// Limpieza de texto de entrada (a diferencia de validar.js, aquí SÍ se modifica el texto).

// Caracteres que no se ven: controles (menos tabulación y saltos de línea), de formato (espacio de ancho cero, word joiner,
// BOM, marcas de dirección, guion blando…) y los rellenos en blanco que algunos textos copiados traen.
const INVISIBLES = /(?![\t\n\r])[\p{Cc}\p{Cf}\u115F\u1160\u2800\u3164\uFFA0]/gu;

// Quita los caracteres invisibles de un texto pegado; los espacios raros (sin cortes, finos, ideográficos) pasan a un espacio
// normal y los separadores de línea y de párrafo, a un salto de línea. El resto del texto no se toca.
function quitarInvisibles(texto) {
  return String(texto ?? '')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/\p{Zs}/gu, ' ')
    .replace(INVISIBLES, '');
}

module.exports = { quitarInvisibles };
