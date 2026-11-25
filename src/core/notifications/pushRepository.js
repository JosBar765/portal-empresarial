// src/core/notifications/pushRepository.js
const crypto = require('crypto');
const db = require('../../config/database');

const hashEndpoint = (endpoint) => crypto.createHash('sha256').update(endpoint).digest('hex');

class PushRepository {
  // Un endpoint pertenece siempre al ÚLTIMO usuario que lo registró (equipos compartidos).
  async upsertPorEndpoint(usuarioId, { endpoint, p256dh, auth, dispositivo, userAgent }) {
    await db.query(
      `INSERT INTO push_suscripciones (usuario_id, endpoint, endpoint_hash, p256dh, auth, dispositivo, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id), p256dh = VALUES(p256dh), auth = VALUES(auth), dispositivo = VALUES(dispositivo), user_agent = VALUES(user_agent)`,
      [usuarioId, endpoint, hashEndpoint(endpoint), p256dh, auth, dispositivo, userAgent || null],
      'push:upsert'
    );
  }

  // Dispositivos de usuarios activos que pidieron esta categoría para su clase de dispositivo.
  destinos(modulo, categoria, usuariosIds) {
    return db.query(
      `SELECT s.id, s.usuario_id, s.endpoint, s.p256dh, s.auth FROM push_suscripciones s
       JOIN notificacion_preferencias p ON p.usuario_id = s.usuario_id AND p.modulo = ? AND p.categoria = ?
       JOIN usuarios u ON u.id = s.usuario_id AND u.activo = 1
       WHERE s.usuario_id IN (?) AND ((s.dispositivo = 'escritorio' AND p.escritorio = 1) OR (s.dispositivo = 'movil' AND p.movil = 1))`,
      [modulo, categoria, usuariosIds],
      'push:destinos'
    );
  }

  // Solo para el registro de diagnóstico: qué marcó y qué dispositivos tiene cada destinatario.
  diagnostico(modulo, categoria, usuariosIds) {
    return db.query(
      `SELECT u.id AS usuario_id, u.activo, COALESCE(MAX(p.escritorio), 0) AS marca_escritorio, COALESCE(MAX(p.movil), 0) AS marca_movil,
         COALESCE(MAX(s.dispositivo = 'escritorio'), 0) AS escritorios, COALESCE(MAX(s.dispositivo = 'movil'), 0) AS moviles
       FROM usuarios u
       LEFT JOIN notificacion_preferencias p ON p.usuario_id = u.id AND p.modulo = ? AND p.categoria = ?
       LEFT JOIN push_suscripciones s ON s.usuario_id = u.id
       WHERE u.id IN (?) GROUP BY u.id, u.activo ORDER BY u.id`,
      [modulo, categoria, usuariosIds],
      'push:diagnostico'
    );
  }

  async eliminarPorEndpoint(usuarioId, endpoint) {
    await db.query('DELETE FROM push_suscripciones WHERE endpoint_hash = ? AND usuario_id = ?', [hashEndpoint(endpoint), usuarioId], 'push:delete_by_endpoint');
  }

  async eliminarPorId(id) {
    await db.query('DELETE FROM push_suscripciones WHERE id = ?', [id], 'push:delete_by_id');
  }

  async eliminarPorUsuario(usuarioId) {
    await db.query('DELETE FROM push_suscripciones WHERE usuario_id = ?', [usuarioId], 'push:delete_by_usuario');
  }
}

module.exports = new PushRepository();
