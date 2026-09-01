// src/modules/vales/repositories/usuarioValeRepository.js
// Consultas de usuario con nombre acotadas al módulo Vales (evita acoplar el módulo
// a src/core/auth, que resuelve identidad/JWT, no datos de negocio de otros actores).
const db = require('../../../config/database');

class UsuarioValeRepository {
  async obtenerPorId(id) {
    const rows = await db.query(
      'SELECT id, nombre, email, telefono, rol_id, tienda_id, encargado_id, activo FROM usuarios WHERE id = ?',
      [id],
      'usuario:find_by_id'
    );
    return rows[0] || null;
  }

  async listarTodosLosTecnicos() {
    return db.query(
      'SELECT id, nombre, email, encargado_id FROM usuarios WHERE rol_id = 7 AND activo = 1 ORDER BY nombre',
      [7],
      'usuario:find_by_rol'
    );
  }

  async listarTecnicosPorEncargado(encargadoId) {
    return db.query(
      'SELECT id, nombre, email, encargado_id FROM usuarios WHERE rol_id = 7 AND encargado_id = ? AND activo = 1 ORDER BY nombre',
      [encargadoId],
      'usuario:find_tecnicos_by_encargado'
    );
  }

  // analisis_correcciones_12.md #10: reemplaza la relación 1:1 `encargado_id`
  // (correcciones_10.md #11) — un supervisor cubre asesores a través de la
  // tienda de estos, resuelta vía departamento/subdivisión. `subdivision_id IS
  // NULL` en `supervisor_asignaciones` significa "cubre todas las
  // subdivisiones de ese departamento", así que también matchea una tienda
  // cuyo propio `subdivision_id` sea NULL (departamentos sin subdivisiones,
  // ej. Premia Z13) o cualquier subdivisión puntual.
  // analisis_correcciones_13.md #6: una fila de `supervisor_asignaciones`
  // ahora cubre POR DEPARTAMENTO (`tienda_id IS NULL`) o POR TIENDA PUNTUAL
  // (`tienda_id` seteado) — nunca ambas cosas — así que se matchea cualquiera
  // de las dos variantes.
  async listarAsesoresPorSupervisor(supervisorId) {
    return db.query(
      `SELECT DISTINCT u.id, u.nombre, u.email, u.encargado_id, u.tienda_id
       FROM usuarios u
       JOIN tiendas t ON t.id = u.tienda_id
       JOIN supervisor_asignaciones sa ON sa.tienda_id = t.id
         OR (sa.tienda_id IS NULL AND sa.departamento_id = t.departamento_id
             AND (sa.subdivision_id IS NULL OR sa.subdivision_id = t.subdivision_id))
       WHERE u.rol_id = 3 AND u.activo = 1 AND sa.usuario_id = ? AND sa.activo = 1
       ORDER BY u.nombre`,
      [supervisorId],
      'usuario:find_asesores_by_supervisor'
    );
  }

  // Inverso de la anterior: todos los supervisores (rol 4) que cubren la
  // tienda de un asesor dado — puede haber MÁS de uno (supervisores rotativos,
  // analisis_correcciones_12.md #10).
  async obtenerSupervisoresDeAsesor(asesorId) {
    return db.query(
      `SELECT DISTINCT u.id, u.nombre, u.email
       FROM usuarios u
       JOIN supervisor_asignaciones sa ON sa.usuario_id = u.id AND sa.activo = 1
       JOIN usuarios asesor ON 1 = 1
       JOIN tiendas t ON t.id = asesor.tienda_id
         AND (sa.tienda_id = t.id
              OR (sa.tienda_id IS NULL AND sa.departamento_id = t.departamento_id
                  AND (sa.subdivision_id IS NULL OR sa.subdivision_id = t.subdivision_id)))
       WHERE u.rol_id = 4 AND u.activo = 1 AND asesor.id = ?
       ORDER BY u.nombre`,
      [asesorId],
      'usuario:find_supervisores_by_asesor'
    );
  }

  async listarEncargados() {
    return db.query(
      "SELECT id, nombre, email, rol_id FROM usuarios WHERE rol_id IN (5, 6) AND activo = 1 ORDER BY nombre",
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
