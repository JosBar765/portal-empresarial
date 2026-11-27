// src/core/notifications/notificacionRepository.js
const db = require('../../config/database');
const { visibleSql } = require('./alcanceSql');

const COLUMNAS = 'id, modulo, vale_id, referencia_tipo, referencia_id, tipo, nivel, mensaje, creado_en, leida_en, tienda_id, asesor_id';
// Sin alias: la misma condición sirve en el UPDATE (MariaDB incluido).
const VISIBLE = visibleSql({ usuario: 'notificaciones.usuario_id', modulo: 'notificaciones.modulo', tienda: 'notificaciones.tienda_id', asesor: 'notificaciones.asesor_id' });

class NotificacionRepository {
  async crear(usuarioId, { modulo, valeId = null, referenciaTipo = null, referenciaId = null, tipo = null, nivel = 'info', mensaje, tiendaId = null, asesorId = null }) {
    const res = await db.query(
      'INSERT INTO notificaciones (usuario_id, modulo, vale_id, referencia_tipo, referencia_id, tipo, nivel, mensaje, tienda_id, asesor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [usuarioId, modulo, valeId, referenciaTipo, referenciaId, tipo, nivel, mensaje, tiendaId, asesorId],
      'notificacion:insert'
    );
    const rows = await db.query(`SELECT ${COLUMNAS} FROM notificaciones WHERE id = ?`, [res.insertId], 'notificacion:find');
    return rows[0];
  }

  // Una notificación por usuario en un solo INSERT; devuelve las filas creadas por `usuario_id`.
  async crearParaUsuarios(usuariosIds, { modulo, valeId = null, referenciaTipo = null, referenciaId = null, tipo = null, nivel = 'info', mensaje, tiendaId = null, asesorId = null }) {
    if (!usuariosIds.length) return new Map();
    const res = await db.query(
      'INSERT INTO notificaciones (usuario_id, modulo, vale_id, referencia_tipo, referencia_id, tipo, nivel, mensaje, tienda_id, asesor_id) VALUES ?',
      [usuariosIds.map(id => [id, modulo, valeId, referenciaTipo, referenciaId, tipo, nivel, mensaje, tiendaId, asesorId])],
      'notificacion:insert_varias'
    );
    const filas = await db.query(
      `SELECT ${COLUMNAS}, usuario_id FROM notificaciones WHERE id >= ? AND usuario_id IN (?) AND modulo = ? AND mensaje = ? ORDER BY id`,
      [res.insertId, usuariosIds, modulo, mensaje],
      'notificacion:find_varias'
    );
    const porUsuario = new Map();
    filas.forEach(({ usuario_id, ...notificacion }) => { if (!porUsuario.has(usuario_id)) porUsuario.set(usuario_id, notificacion); });
    return porUsuario;
  }

  // Una notificación, solo si es de ese usuario.
  async obtener(usuarioId, id) {
    const rows = await db.query(`SELECT ${COLUMNAS} FROM notificaciones WHERE id = ? AND usuario_id = ?`, [id, usuarioId], 'notificacion:find_propia');
    return rows[0] || null;
  }

  async listar(usuarioId, modulo, limite, desplazamiento) {
    return db.query(
      `SELECT ${COLUMNAS} FROM notificaciones WHERE usuario_id = ? AND modulo = ? AND ${VISIBLE} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [usuarioId, modulo, limite, desplazamiento],
      'notificacion:list'
    );
  }

  async contarNoLeidas(usuarioId, modulo) {
    const rows = await db.query(
      `SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = ? AND modulo = ? AND leida_en IS NULL AND ${VISIBLE}`,
      [usuarioId, modulo],
      'notificacion:count_no_leidas'
    );
    return rows[0].n;
  }

  // No leídas de cada módulo, para la burbuja de las tarjetas del dashboard.
  async contarNoLeidasPorModulo(usuarioId) {
    return db.query(
      `SELECT modulo, COUNT(*) AS n FROM notificaciones WHERE usuario_id = ? AND leida_en IS NULL AND ${VISIBLE} GROUP BY modulo`,
      [usuarioId],
      'notificacion:count_por_modulo'
    );
  }

  // No leídas que la selección deja fuera, por tienda y asesor: solo nombres y cantidades.
  fueraDeSeleccion(usuarioId, modulo) {
    return db.query(
      `SELECT notificaciones.tienda_id, CONCAT(t.codigo, ' - ', e.nombre, IF(s.nombre IS NOT NULL, CONCAT(', ', s.nombre), '')) AS tienda,
         notificaciones.asesor_id, u.nombre AS asesor, COUNT(*) AS n
       FROM notificaciones
       JOIN tiendas t ON t.id = notificaciones.tienda_id
       JOIN empresas e ON e.id = t.empresa_id
       LEFT JOIN subdivisiones s ON s.id = t.subdivision_id
       LEFT JOIN usuarios u ON u.id = notificaciones.asesor_id
       WHERE notificaciones.usuario_id = ? AND notificaciones.modulo = ? AND notificaciones.leida_en IS NULL AND NOT ${VISIBLE}
       GROUP BY notificaciones.tienda_id, tienda, notificaciones.asesor_id, u.nombre`,
      [usuarioId, modulo],
      'notificacion:fuera'
    );
  }

  async marcarLeida(usuarioId, id) {
    await db.query(
      'UPDATE notificaciones SET leida_en = NOW() WHERE id = ? AND usuario_id = ? AND leida_en IS NULL',
      [id, usuarioId],
      'notificacion:marcar_leida'
    );
  }

  // Borra las emitidas hace más de `dias` días (de todos los módulos), estén leídas o no.
  async purgarAntiguas(dias) {
    const res = await db.query(
      'DELETE FROM notificaciones WHERE creado_en < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [dias],
      'notificacion:purgar_antiguas'
    );
    return res.affectedRows;
  }

  async marcarTodasLeidas(usuarioId, modulo) {
    await db.query(
      `UPDATE notificaciones SET leida_en = NOW() WHERE usuario_id = ? AND modulo = ? AND leida_en IS NULL AND ${VISIBLE}`,
      [usuarioId, modulo],
      'notificacion:marcar_todas'
    );
  }
}

module.exports = new NotificacionRepository();
