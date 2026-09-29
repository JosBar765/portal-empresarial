// src/core/auth/sesionRepository.js
// Sesión única por usuario (ver database/schema.sql: sesiones_activas).
const db = require('../../config/database');

const GRACIA_SEGUNDOS = 30;

class SesionRepository {
  // "Activa" = alguien la está usando: tiene sockets abiertos, o los perdió
  // hace menos de GRACIA_SEGUNDOS (navegar entre páginas o recargar corta el
  // socket un instante). Una sesión abandonada más tiempo que eso NO bloquea
  // un login nuevo: éste la reemplaza y su refresh token deja de servir. La
  // fila en sí no se borra por perder sockets — guarda el refresh token, y
  // una laptop dormida o un tab en segundo plano deben poder retomarla.
  async obtenerActiva(usuarioId) {
    const rows = await db.query(
      `SELECT usuario_id, token_id, expira_en FROM sesiones_activas
       WHERE usuario_id = ? AND expira_en > NOW()
         AND (conexiones_activas > 0 OR sin_conexiones_desde > NOW() - INTERVAL ${GRACIA_SEGUNDOS} SECOND)`,
      [usuarioId], 'sesion:obtener_activa'
    );
    return rows[0] || null;
  }

  // Sesión que sigue existiendo (no vencida ni reemplazada), la use alguien
  // en este momento o no — es lo que valida el handshake del socket.
  async obtenerVigente(usuarioId) {
    const rows = await db.query(
      'SELECT usuario_id, token_id FROM sesiones_activas WHERE usuario_id = ? AND expira_en > NOW()',
      [usuarioId], 'sesion:obtener_vigente'
    );
    return rows[0] || null;
  }

  // Reemplaza por completo cualquier sesión previa (vigente o vencida) de
  // este usuario — solo se llama tras confirmar que no había una activa.
  // `expira_en` es el techo de la sesión: coincide con la vida máxima del
  // refresh token y NO se extiende al rotarlo.
  async crear(usuarioId, tokenId, refreshHash, expiraEn) {
    await db.query(
      `INSERT INTO sesiones_activas (usuario_id, token_id, iniciada_en, expira_en, conexiones_activas, refresh_hash, refresh_anterior_hash, refresh_expira_en, sin_conexiones_desde)
       VALUES (?, ?, NOW(), ?, 0, ?, NULL, ?, NOW())
       ON DUPLICATE KEY UPDATE token_id = VALUES(token_id), iniciada_en = NOW(), expira_en = VALUES(expira_en), conexiones_activas = 0,
         refresh_hash = VALUES(refresh_hash), refresh_anterior_hash = NULL, refresh_expira_en = VALUES(refresh_expira_en), sin_conexiones_desde = NOW()`,
      [usuarioId, tokenId, expiraEn, refreshHash, expiraEn], 'sesion:crear'
    );
  }

  // Del refresh token solo se guarda su hash SHA-256: una fuga de la base no
  // entrega tokens utilizables. `restante_seg` se calcula en SQL para no
  // depender de la zona horaria del proceso Node.
  async buscarPorRefresh(refreshHash) {
    const rows = await db.query(
      `SELECT usuario_id, token_id, TIMESTAMPDIFF(SECOND, NOW(), refresh_expira_en) AS restante_seg
       FROM sesiones_activas WHERE refresh_hash = ? AND refresh_expira_en > NOW()`,
      [refreshHash], 'sesion:buscar_por_refresh'
    );
    return rows[0] || null;
  }

  // Un refresh token que ya fue rotado y aun así se presenta = posible robo.
  async buscarPorRefreshAnterior(refreshHash) {
    const rows = await db.query(
      'SELECT usuario_id, token_id FROM sesiones_activas WHERE refresh_anterior_hash = ?',
      [refreshHash], 'sesion:buscar_por_refresh_anterior'
    );
    return rows[0] || null;
  }

  // Compare-and-set: solo rota si el hash vigente sigue siendo el que se
  // presentó, así dos renovaciones simultáneas nunca dejan dos tokens vivos.
  async rotarRefresh(usuarioId, tokenId, hashActual, hashNuevo) {
    const res = await db.query(
      `UPDATE sesiones_activas SET refresh_anterior_hash = refresh_hash, refresh_hash = ?
       WHERE usuario_id = ? AND token_id = ? AND refresh_hash = ?`,
      [hashNuevo, usuarioId, tokenId, hashActual], 'sesion:rotar_refresh'
    );
    return res.affectedRows === 1;
  }

