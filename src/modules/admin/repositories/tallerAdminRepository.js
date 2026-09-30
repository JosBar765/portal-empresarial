// src/modules/admin/repositories/tallerAdminRepository.js
// Asignación de talleres desde el panel de administración —
// `talleres.encargado_id` y `taller_tecnicos` se actualizan desde aquí.
const db = require('../../../config/database');

class TallerAdminRepository {
  // Incluye los talleres inactivos: la pestaña necesita mostrarlos para poder
  // reactivarlos. Los activos van primero.
  async listarConDetalle() {
    return db.query(
      `SELECT t.id, t.nombre, t.encargado_id, t.tienda_id, t.limite_diario, t.activo, u.nombre AS encargado_nombre,
              ti.codigo AS tienda_codigo,
              CONCAT(e.nombre, IF(s.nombre IS NOT NULL, CONCAT(', ', s.nombre), '')) AS tienda_nombre,
              (SELECT COUNT(*) FROM taller_tecnicos tt WHERE tt.taller_id = t.id) AS tecnicos_count
       FROM talleres t
       LEFT JOIN usuarios u ON u.id = t.encargado_id
       LEFT JOIN tiendas ti ON ti.id = t.tienda_id
       LEFT JOIN empresas e ON e.id = ti.empresa_id
       LEFT JOIN subdivisiones s ON s.id = ti.subdivision_id
       ORDER BY t.activo DESC, t.nombre`,
      [],
      'taller_admin:list'
    );
  }

  async obtenerPorId(id) {
    const rows = await db.query(
      'SELECT id, nombre, encargado_id, tienda_id, activo, limite_diario FROM talleres WHERE id = ?',
      [id],
      'taller_admin:find_by_id'
    );
    return rows[0] || null;
  }

  async obtenerPorNombre(nombre) {
    const rows = await db.query('SELECT id, nombre, activo FROM talleres WHERE nombre = ?', [nombre], 'taller_admin:find_by_name');
    return rows[0] || null;
  }

  // El taller de Diseño Local de una tienda (activo o no): una tienda tiene
  // uno solo.
  async obtenerLocalDeTienda(tiendaId) {
    const rows = await db.query('SELECT id, nombre, activo FROM talleres WHERE tienda_id = ? LIMIT 1', [tiendaId], 'taller_admin:find_local_by_tienda');
    return rows[0] || null;
  }

  // El taller del que ya es encargado un usuario, sin contar `excluirTallerId`
  // (al reasignarlo al mismo taller no debe chocar consigo mismo).
  async obtenerTallerDeEncargado(usuarioId, excluirTallerId = 0) {
    const rows = await db.query(
      'SELECT id, nombre FROM talleres WHERE encargado_id = ? AND id <> ? LIMIT 1',
      [usuarioId, excluirTallerId || 0],
      'taller_admin:find_by_encargado'
    );
    return rows[0] || null;
  }

  async obtenerTallerDeTecnico(usuarioId) {
    const rows = await db.query(
      `SELECT t.id, t.nombre FROM taller_tecnicos tt JOIN talleres t ON t.id = tt.taller_id WHERE tt.usuario_id = ? LIMIT 1`,
      [usuarioId],
      'taller_admin:find_by_tecnico'
    );
    return rows[0] || null;
  }

  // Un taller de Diseño Local pertenece a UNA sola tienda: se guarda en
  // `talleres.tienda_id` y en `taller_tiendas` (que es lo que consultan los
  // demás módulos). Sin transacciones en esta capa, si la segunda escritura
  // falla se deshace la primera para no dejar un taller huérfano.
  async crearLocal({ nombre, tiendaId, encargadoId }) {
    const result = await db.query(
      'INSERT INTO talleres (nombre, encargado_id, tienda_id, activo) VALUES (?, ?, ?, 1)',
      [nombre, encargadoId || null, tiendaId],
      'taller_admin:insert_local'
    );
    const id = result.insertId;
    try {
      await db.query('INSERT INTO taller_tiendas (taller_id, tienda_id) VALUES (?, ?)', [id, tiendaId], 'taller_admin:insert_taller_tienda');
    } catch (error) {
      await db.query('DELETE FROM talleres WHERE id = ?', [id], 'taller_admin:rollback_insert_local');
      throw error;
    }
    return id;
  }

