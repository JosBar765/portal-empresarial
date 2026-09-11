// src/core/auth/sesionRepository.js
// Sesión única por usuario (ver database/schema.sql: sesiones_activas).
const db = require('../../config/database');

class SesionRepository {
  // Una sesión ya vencida (expira_en <= NOW()) nunca cuenta como activa,
  // aunque su fila siga en la tabla por falta de un logout/disconnect
  // limpio — es la garantía de que un crash no bloquea el login más allá de
  // la vida real del JWT.
  async obtenerActiva(usuarioId) {
    const rows = await db.query(
      'SELECT usuario_id, token_id, expira_en FROM sesiones_activas WHERE usuario_id = ? AND expira_en > NOW()',
      [usuarioId], 'sesion:obtener_activa'
    );
    return rows[0] || null;
  }

  // Reemplaza por completo cualquier sesión previa (vigente o vencida) de
  // este usuario — solo se llama tras confirmar que no había una activa.
  async crear(usuarioId, tokenId, expiraEn) {
    await db.query(
      `INSERT INTO sesiones_activas (usuario_id, token_id, iniciada_en, expira_en, conexiones_activas)
       VALUES (?, ?, NOW(), ?, 0)
       ON DUPLICATE KEY UPDATE token_id = VALUES(token_id), iniciada_en = NOW(), expira_en = VALUES(expira_en), conexiones_activas = 0`,
      [usuarioId, tokenId, expiraEn], 'sesion:crear'
    );
  }

  // Refresco de token (mismo login, no una sesión nueva): conserva
  // conexiones_activas, solo extiende el techo de expiración al del token
  // recién reemitido.
  async extenderExpiracion(usuarioId, tokenId, expiraEn) {
    await db.query(
      'UPDATE sesiones_activas SET expira_en = ? WHERE usuario_id = ? AND token_id = ?',
      [expiraEn, usuarioId, tokenId], 'sesion:extender'
    );
  }

  // `tokenId` siempre se exige al escribir/borrar para que una sesión ya
  // reemplazada (un tab viejo que se desconecta o hace logout tarde) nunca
  // pise/borre la fila de la sesión más nueva que la reemplazó.
  async incrementarConexion(usuarioId, tokenId) {
    await db.query(
      'UPDATE sesiones_activas SET conexiones_activas = conexiones_activas + 1 WHERE usuario_id = ? AND token_id = ?',
      [usuarioId, tokenId], 'sesion:incrementar_conexion'
    );
  }

  // Al llegar a 0 conexiones, la sesión se da por cerrada (tab cerrado,
  // navegador/PC crasheado — el disconnect de Socket.IO llega solo,
  // típicamente en segundos). No hace falta transacción: es, como mucho,
  // una fila de más viva unos milisegundos entre el UPDATE y el DELETE.
  async decrementarConexion(usuarioId, tokenId) {
    await db.query(
      'UPDATE sesiones_activas SET conexiones_activas = GREATEST(conexiones_activas - 1, 0) WHERE usuario_id = ? AND token_id = ?',
      [usuarioId, tokenId], 'sesion:decrementar_conexion'
    );
    await db.query(
      'DELETE FROM sesiones_activas WHERE usuario_id = ? AND token_id = ? AND conexiones_activas <= 0',
      [usuarioId, tokenId], 'sesion:limpiar_si_vacia'
    );
  }

  async eliminarSiCoincide(usuarioId, tokenId) {
    await db.query(
      'DELETE FROM sesiones_activas WHERE usuario_id = ? AND token_id = ?',
      [usuarioId, tokenId], 'sesion:eliminar'
    );
  }

  // Reconciliación al arrancar el servidor: en un proceso recién iniciado
  // no puede haber NINGÚN socket todavía conectado, así que cualquier fila
  // existente es necesariamente huérfana de un crash/reinicio anterior —
  // borrarlas todas es siempre seguro y da recuperación inmediata en vez de
  // esperar a que cada `expira_en` venza por su cuenta.
  async limpiarTodas() {
    await db.query('DELETE FROM sesiones_activas', [], 'sesion:limpiar_todas');
  }
}

module.exports = new SesionRepository();
