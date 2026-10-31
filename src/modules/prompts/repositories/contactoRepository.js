// src/modules/prompts/repositories/contactoRepository.js
// Único acoplamiento del módulo con otro: el teléfono vive en asesores o supervisores.
const db = require('../../../config/database');

class ContactoRepository {
  async obtenerPorUsuario(usuarioId) {
    const filas = await db.query(
      `SELECT u.nombre, u.email, COALESCE(a.telefono, sup.telefono) AS telefono
       FROM usuarios u
       LEFT JOIN asesores a ON a.usuario_id = u.id
       LEFT JOIN supervisores sup ON sup.usuario_id = u.id
       WHERE u.id = ?`,
      [usuarioId], 'prompts:obtenerContacto'
    );
    return filas[0] || null;
  }
}

module.exports = new ContactoRepository();
