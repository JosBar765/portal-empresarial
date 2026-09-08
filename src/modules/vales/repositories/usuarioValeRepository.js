// src/modules/vales/repositories/usuarioValeRepository.js
// Consultas de usuario con nombre acotadas al módulo Vales (evita acoplar el módulo
// a src/core/auth, que resuelve identidad/JWT, no datos de negocio de otros actores).
const db = require('../../../config/database');

class UsuarioValeRepository {
  async obtenerPorId(id) {
    const rows = await db.query(
      `SELECT u.id, u.nombre, u.email, u.rol_id, u.activo,
              COALESCE(a.telefono, s.telefono) AS telefono,
              a.tienda_id AS tienda_id,
              tt.taller_id AS taller_id
       FROM usuarios u
       LEFT JOIN asesores a ON a.usuario_id = u.id
       LEFT JOIN supervisores s ON s.usuario_id = u.id
       LEFT JOIN taller_tecnicos tt ON tt.usuario_id = u.id
       WHERE u.id = ?`,
      [id],
      'usuario:find_by_id'
    );
    return rows[0] || null;
  }

  async listarTodosLosTecnicos() {
    return db.query(
      `SELECT u.id, u.nombre, u.email, tt.taller_id
       FROM usuarios u
       LEFT JOIN taller_tecnicos tt ON tt.usuario_id = u.id
       WHERE u.rol_id = 6 AND u.activo = 1 ORDER BY u.nombre`,
      [6],
      'usuario:find_by_rol'
    );
  }

  // El taller de este encargado sale de `talleres.encargado_id` y sus
  // técnicos, de `taller_tecnicos`.
  async listarTecnicosPorEncargado(encargadoId) {
    return db.query(
      `SELECT u.id, u.nombre, u.email, tt.taller_id
       FROM usuarios u
       JOIN taller_tecnicos tt ON tt.usuario_id = u.id
       JOIN talleres t ON t.id = tt.taller_id AND t.encargado_id = ?
       WHERE u.rol_id = 6 AND u.activo = 1 ORDER BY u.nombre`,
      [encargadoId],
      'usuario:find_tecnicos_by_encargado'
    );
  }

  // Un supervisor cubre asesores por tienda puntual vía `supervisor_tiendas`,
  // cruzada con la tienda de cada asesor en `asesores.tienda_id` — sin
  // cobertura heredada por departamento/subdivisión.
  async listarAsesoresPorSupervisor(supervisorId) {
    return db.query(
      `SELECT DISTINCT u.id, u.nombre, u.email, a.tienda_id
       FROM usuarios u
       JOIN asesores a ON a.usuario_id = u.id
       JOIN supervisor_tiendas st ON st.tienda_id = a.tienda_id
       WHERE u.rol_id = 2 AND u.activo = 1 AND st.usuario_id = ?
       ORDER BY u.nombre`,
      [supervisorId],
      'usuario:find_asesores_by_supervisor'
    );
  }

  // Inverso de la anterior: todos los supervisores (rol 3) que cubren la
  // tienda de un asesor dado — puede haber MÁS de uno (supervisores
  // rotativos).
  async obtenerSupervisoresDeAsesor(asesorId) {
    return db.query(
      `SELECT DISTINCT u.id, u.nombre, u.email
       FROM usuarios u
       JOIN supervisor_tiendas st ON st.usuario_id = u.id
       JOIN asesores a ON a.tienda_id = st.tienda_id
       WHERE u.rol_id = 3 AND u.activo = 1 AND a.usuario_id = ?
       ORDER BY u.nombre`,
      [asesorId],
      'usuario:find_supervisores_by_asesor'
    );
  }

  async listarEncargados() {
    return db.query(
      "SELECT id, nombre, email, rol_id FROM usuarios WHERE rol_id IN (4, 5) AND activo = 1 ORDER BY nombre",
      [],
      'usuario:find_encargados'
    );
  }

  async listarPorRol(rolId) {
    return db.query(
      'SELECT id, nombre, email FROM usuarios WHERE rol_id = ? AND activo = 1 ORDER BY nombre',
      [rolId],
      'usuario:find_by_rol'
    );
  }
}

module.exports = new UsuarioValeRepository();
