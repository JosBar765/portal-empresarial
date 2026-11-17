// src/modules/viaticos/repositories/vistoRepository.js
// Vistos: quién con permiso de autorizar ya abrió el documento de una solicitud.
const db = require('../../../config/database');

class VistoRepository {
  // Idempotente: abrir el visor otra vez solo renueva la fecha.
  async registrar(solicitudId, usuarioId, ejecutor = db) {
    await ejecutor.query(
      'INSERT INTO viaticos_vistos (solicitud_id, usuario_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE visto_en = CURRENT_TIMESTAMP',
      [solicitudId, usuarioId], 'viaticos:registrarVisto'
    );
  }

  async existe(solicitudId, usuarioId, ejecutor = db) {
    const filas = await ejecutor.query(
      'SELECT 1 AS visto FROM viaticos_vistos WHERE solicitud_id = ? AND usuario_id = ? LIMIT 1',
      [solicitudId, usuarioId], 'viaticos:existeVisto'
    );
    return filas.length > 0;
  }

  // Ids (de los dados) que esa persona ya vio.
  async idsVistos(usuarioId, solicitudIds, ejecutor = db) {
    if (solicitudIds.length === 0) return new Set();
    const marcas = solicitudIds.map(() => '?').join(', ');
    const filas = await ejecutor.query(
      `SELECT solicitud_id FROM viaticos_vistos WHERE usuario_id = ? AND solicitud_id IN (${marcas})`,
      [usuarioId, ...solicitudIds], 'viaticos:idsVistos'
    );
    return new Set(filas.map(f => Number(f.solicitud_id)));
  }

  // Al modificar la solicitud todos los vistos pierden validez: hay que volver a revisarla.
  async borrarDeSolicitud(solicitudId, ejecutor = db) {
    await ejecutor.query('DELETE FROM viaticos_vistos WHERE solicitud_id = ?', [solicitudId], 'viaticos:borrarVistos');
  }
}

module.exports = new VistoRepository();
