// src/modules/prompts/repositories/versionRepository.js
const db = require('../../../config/database');

const COLUMNAS = 'id, producto_id, numero, estado, esquema, creado_en, publicado_en, actualizado_en'; // «plantilla» deprecada: ya no se lee

class VersionRepository {
  async obtenerPorEstado(productoId, estado, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT ${COLUMNAS} FROM prompt_producto_versiones WHERE producto_id = ? AND estado = ? LIMIT 1`,
      [productoId, estado], 'prompts:obtenerVersion'
    );
    return filas[0] || null;
  }

  async contarPorProducto(productoId, ejecutor = db) {
    const filas = await ejecutor.query(
      'SELECT COUNT(*) AS total FROM prompt_producto_versiones WHERE producto_id = ?',
      [productoId], 'prompts:contarVersiones'
    );
    return Number(filas[0].total);
  }

  async siguienteNumero(productoId, ejecutor = db) {
    const filas = await ejecutor.query(
      'SELECT COALESCE(MAX(numero), 0) + 1 AS numero FROM prompt_producto_versiones WHERE producto_id = ?',
      [productoId], 'prompts:siguienteNumero'
    );
    return Number(filas[0].numero);
  }

  // La columna «plantilla» (NOT NULL, deprecada) se escribe siempre vacía.
  async crearBorrador({ productoId, numero, esquema, creadoPor }, ejecutor = db) {
    const resultado = await ejecutor.query(
      "INSERT INTO prompt_producto_versiones (producto_id, numero, estado, esquema, plantilla, creado_por) VALUES (?, ?, 'borrador', ?, '', ?)",
      [productoId, numero, JSON.stringify(esquema), creadoPor], 'prompts:crearBorrador'
    );
    return resultado.insertId;
  }

  // Solo toca borradores: una versión publicada o archivada es inmutable.
  async guardarBorrador(id, esquema, ejecutor = db) {
    const resultado = await ejecutor.query(
      "UPDATE prompt_producto_versiones SET esquema = ? WHERE id = ? AND estado = 'borrador'",
      [JSON.stringify(esquema), id], 'prompts:guardarBorrador'
    );
    return resultado.affectedRows > 0;
  }

  async eliminarBorrador(id, ejecutor = db) {
    const resultado = await ejecutor.query(
      "DELETE FROM prompt_producto_versiones WHERE id = ? AND estado = 'borrador'",
      [id], 'prompts:eliminarBorrador'
    );
    return resultado.affectedRows > 0;
  }

  async archivar(id, ejecutor = db) {
    await ejecutor.query(
      "UPDATE prompt_producto_versiones SET estado = 'archivada' WHERE id = ? AND estado = 'publicada'",
      [id], 'prompts:archivarVersion'
    );
  }

  async publicar(id, ejecutor = db) {
    await ejecutor.query(
      "UPDATE prompt_producto_versiones SET estado = 'publicada', publicado_en = CURRENT_TIMESTAMP WHERE id = ? AND estado = 'borrador'",
      [id], 'prompts:publicarVersion'
    );
  }
}

module.exports = new VersionRepository();
