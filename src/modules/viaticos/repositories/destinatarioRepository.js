// src/modules/viaticos/repositories/destinatarioRepository.js
// Quién recibe las notificaciones del módulo.
const db = require('../../../config/database');

class DestinatarioRepository {
  // Usuarios activos con el permiso; decide el permiso, no el rol (incluye al Administrador si lo tiene).
  async listarConPermiso(codigoPermiso) {
    const filas = await db.query(
      `SELECT DISTINCT u.id FROM usuarios u
       JOIN rol_permisos rp ON rp.rol_id = u.rol_id
       JOIN permisos p ON p.id = rp.permiso_id
       WHERE p.codigo = ? AND u.activo = 1`,
      [codigoPermiso], 'viaticos:destinatariosConPermiso'
    );
    return filas.map(f => f.id);
  }
}

module.exports = new DestinatarioRepository();
