// src/modules/vales/repositories/valeMensajeRepository.js
// Conversación entre el taller (encargado/asistente) y el asesor mientras un taller tiene el vale rechazado.
// Cuelga de `vale_talleres` por llave foránea con ON DELETE CASCADE: al eliminarse el vale se va la conversación.
const db = require('../../../config/database');

class ValeMensajeRepository {
  async crear(valeTallerId, autorId, lado, mensaje) {
    const result = await db.query(
      'INSERT INTO vale_taller_mensajes (vale_taller_id, autor_id, lado, mensaje) VALUES (?, ?, ?, ?)',
      [valeTallerId, autorId, lado, mensaje],
      'vale_mensaje:insert'
    );
    return result.insertId;
  }

  async listarPorValeTaller(valeTallerId) {
    return db.query(
      `SELECT m.id, m.lado, m.mensaje, m.creado_en, m.autor_id, u.nombre AS autor
       FROM vale_taller_mensajes m
       JOIN usuarios u ON u.id = m.autor_id
       WHERE m.vale_taller_id = ?
       ORDER BY m.id ASC`,
      [valeTallerId],
      'vale_mensaje:list_by_vale_taller'
    );
  }

  // Registro: todas las conversaciones de un vale (abiertas o ya cerradas), con el nombre del taller.
  async listarPorVale(valeId) {
    return db.query(
      `SELECT m.id, m.vale_taller_id, vt.taller_id, t.nombre AS taller, m.lado, m.mensaje, m.creado_en, u.nombre AS autor, m.autor_id
       FROM vale_taller_mensajes m
       JOIN vale_talleres vt ON vt.id = m.vale_taller_id
       JOIN talleres t ON t.id = vt.taller_id
       JOIN usuarios u ON u.id = m.autor_id
       WHERE vt.vale_id = ?
       ORDER BY m.id ASC`,
      [valeId],
      'vale_mensaje:list_by_vale'
    );
  }

  // Cuántos mensajes tiene cada fila de taller (para las listas, sin una consulta por fila).
  async contarPorValeTaller(valeTallerIds) {
    if (!valeTallerIds.length) return new Map();
    const filas = await db.query(
      'SELECT vale_taller_id, COUNT(*) AS total FROM vale_taller_mensajes WHERE vale_taller_id IN (?) GROUP BY vale_taller_id',
      [valeTallerIds],
      'vale_mensaje:count_by_vale_taller'
    );
    return new Map(filas.map(f => [f.vale_taller_id, Number(f.total)]));
  }
}

module.exports = new ValeMensajeRepository();
