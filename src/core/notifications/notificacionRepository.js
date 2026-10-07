// src/core/notifications/notificacionRepository.js
const db = require('../../config/database');

const COLUMNAS = 'id, modulo, vale_id, tipo, nivel, mensaje, creado_en, leida_en';

class NotificacionRepository {
  async crear(usuarioId, { modulo, valeId = null, tipo = null, nivel = 'info', mensaje }) {
    const res = await db.query(
      'INSERT INTO notificaciones (usuario_id, modulo, vale_id, tipo, nivel, mensaje) VALUES (?, ?, ?, ?, ?, ?)',
      [usuarioId, modulo, valeId, tipo, nivel, mensaje],
      'notificacion:insert'
    );
    const rows = await db.query(`SELECT ${COLUMNAS} FROM notificaciones WHERE id = ?`, [res.insertId], 'notificacion:find');
    return rows[0];
  }

  async listar(usuarioId, modulo, limite, desplazamiento) {
    return db.query(
      `SELECT ${COLUMNAS} FROM notificaciones WHERE usuario_id = ? AND modulo = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
      [usuarioId, modulo, limite, desplazamiento],
      'notificacion:list'
    );
  }

  async contarNoLeidas(usuarioId, modulo) {
    const rows = await db.query(
      'SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = ? AND modulo = ? AND leida_en IS NULL',
      [usuarioId, modulo],
      'notificacion:count_no_leidas'
    );
    return rows[0].n;
  }

  // No leídas de cada módulo, para la burbuja de las tarjetas del dashboard.
  async contarNoLeidasPorModulo(usuarioId) {
    return db.query(
      'SELECT modulo, COUNT(*) AS n FROM notificaciones WHERE usuario_id = ? AND leida_en IS NULL GROUP BY modulo',
      [usuarioId],
      'notificacion:count_por_modulo'
    );
  }

  async marcarLeida(usuarioId, id) {
    await db.query(
      'UPDATE notificaciones SET leida_en = NOW() WHERE id = ? AND usuario_id = ? AND leida_en IS NULL',
      [id, usuarioId],
      'notificacion:marcar_leida'
    );
  }

  // Borra las ya leídas con más de `dias` días (de todos los módulos); las no leídas nunca se tocan.
  async purgarLeidasAntiguas(dias) {
    const res = await db.query(
      'DELETE FROM notificaciones WHERE leida_en IS NOT NULL AND leida_en < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [dias],
      'notificacion:purgar_leidas'
    );
    return res.affectedRows;
  }

  async marcarTodasLeidas(usuarioId, modulo) {
    await db.query(
      'UPDATE notificaciones SET leida_en = NOW() WHERE usuario_id = ? AND modulo = ? AND leida_en IS NULL',
      [usuarioId, modulo],
      'notificacion:marcar_todas'
    );
  }
}

module.exports = new NotificacionRepository();
