// src/modules/vales/repositories/destinatariosRepository.js
// Usuarios que reciben las notificaciones de las salas de tiempo real de Vales.
const db = require('../../../config/database');

class DestinatariosRepository {
  // Encargado del taller y el Asistente de Diseño vinculado a él.
  async listarDeTaller(tallerId) {
    const rows = await db.query(
      `SELECT t.encargado_id AS id FROM talleres t WHERE t.id = ? AND t.encargado_id IS NOT NULL
       UNION
       SELECT tt.usuario_id AS id FROM taller_disenadores tt
       JOIN usuarios u ON u.id = tt.usuario_id
       WHERE tt.taller_id = ? AND u.rol_id = 7 AND u.activo = 1`,
      [tallerId, tallerId],
      'destinatarios:taller'
    );
    return rows.map(r => r.id);
  }

  async listarConPermiso(codigoPermiso) {
    const rows = await db.query(
      `SELECT DISTINCT u.id FROM usuarios u
       JOIN rol_permisos rp ON rp.rol_id = u.rol_id
       JOIN permisos p ON p.id = rp.permiso_id
       WHERE p.codigo = ? AND u.activo = 1 AND u.rol_id <> 1`,
      [codigoPermiso],
      'destinatarios:permiso'
    );
    return rows.map(r => r.id);
  }
}

module.exports = new DestinatariosRepository();
