// src/modules/vales/repositories/destinatariosRepository.js
// Usuarios que reciben las notificaciones de las salas de tiempo real de Vales.
const db = require('../../../config/database');

class DestinatariosRepository {
  // Encargado del taller y quienes lo gestionan con él (permiso `vales.gestionar_taller`, no el rol) vinculados a él.
  async listarDeTaller(tallerId) {
    const rows = await db.query(
      `SELECT t.encargado_id AS id FROM talleres t WHERE t.id = ? AND t.encargado_id IS NOT NULL
       UNION
       SELECT tt.usuario_id AS id FROM taller_disenadores tt
       JOIN usuarios u ON u.id = tt.usuario_id
       JOIN rol_permisos rp ON rp.rol_id = u.rol_id
       JOIN permisos p ON p.id = rp.permiso_id AND p.codigo = 'vales.gestionar_taller'
       WHERE tt.taller_id = ? AND u.activo = 1`,
      [tallerId, tallerId],
      'destinatarios:taller'
    );
    return rows.map(r => r.id);
  }

  // Administradores activos (el rol se pasa desde valeHelpers para no repetir su id aquí).
  async listarAdministradores(rolAdministradorId) {
    const rows = await db.query('SELECT u.id FROM usuarios u WHERE u.rol_id = ? AND u.activo = 1', [rolAdministradorId], 'destinatarios:administradores');
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
