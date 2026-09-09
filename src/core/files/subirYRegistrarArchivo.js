// src/core/files/subirYRegistrarArchivo.js
// Orquesta "subir un archivo a Storage + registrar sus metadatos en la base
// de datos" con consistencia estricta:
//   1. Sube a Supabase Storage. Si falla, se interrumpe de inmediato sin
//      tocar la base de datos (StorageUploadError).
//   2. Si la subida tuvo éxito, ejecuta `registrar` (el INSERT/UPDATE que
//      corresponda, decidido por quien llama — esta función no conoce nada
//      de vale_documentos/vales).
//   3. Si `registrar` falla, se elimina el archivo recién subido. Si esa
//      limpieza también falla, el archivo queda huérfano en Storage y se
//      avisa explícitamente (StorageRollbackError) en vez de perder el
//      error original en silencio. Si la limpieza sí funciona, se relanza
//      como DatabaseInsertError.
const imageOptimizer = require('./imageOptimizer');
const supabaseStorage = require('./supabaseStorage');
const { StorageUploadError, DatabaseInsertError, StorageRollbackError } = require('./errores');

/**
 * @param {Object} datos
 * @param {Buffer} datos.buffer
 * @param {string} datos.nombreOriginal
 * @param {string} datos.mimeType
 * @param {(subida: {path: string, url: string, size: number}) => Promise<any>} datos.registrar
 */
async function subirYRegistrarArchivo({ buffer, nombreOriginal, mimeType, registrar }) {
  // Único punto por el que pasan TODAS las subidas del módulo (adjuntos de
  // creación, propuestas de técnicos, fusión) — no hace falta que cada
  // llamador recuerde optimizar antes de llamar. No interviene con
  // pdf-lib: sigue siendo PNG/JPEG normal, solo más liviano; optimizar() ya
  // es un no-op seguro para cualquier otro mimetype (PDF, etc.).
  const bufferOptimizado = await imageOptimizer.optimizar(buffer, mimeType);

  let subida;
  try {
    subida = await supabaseStorage.subir(bufferOptimizado, nombreOriginal, mimeType);
  } catch (error) {
    throw new StorageUploadError(`No se pudo subir "${nombreOriginal}" a Supabase Storage: ${error.message}`);
  }

  try {
    return await registrar(subida);
  } catch (error) {
    try {
      await supabaseStorage.eliminar(subida.url);
    } catch (errorRollback) {
      throw new StorageRollbackError(
        `El archivo "${nombreOriginal}" se subió pero falló su registro en la base de datos, y ADEMÁS falló el rollback ` +
        `(queda huérfano en Storage: ${subida.url}). Error original: ${error.message}. Error de rollback: ${errorRollback.message}`
      );
    }
    throw new DatabaseInsertError(`No se pudo registrar "${nombreOriginal}" en la base de datos (se revirtió la subida a Storage): ${error.message}`);
  }
}

module.exports = subirYRegistrarArchivo;
