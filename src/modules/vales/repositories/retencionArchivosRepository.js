// src/modules/vales/repositories/retencionArchivosRepository.js
const db = require('../../../config/database');

class RetencionArchivosRepository {
  async obtenerParametro(clave) {
    const rows = await db.query('SELECT valor FROM parametros_sistema WHERE clave = ?', [clave], 'retencion:parametro');
    return rows[0] ? rows[0].valor : null;
  }

  // Vales confirmados hace más de `dias` días cuyo PDF y adjuntos siguen sin purgar.
  async listarConArchivosVencidos(dias, limite) {
    return db.query(
      `SELECT id, pdf_url FROM vales
       WHERE confirmado_en IS NOT NULL AND archivos_purgados_en IS NULL
         AND confirmado_en <= NOW() - INTERVAL ? DAY
       ORDER BY confirmado_en ASC LIMIT ?`,
      [dias, limite], 'retencion:listar_archivos'
    );
  }

  // Vales confirmados hace más de `dias` días cuyas propuestas siguen sin purgar.
  async listarConPropuestasVencidas(dias, limite) {
    return db.query(
      `SELECT id, propuesta_general_url FROM vales
       WHERE confirmado_en IS NOT NULL AND propuestas_purgadas_en IS NULL
         AND confirmado_en <= NOW() - INTERVAL ? DAY
       ORDER BY confirmado_en ASC LIMIT ?`,
      [dias, limite], 'retencion:listar_propuestas'
    );
  }

  async listarRutasDocumentos(valeId) {
    return db.query(
      'SELECT ruta FROM vale_documentos WHERE vale_id = ? AND ruta IS NOT NULL',
      [valeId], 'retencion:rutas_documentos'
    );
  }

  async listarUrlsPropuestas(valeId) {
    return db.query(
      'SELECT url FROM vale_propuestas WHERE vale_id = ? AND url IS NOT NULL',
      [valeId], 'retencion:urls_propuestas'
    );
  }

  async marcarArchivosPurgados(valeId) {
    await db.transaccion(async (tx) => {
      await tx.query('UPDATE vale_documentos SET ruta = NULL WHERE vale_id = ?', [valeId], 'retencion:anular_documentos');
      await tx.query('UPDATE vales SET pdf_url = NULL, archivos_purgados_en = NOW() WHERE id = ?', [valeId], 'retencion:marcar_archivos');
    });
  }

  async marcarPropuestasPurgadas(valeId) {
    await db.transaccion(async (tx) => {
      await tx.query('UPDATE vale_propuestas SET url = NULL WHERE vale_id = ?', [valeId], 'retencion:anular_propuestas');
      await tx.query('UPDATE vales SET propuesta_general_url = NULL, propuestas_purgadas_en = NOW() WHERE id = ?', [valeId], 'retencion:marcar_propuestas');
    });
  }
}

module.exports = new RetencionArchivosRepository();
