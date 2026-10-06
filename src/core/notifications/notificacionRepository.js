// src/core/notifications/notificacionRepository.js
const db = require('../../config/database');

const COLUMNAS = 'id, vale_id, tipo, nivel, mensaje, creado_en, leida_en';

class NotificacionRepository {
  async crear(usuarioId, { valeId = null, tipo = null, nivel = 'info', mensaje }) {
    const res = await db.query(
      'INSERT INTO notificaciones (usuario_id, vale_id, tipo, nivel, mensaje) VALUES (?, ?, ?, ?, ?)',
      [usuarioId, valeId, tipo, nivel, mensaje],
      'notificacion:insert'
    );
    const rows = await db.query(`SELECT ${COLUMNAS} FROM notificaciones WHERE id = ?`, [res.insertId], 'notificacion:find');
    return rows[0];
  }

  async listar(usuarioId, limite, desplazamiento) {
    return db.query(
      `SELECT ${COLUMNAS} FROM notificaciones WHERE usuario_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
      [usuarioId, limite, desplazamiento],
      'notificacion:list'
    );
  }

  async contarNoLeidas(usuarioId) {
    const rows = await db.query(
      'SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = ? AND leida_en IS NULL',
      [usuarioId],
      'notificacion:count_no_leidas'
    );
    return rows[0].n;
  }

  async marcarLeida(usuarioId, id) {
    await db.query(
      'UPDATE notificaciones SET leida_en = NOW() WHERE id = ? AND usuario_id = ? AND leida_en IS NULL',
      [id, usuarioId],
      'notificacion:marcar_leida'
    );
  }

  // Borra las ya leídas con más de `dias` días; las no leídas nunca se tocan.
  async purgarLeidasAntiguas(dias) {
    const res = await db.query(
      'DELETE FROM notificaciones WHERE leida_en IS NOT NULL AND leida_en < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [dias],
      'notificacion:purgar_leidas'
    );
    return res.affectedRows;
  }

  async marcarTodasLeidas(usuarioId) {
    await db.query(
      'UPDATE notificaciones SET leida_en = NOW() WHERE usuario_id = ? AND leida_en IS NULL',
      [usuarioId],
      'notificacion:marcar_todas'
    );
  }
}

module.exports = new NotificacionRepository();