  async eliminarPorRefresh(refreshHash) {
    await db.query(
      'DELETE FROM sesiones_activas WHERE refresh_hash = ? OR refresh_anterior_hash = ?',
      [refreshHash, refreshHash], 'sesion:eliminar_por_refresh'
    );
  }

  // Migración idempotente: agrega a bases creadas antes de este cambio las
  // columnas del refresh token y de presencia. Solo toca sesiones (datos
  // transitorios), nunca usuarios ni vales.
  async asegurarEsquema() {
    const existentes = (await db.query(
      `SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sesiones_activas'`,
      [], 'sesion:esquema'
    )).map(r => r.c);
    const faltan = (col, ddl) => (existentes.includes(col) ? [] : [ddl]);
    const cambios = [
      ...faltan('refresh_hash', 'ADD COLUMN refresh_hash CHAR(64) DEFAULT NULL, ADD INDEX idx_sesiones_refresh (refresh_hash)'),
      ...faltan('refresh_anterior_hash', 'ADD COLUMN refresh_anterior_hash CHAR(64) DEFAULT NULL, ADD INDEX idx_sesiones_refresh_anterior (refresh_anterior_hash)'),
      ...faltan('refresh_expira_en', 'ADD COLUMN refresh_expira_en DATETIME DEFAULT NULL'),
      ...faltan('sin_conexiones_desde', 'ADD COLUMN sin_conexiones_desde DATETIME DEFAULT NULL')
    ];
    if (!cambios.length) return;
    await db.query(`ALTER TABLE sesiones_activas ${cambios.join(', ')}`, [], 'sesion:migrar');
    // Filas heredadas no tienen refresh token: no hay forma de renovarlas.
    await db.query('DELETE FROM sesiones_activas WHERE refresh_hash IS NULL', [], 'sesion:descartar_sin_refresh');
    console.log('[Auth] sesiones_activas migrada: columnas del refresh token y de presencia agregadas.');
  }

  // `tokenId` siempre se exige al escribir/borrar para que una sesión ya
  // reemplazada (un tab viejo que se desconecta o hace logout tarde) nunca
  // pise/borre la fila de la sesión más nueva que la reemplazó.
  async incrementarConexion(usuarioId, tokenId) {
    await db.query(
      'UPDATE sesiones_activas SET conexiones_activas = conexiones_activas + 1, sin_conexiones_desde = NULL WHERE usuario_id = ? AND token_id = ?',
      [usuarioId, tokenId], 'sesion:incrementar_conexion'
    );
  }

  // Al llegar a 0 conexiones solo se anota desde cuándo (ver obtenerActiva):
  // la fila sigue viva porque contiene el refresh token de la sesión. En un
  // UPDATE de MySQL cada asignación ve el valor ya actualizado de las
  // anteriores, por eso el IF lee el contador nuevo.
  async decrementarConexion(usuarioId, tokenId) {
    await db.query(
      `UPDATE sesiones_activas
       SET conexiones_activas = GREATEST(conexiones_activas - 1, 0),
           sin_conexiones_desde = IF(conexiones_activas <= 0, NOW(), NULL)
       WHERE usuario_id = ? AND token_id = ?`,
      [usuarioId, tokenId], 'sesion:decrementar_conexion'
    );
  }

  async eliminarSiCoincide(usuarioId, tokenId) {
    await db.query(
      'DELETE FROM sesiones_activas WHERE usuario_id = ? AND token_id = ?',
      [usuarioId, tokenId], 'sesion:eliminar'
    );
  }

  // Reconciliación al arrancar el servidor: un proceso recién iniciado no
  // tiene NINGÚN socket conectado, así que todos los contadores de conexiones
  // heredados son falsos. Se ponen en 0 (los clientes vivos reconectan y
  // suman de nuevo) y se descartan las sesiones ya vencidas. Las sesiones
  // vigentes se conservan: un reinicio o despliegue no debe cerrar la sesión
  // de nadie, porque su refresh token vive en esta tabla.
  async reiniciarPresencia() {
    await db.query('DELETE FROM sesiones_activas WHERE expira_en <= NOW()', [], 'sesion:limpiar_vencidas');
    await db.query('UPDATE sesiones_activas SET conexiones_activas = 0, sin_conexiones_desde = NOW()', [], 'sesion:reiniciar_presencia');
  }
}

module.exports = new SesionRepository();
