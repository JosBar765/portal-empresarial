// src/modules/vales/repositories/documentoRepository.js
const db = require('../../../config/database');

class DocumentoRepository {
  async crear({ valeId, nombreOriginal, ruta, tipo, mimeType, tamano, esModificacion, subidoPor }) {
    const result = await db.query(
      'INSERT INTO vale_documentos (vale_id, nombre_original, ruta, tipo, mime_type, tamano, es_modificacion, subido_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [valeId, nombreOriginal, ruta, tipo, mimeType, tamano, esModificacion ? 1 : 0, subidoPor],
      'documento:insert'
    );
    return result.insertId;
  }

  async listarPorVale(valeId) {
    return db.query('SELECT * FROM vale_documentos WHERE vale_id = ?', [valeId], 'documento:list_by_vale');
  }
}

module.exports = new DocumentoRepository();
