// src/modules/admin/repositories/valePdfGeneradoRepository.js
const db = require('../../../config/database');

class ValePdfGeneradoRepository {
  async obtenerCredencial(usuarioId) {
    const rows = await db.query('SELECT password_hash, activo FROM usuarios WHERE id = ?', [usuarioId], 'usuario:credencial');
    return rows[0] || null;
  }

  async listarSupervisores() {
    return db.query(
      `SELECT u.id, u.nombre FROM usuarios u
       JOIN supervisores s ON s.usuario_id = u.id
       WHERE u.activo = 1 ORDER BY u.nombre`,
      [], 'vale_pdf:supervisores'
    );
  }

  async obtenerSupervisor(usuarioId) {
    const rows = await db.query(
      `SELECT u.id, u.nombre FROM usuarios u
       JOIN supervisores s ON s.usuario_id = u.id
       WHERE u.id = ?`,
      [usuarioId], 'vale_pdf:supervisor'
    );
    return rows[0] || null;
  }

  async listarAsesores() {
    return db.query(
      `SELECT u.id, u.nombre, u.email, a.telefono FROM usuarios u
       JOIN asesores a ON a.usuario_id = u.id
       WHERE u.activo = 1 ORDER BY u.nombre`,
      [], 'vale_pdf:asesores'
    );
  }

  async insertar({ usuarioId, correlativo, url }) {
    const result = await db.query(
      'INSERT INTO vale_pdf_generados (usuario_id, correlativo, url) VALUES (?, ?, ?)',
      [usuarioId, correlativo, url], 'vale_pdf:insert'
    );
    return result.insertId;
  }

  async listarRecientes(limite = 50) {
    return db.query(
      `SELECT g.id, u.nombre AS usuario_nombre, g.correlativo, g.url, g.creado_en
       FROM vale_pdf_generados g JOIN usuarios u ON u.id = g.usuario_id
       ORDER BY g.creado_en DESC, g.id DESC LIMIT ?`,
      [limite], 'vale_pdf:listar'
    );
  }
}

module.exports = new ValePdfGeneradoRepository();
