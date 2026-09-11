// src/core/files/fileSignature.js
// Verifica el tipo REAL de un archivo por sus primeros bytes (magic
// number/firma) en vez de confiar solo en el Content-Type que el propio
// cliente declara en el multipart — un .svg/.html renombrado con
// Content-Type: image/png pasaría cualquier validación que solo mire el
// mimetype declarado, y terminaría servido bajo esa extensión en el bucket
// público de Supabase (XSS almacenado). Cubre únicamente los tipos que este
// proyecto realmente acepta (vale_documentos.tipo/`validarArchivos` en
// valeController.js) — cualquier otro tipo se rechaza sin excepción.
const FIRMAS = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  // WEBP es un contenedor RIFF — 'RIFF' en los primeros 4 bytes y 'WEBP' en
  // los bytes 8-11 (entre medio va el tamaño del archivo, irrelevante aquí).
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]] // '%PDF'
};

const EXTENSION_POR_TIPO = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};

function coincideFirma(buffer, firma) {
  if (buffer.length < firma.length) return false;
  return firma.every((byte, i) => buffer[i] === byte);
}

// `mimetypeDeclarado` es el que manda el cliente en el multipart — se usa
// solo para saber CONTRA QUÉ firma comparar, nunca se confía en él por sí
// solo. Devuelve false tanto si el tipo declarado no es uno de los
// permitidos como si los bytes reales no coinciden con esa firma.
function tipoRealCoincide(buffer, mimetypeDeclarado) {
  const normalizado = mimetypeDeclarado === 'image/jpg' ? 'image/jpeg' : mimetypeDeclarado;
  const firmas = FIRMAS[normalizado];
  if (!firmas || !buffer || !buffer.length) return false;
  if (!firmas.some(f => coincideFirma(buffer, f))) return false;
  if (normalizado === 'image/webp') {
    return buffer.length >= 12 && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  }
  return true;
}

// La extensión física del archivo en Storage se deriva del tipo YA
// VERIFICADO por tipoRealCoincide, nunca del nombre que mandó el usuario
// (path.extname(nombreOriginal) es 100% controlado por quien sube el archivo).
function extensionParaTipo(mimetypeDeclarado) {
  return EXTENSION_POR_TIPO[mimetypeDeclarado] || '';
}

module.exports = { tipoRealCoincide, extensionParaTipo };
