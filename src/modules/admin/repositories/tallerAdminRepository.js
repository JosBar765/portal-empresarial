// src/modules/admin/repositories/tallerAdminRepository.js
// Asignación de talleres desde el panel de administración —
// `talleres.encargado_id` y `taller_tecnicos` se actualizan desde aquí.
const db = require('../../../config/database');

class TallerAdminRepository {
  async listarConDetalle() {
    return db.query(
      `SELECT t.id, t.nombre, t.encargado_id, t.tienda_id, u.nombre AS encargado_nombre,
              (SELECT COUNT(*) FROM taller_tecnicos tt WHERE tt.taller_id = t.id) AS tecnicos_count
       FROM talleres t
       LEFT JOIN usuarios u ON u.id = t.encargado_id
       WHERE t.activo = 1
       ORDER BY t.nombre`,
      [],
      'taller_admin:list'
    );
  }

  async obtenerPorId(id) {
    const rows = await db.query(
      'SELECT id, nombre, encargado_id, tienda_id FROM talleres WHERE id = ?',
      [id],
      'taller_admin:find_by_id'
    );
    return rows[0] || null;
  }

  async listarPersonalDetalle(tallerId) {
    return db.query(
      `SELECT u.id, u.nombre, u.email, r.nombre AS rol_nombre, u.rol_id, 'encargado' AS tipo_vinculo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN talleres t ON t.encargado_id = u.id AND t.id = ?
       WHERE u.activo = 1
       UNION ALL
       SELECT u.id, u.nombre, u.email, r.nombre AS rol_nombre, u.rol_id, 'tecnico' AS tipo_vinculo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN taller_tecnicos tt ON tt.usuario_id = u.id AND tt.taller_id = ?
       WHERE u.activo = 1
       ORDER BY tipo_vinculo, nombre`,
      [tallerId, tallerId],
      'taller_admin:personal_detalle'
    );
  }

  async asignarEncargado(tallerId, usuarioId) {
    return db.query(
      'UPDATE talleres SET encargado_id = ? WHERE id = ?',
      [usuarioId, tallerId],
      'taller_admin:asignar_encargado'
    );
  }

  // Mismo mecanismo para Técnico (rol 6) y Asistente (rol 7, "clona" el
  // taller elegido) — PK en usuario_id, así que reasignar es un upsert
  // simple (nunca puede quedar en dos talleres).
  async asignarTecnico(usuarioId, tallerId) {
    return db.query(
      'INSERT INTO taller_tecnicos (usuario_id, taller_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE taller_id = VALUES(taller_id)',
      [usuarioId, tallerId],
      'taller_tecnico:asignar'
    );
  }

  async quitarTecnico(usuarioId) {
    return db.query(
      'DELETE FROM taller_tecnicos WHERE usuario_id = ?',
      [usuarioId],
      'taller_tecnico:quitar'
    );
  }
}

module.exports = new TallerAdminRepository();
