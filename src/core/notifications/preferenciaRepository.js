// src/core/notifications/preferenciaRepository.js
const db = require('../../config/database');

// Lista blanca: el nombre de columna se inserta en el SQL.
const CANALES = Object.freeze(['escritorio', 'movil']);

class PreferenciaRepository {
  listar(usuarioId, modulo) {
    return db.query(
      'SELECT categoria, escritorio, movil FROM notificacion_preferencias WHERE usuario_id = ? AND modulo = ?',
      [usuarioId, modulo],
      'preferencias:list'
    );
  }

  // Cambia solo la columna del canal; la otra queda como estaba.
  async guardar(usuarioId, modulo, categorias, canal, activo) {
    if (!CANALES.includes(canal) || !categorias.length) return;
    await db.query(
      `INSERT INTO notificacion_preferencias (usuario_id, modulo, categoria, \`${canal}\`) VALUES ?
       ON DUPLICATE KEY UPDATE \`${canal}\` = VALUES(\`${canal}\`)`,
      [categorias.map(categoria => [usuarioId, modulo, categoria, activo ? 1 : 0])],
      'preferencias:upsert'
    );
  }
}

module.exports = { repositorio: new PreferenciaRepository(), CANALES };
