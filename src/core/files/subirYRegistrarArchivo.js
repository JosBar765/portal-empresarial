// src/core/files/subirYRegistrarArchivo.js
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
