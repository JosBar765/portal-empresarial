// src/modules/admin/repositories/supervisionAsesorRepository.js
// Supervisores asignados a un asesor (`asesor_supervisores`) y los datos que el admin necesita para cambiarlos.
const db = require('../../../config/database');

const { CON_PERMISO_SUPERVISAR } = require('./permisoSupervisarSql');

class SupervisionAsesorRepository {
  async obtenerAsesor(asesorId) {
    const filas = await db.query(
      `SELECT u.id, u.nombre, u.email, u.activo, a.tienda_id
       FROM usuarios u JOIN asesores a ON a.usuario_id = u.id WHERE u.id = ?`,
      [asesorId], 'supervision_asesor:find_asesor'
    );
    return filas[0] || null;
  }

  // Asignados tal cual están guardados, con su estado actual para avisar si dejaron de servir.
  async listarAsignados(asesorId) {
    return db.query(
      `SELECT u.id, u.nombre, u.email, u.activo, ${CON_PERMISO_SUPERVISAR('u.rol_id')} AS con_permiso
       FROM asesor_supervisores x JOIN usuarios u ON u.id = x.supervisor_id
       WHERE x.asesor_id = ? ORDER BY u.nombre`,
      [asesorId], 'supervision_asesor:list_asignados'
    );
  }

  async listarAsignables(rolSupervisorId) {
    return db.query(
      `SELECT u.id, u.nombre, u.email FROM usuarios u
       WHERE u.rol_id = ? AND u.activo = 1 AND ${CON_PERMISO_SUPERVISAR('u.rol_id')} ORDER BY u.nombre`,
      [rolSupervisorId], 'supervision_asesor:list_asignables'
    );
  }

  async listarUsuariosPorIds(ids) {
    if (!ids.length) return [];
    return db.query(
      `SELECT u.id, u.nombre, u.activo, u.rol_id, ${CON_PERMISO_SUPERVISAR('u.rol_id')} AS con_permiso
       FROM usuarios u WHERE u.id IN (?)`,
      [ids], 'supervision_asesor:find_usuarios'
    );
  }

  // Los supervisores que autorizarían al asesor sin asignación: los de su tienda.
  async listarSupervisoresDeTienda(asesorId) {
    return db.query(
      `SELECT DISTINCT u.id, u.nombre FROM usuarios u
       JOIN supervisor_tiendas st ON st.usuario_id = u.id
       JOIN asesores a ON a.tienda_id = st.tienda_id
       WHERE ${CON_PERMISO_SUPERVISAR('u.rol_id')} AND u.activo = 1 AND a.usuario_id = ? ORDER BY u.nombre`,
      [asesorId], 'supervision_asesor:list_de_tienda'
    );
  }

  async listarValesEsperando(asesorId, estados) {
    return db.query(
      `SELECT v.id, v.correlativo, ev.nombre AS estado
       FROM vales v JOIN estados_vale ev ON ev.id = v.estado_id
       WHERE v.asesor_id = ? AND ev.nombre IN (?) ORDER BY v.id ASC`,
      [asesorId, estados], 'supervision_asesor:list_vales_esperando'
    );
  }

  // Reemplaza el conjunto entero en una sola transacción.
  async reemplazar(asesorId, supervisorIds) {
    return db.transaccion(async (tx) => {
      await tx.query('DELETE FROM asesor_supervisores WHERE asesor_id = ?', [asesorId], 'supervision_asesor:delete');
      if (supervisorIds.length) {
        await tx.query(
          'INSERT INTO asesor_supervisores (asesor_id, supervisor_id) VALUES ?',
          [supervisorIds.map(id => [asesorId, id])], 'supervision_asesor:insert'
        );
      }
    });
  }
}

module.exports = new SupervisionAsesorRepository();
