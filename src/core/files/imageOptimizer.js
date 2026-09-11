// src/core/files/imageOptimizer.js
// Recomprime imágenes SIN afectar pdf-lib (que sigue recibiendo PNG/JPEG
// normales vía embedPng/embedJpg, sin cambios) ni requerir infraestructura
// nueva — el hosting destino es un host Node administrado (sin Docker/root,
// ver CLAUDE.md), así que `sharp` (módulo
// nativo) se carga de forma TOLERANTE: si el binario no está disponible ahí,
// esto no debe romper el deploy ni la subida de archivos, solo dejar de
// optimizar.
let sharp = null;
try {
  sharp = require('sharp');
} catch {
  sharp = null; // sin sharp disponible: optimizar() se vuelve un no-op seguro
}

/**
 * Recomprime una imagen antes de guardarla en disco.
 * - PNG: recompresión estrictamente LOSSLESS (mismos píxeles, mejor filtro/deflate).
 * - JPEG: re-codificado sin submuestreo de croma y calidad máxima — el techo de
 *   "sin pérdida visible" que ofrece un JPEG (un JPEG re-codificado nunca es
 *   lossless bit a bit, a diferencia del PNG).
 * - Cualquier otro mimetype (PDF, webp, etc.): se devuelve intacto.
 * Ante cualquier error, o si el resultado no queda más liviano que el
 * original, se conserva el buffer original — nunca debe romper una subida.
 */
// Techo explícito de píxeles de entrada — sin esto, una imagen con
// dimensiones declaradas enormes (aunque el archivo comprimido sea
// pequeño, "decompression bomb") podría consumir CPU/memoria del proceso
// al decodificarla. 40 megapíxeles es muy por encima de cualquier foto de
// trofeo real (una foto de 8000x5000 ya son 40MP).
const LIMITE_PIXELES = 40_000_000;

async function optimizar(buffer, mimetype) {
  if (!sharp) return buffer;
  try {
    let optimizado;
    if (mimetype === 'image/png') {
      optimizado = await sharp(buffer, { limitInputPixels: LIMITE_PIXELES }).png({ compressionLevel: 9, effort: 10 }).toBuffer();
    } else if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
      optimizado = await sharp(buffer, { limitInputPixels: LIMITE_PIXELES }).jpeg({ mozjpeg: true, quality: 100, chromaSubsampling: '4:4:4' }).toBuffer();
    } else {
      return buffer;
    }
    return optimizado.length < buffer.length ? optimizado : buffer;
  } catch (error) {
    console.warn('[ImageOptimizer] No se pudo optimizar la imagen, se conserva el original:', error.message);
    return buffer;
  }
}

module.exports = { optimizar };
