// src/core/files/fileStorage.js
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const imageOptimizer = require('./imageOptimizer');

// Directorio local de subidas
const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

// Asegurar que el directorio uploads exista
async function ensureUploadsDir() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    // Crear archivo .gitkeep si no existe
    const gitKeepPath = path.join(UPLOADS_DIR, '.gitkeep');
    try {
      await fs.access(gitKeepPath);
    } catch {
      await fs.writeFile(gitKeepPath, '');
    }
  } catch (error) {
    console.error('[FileStorage] Error creando carpeta uploads:', error);
  }
}

// Inicializar directorio
ensureUploadsDir();

class FileStorage {
  /**
   * Guarda un archivo en el sistema de almacenamiento.
   * @param {Buffer} fileBuffer Buffer del contenido del archivo
   * @param {string} originalName Nombre original del archivo
   * @param {string} mimeType Tipo MIME del archivo
   * @returns {Promise<{filename: string, path: string, size: number}>}
   */
  async saveFile(fileBuffer, originalName, mimeType) {
    const fileExt = path.extname(originalName);
    const randomName = crypto.randomBytes(16).toString('hex') + fileExt;
    const targetPath = path.join(UPLOADS_DIR, randomName);

    // analisis_correcciones_10.md #1: recompresión lossless de imágenes antes de
    // escribir a disco — único punto por el que pasan TODAS las subidas del
    // módulo (adjuntos de creación, propuestas de técnicos, fusión del
    // Encargado General), así que no hace falta tocar cada llamador. No
    // interviene con pdf-lib: sigue siendo PNG/JPEG normal, solo más liviano.
    const bufferOptimizado = await imageOptimizer.optimizar(fileBuffer, mimeType);

    // Escribir archivo al disco local
    await fs.writeFile(targetPath, bufferOptimizado);

    return {
      filename: randomName,
      path: `uploads/${randomName}`,
      size: bufferOptimizado.length
    };
  }

  /**
   * Elimina un archivo del almacenamiento.
   * @param {string} relativePath Ruta relativa almacenada
   */
  async deleteFile(relativePath) {
    // Evitar salir del directorio uploads por seguridad
    const basename = path.basename(relativePath);
    const targetPath = path.join(UPLOADS_DIR, basename);
    
    try {
      await fs.unlink(targetPath);
      return true;
    } catch (error) {
      console.error(`[FileStorage] Error al eliminar archivo ${relativePath}:`, error.message);
      return false;
    }
  }

  /**
   * Obtiene la URL pública o local para servir el archivo.
   * @param {string} relativePath Ruta relativa del archivo
   */
  getFileUrl(relativePath) {
    // Si en el futuro se migra a AWS S3 o Cloudinary, solo se cambia esta URL
    return `/${relativePath}`;
  }
}

module.exports = new FileStorage();