  async establecerActivo(id, activo) {
    return db.query('UPDATE talleres SET activo = ? WHERE id = ?', [activo ? 1 : 0, id], 'taller_admin:set_activo');
  }

  // Vales de arte todavía "en proceso" que involucran a este taller: todo
  // vale que no esté terminado (RECIBIDO/CONFIRMADO) y que ya esté en el
  // taller (`vale_talleres`) o que lo haya pedido y aún espere autorización
  // (`talleres_solicitados`, todavía sin filas en `vale_talleres`).
  async contarValesEnProceso(tallerId) {
    const rows = await db.query(
      `SELECT COUNT(*) AS n
       FROM vales v
       JOIN estados_vale e ON e.id = v.estado_id
       WHERE e.nombre NOT IN ('RECIBIDO', 'CONFIRMADO')
         AND (
           EXISTS (SELECT 1 FROM vale_talleres vt WHERE vt.vale_id = v.id AND vt.taller_id = ? AND vt.activo = 1)
           OR (e.nombre = 'ESPERANDO_AUTORIZACION' AND FIND_IN_SET(?, v.talleres_solicitados) > 0)
         )`,
      [tallerId, String(tallerId)],
      'taller_admin:count_vales_en_proceso'
    );
    return Number(rows[0].n);
  }

  // El límite diario es opcional (NULL = sin límite) — la validación de que,
  // si se define, sea >= 3, vive en adminService (esta capa solo hace el
  // UPDATE, como el resto de este repositorio).
  async actualizarLimiteDiario(tallerId, limiteDiario) {
    return db.query(
      'UPDATE talleres SET limite_diario = ? WHERE id = ?',
      [limiteDiario, tallerId],
      'taller_admin:actualizar_limite_diario'
    );
  }

  async listarPersonalDetalle(tallerId) {
    return db.query(
      `SELECT u.id, u.nombre, u.email, r.nombre AS rol_nombre, u.rol_id, 'encargado' AS tipo_vinculo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN talleres t ON t.encargado_id = u.id AND t.id = ?
       WHERE u.activo = 1
       UNION ALL
       SELECT u.id, u.nombre, u.email, r.nombre AS rol_nombre, u.rol_id, 'tecnico' AS tipo_vinculo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN taller_tecnicos tt ON tt.usuario_id = u.id AND tt.taller_id = ?
       WHERE u.activo = 1
       ORDER BY tipo_vinculo, nombre`,
      [tallerId, tallerId],
      'taller_admin:personal_detalle'
    );
  }

  async asignarEncargado(tallerId, usuarioId) {
    return db.query(
      'UPDATE talleres SET encargado_id = ? WHERE id = ?',
      [usuarioId, tallerId],
      'taller_admin:asignar_encargado'
    );
  }

  // Mismo mecanismo para Técnico (rol 6) y Asistente (rol 7, "clona" el
  // taller elegido) — PK en usuario_id, así que reasignar es un upsert
  // simple (nunca puede quedar en dos talleres).
  async asignarTecnico(usuarioId, tallerId) {
    return db.query(
      'INSERT INTO taller_tecnicos (usuario_id, taller_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE taller_id = VALUES(taller_id)',
      [usuarioId, tallerId],
      'taller_tecnico:asignar'
    );
  }

  async quitarTecnico(usuarioId) {
    return db.query(
      'DELETE FROM taller_tecnicos WHERE usuario_id = ?',
      [usuarioId],
      'taller_tecnico:quitar'
    );
  }
}

module.exports = new TallerAdminRepository();
