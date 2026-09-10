// src/modules/vales/repositories/documentoRepository.js
const db = require('../../../config/database');

// `tipo` vive en el catálogo `tipos_documento` (ver
// analisis_correcciones_24.md #5) — se alias de vuelta a `tipo` para que el
// resto del código no note el cambio.
const SELECT_DOCUMENTO = `
  SELECT vd.*, td.nombre AS tipo
  FROM vale_documentos vd
  LEFT JOIN tipos_documento td ON td.id = vd.tipo_id
`;

class DocumentoRepository {
  async crear({ valeId, nombreOriginal, ruta, tipo, mimeType, tamano, esModificacion, subidoPor }) {
    const result = await db.query(
      `INSERT INTO vale_documentos (vale_id, nombre_original, ruta, tipo_id, mime_type, tamano, es_modificacion, subido_por)
       VALUES (?, ?, ?, (SELECT id FROM tipos_documento WHERE nombre = ?), ?, ?, ?, ?)`,
      [valeId, nombreOriginal, ruta, tipo, mimeType, tamano, esModificacion ? 1 : 0, subidoPor],
      'documento:insert'
    );
    return result.insertId;
  }

  async listarPorVale(valeId) {
    return db.query(`${SELECT_DOCUMENTO} WHERE vd.vale_id = ?`, [valeId], 'documento:list_by_vale');
  }

  async eliminar(id) {
    await db.query('DELETE FROM vale_documentos WHERE id = ?', [id], 'documento:delete');
  }
}

module.exports = new DocumentoRepository();
