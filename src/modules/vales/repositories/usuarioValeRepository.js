// src/modules/vales/repositories/usuarioValeRepository.js
// Consultas de usuario con nombre acotadas al módulo Vales (evita acoplar el módulo
// a src/core/auth, que resuelve identidad/JWT, no datos de negocio de otros actores).
const db = require('../../../config/database');

class UsuarioValeRepository {
  async obtenerPorId(id) {
    const rows = await db.query(
      'SELECT id, nombre, email, telefono, rol_id, localidad_id, encargado_id, activo FROM usuarios WHERE id = ?',
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
