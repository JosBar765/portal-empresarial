// src/core/files/imagenDimensiones.js
// Lee el ancho y el alto DECLARADOS en la cabecera de una imagen (PNG, JPEG,
// WEBP) sin decodificar ningún píxel. Sirve para rechazar ANTES de guardarla
// una imagen "bomba de descompresión": un PNG de unos cientos de bytes puede
// declarar miles de megapíxeles y, al decodificarlo (sharp o pdf-lib al
// generar el PDF), agotar la memoria del proceso. Es independiente de `sharp`,
// que en el hosting puede no estar disponible.
const MAX_PIXELES = 40_000_000; // una foto de 8000 x 5000 ya son 40 MP

function dimensionesPng(b) {
  // firma(8) + longitud(4) + 'IHDR'(4) → ancho y alto en los bytes 16-23
  if (b.length < 24 || b.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
}

function dimensionesJpeg(b) {
  // Recorre los segmentos hasta un marcador SOF (Start Of Frame).
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xFF) { i++; continue; }
    const marcador = b[i + 1];
    if (marcador === 0xFF) { i++; continue; }          // relleno
    if (marcador === 0xD8 || (marcador >= 0xD0 && marcador <= 0xD7) || marcador === 0x01) { i += 2; continue; }
    const esSof = marcador >= 0xC0 && marcador <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marcador);
    if (esSof) return { alto: b.readUInt16BE(i + 5), ancho: b.readUInt16BE(i + 7) };
    const largo = b.readUInt16BE(i + 2);
    if (largo < 2) return null;
    i += 2 + largo;
  }
  return null;
}

function dimensionesWebp(b) {
  if (b.length < 30) return null;
  const tipo = b.toString('ascii', 12, 16);
  if (tipo === 'VP8 ') return { ancho: b.readUInt16LE(26) & 0x3FFF, alto: b.readUInt16LE(28) & 0x3FFF };
  if (tipo === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { ancho: (bits & 0x3FFF) + 1, alto: ((bits >> 14) & 0x3FFF) + 1 };
  }
  if (tipo === 'VP8X') return { ancho: 1 + b.readUIntLE(24, 3), alto: 1 + b.readUIntLE(27, 3) };
  return null;
}

/**
 * @param {Buffer} buffer
 * @param {string} mimetype tipo ya verificado por magic bytes (fileSignature)
 * @returns {{ancho: number, alto: number}|null} null si no se pudo leer
 */
function dimensionesDeImagen(buffer, mimetype) {
  try {
    if (mimetype === 'image/png') return dimensionesPng(buffer);
    if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') return dimensionesJpeg(buffer);
    if (mimetype === 'image/webp') return dimensionesWebp(buffer);
  } catch {
    return null;
  }
  return null;
}

/** true si la imagen declara más píxeles que el tope, o si no se pueden leer sus dimensiones. */
function excedeElLimiteDePixeles(buffer, mimetype) {
  const dim = dimensionesDeImagen(buffer, mimetype);
  if (!dim || !dim.ancho || !dim.alto) return true;
  return dim.ancho * dim.alto > MAX_PIXELES;
}

module.exports = { MAX_PIXELES, dimensionesDeImagen, excedeElLimiteDePixeles };
