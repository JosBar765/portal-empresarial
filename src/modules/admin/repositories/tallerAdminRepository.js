// src/modules/admin/repositories/tallerAdminRepository.js
// analisis_correcciones_19.md #8/#10/#12: asignación de talleres desde el
// panel de administración — hasta ahora `talleres.encargado_id` y
// `taller_tecnicos` solo los poblaba el seed, sin ninguna acción del panel
// que los volviera a tocar.
const db = require('../../../config/database');

class TallerAdminRepository {
  async listarTalleres() {
    return db.query(
      'SELECT id, nombre, encargado_id, tienda_id FROM talleres WHERE activo = 1 ORDER BY nombre',
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

  async asignarEncargado(tallerId, usuarioId) {
    return db.query(
      'UPDATE talleres SET encargado_id = ? WHERE id = ?',
      [usuarioId, tallerId],
      'taller_admin:asignar_encargado'
    );
  }

  // Libera cualquier taller del que este usuario sea encargado — se usa al
  // reasignar a otro taller o al cambiarle el rol (no hace falta saber DE
  // QUÉ taller era encargado, solo que deje de serlo).
  async quitarEncargadoDe(usuarioId) {
    return db.query(
      'UPDATE talleres SET encargado_id = NULL WHERE encargado_id = ?',
      [usuarioId],
      'taller_admin:quitar_encargado_de'
    );
  }

  // analisis_correcciones_19.md #10: mismo mecanismo para Técnico (rol 6) y
  // Asistente (rol 7, "clona" el taller elegido) — PK en usuario_id, así que
  // reasignar es un upsert simple (nunca puede quedar en dos talleres).
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
