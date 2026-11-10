// src/modules/admin/repositories/tallerAdminRepository.js
// Asignación de talleres desde el panel de administración —
// `talleres.encargado_id` y `taller_disenadores` se actualizan desde aquí.
const db = require('../../../config/database');

class TallerAdminRepository {
  // Incluye los talleres inactivos: la pestaña necesita mostrarlos para poder
  // reactivarlos. Los activos van primero.
  async listarConDetalle() {
    return db.query(
      `SELECT t.id, t.nombre, t.encargado_id, t.tienda_id, t.limite_diario, TIME_FORMAT(t.hora_maxima_recepcion, '%H:%i') AS hora_maxima_recepcion, t.activo, u.nombre AS encargado_nombre,
              ti.codigo AS tienda_codigo,
              (SELECT COUNT(*) FROM taller_local_tiendas lt WHERE lt.taller_id = t.id) AS tiendas_atendidas_count,
              CONCAT(e.nombre, IF(s.nombre IS NOT NULL, CONCAT(', ', s.nombre), '')) AS tienda_nombre,
              (SELECT COUNT(*) FROM taller_disenadores tt WHERE tt.taller_id = t.id) AS disenadores_count
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

  // El Diseño Local cuya SEDE es la tienda (activo o no): una sede tiene uno solo.
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

  async obtenerTallerDeDisenador(usuarioId) {
    const rows = await db.query(
      `SELECT t.id, t.nombre FROM taller_disenadores tt JOIN talleres t ON t.id = tt.taller_id WHERE tt.usuario_id = ? LIMIT 1`,
      [usuarioId],
      'taller_admin:find_by_disenador'
    );
    return rows[0] || null;
  }

  // Un Diseño Local tiene una tienda sede (`talleres.tienda_id`) y nace atendiéndola
  // (`taller_local_tiendas`, de donde sale su elegibilidad); todo en una transacción.
  async crearLocal({ nombre, tiendaId, encargadoId }) {
    return db.transaccion(async (tx) => {
      const result = await tx.query(
        'INSERT INTO talleres (nombre, encargado_id, tienda_id, activo) VALUES (?, ?, ?, 1)',
        [nombre, encargadoId || null, tiendaId],
        'taller_admin:insert_local'
      );
      const id = result.insertId;
      await tx.query('INSERT INTO taller_tiendas (taller_id, tienda_id) VALUES (?, ?)', [id, tiendaId], 'taller_admin:insert_taller_tienda');
      await tx.query('INSERT INTO taller_local_tiendas (taller_id, tienda_id) VALUES (?, ?)', [id, tiendaId], 'taller_admin:insert_local_tienda_sede');
      return id;
    });
  }

  // Tiendas que atiende un Local, la sede primero.
  async listarTiendasDeLocal(tallerId) {
    return db.query(
      `SELECT ti.id, ti.codigo, ti.activo, p.nombre AS pais_nombre,
              CONCAT(e.nombre, IF(s.nombre IS NOT NULL, CONCAT(', ', s.nombre), '')) AS nombre,
              (ti.id = t.tienda_id) AS es_sede
       FROM taller_local_tiendas lt
       JOIN talleres t ON t.id = lt.taller_id
       JOIN tiendas ti ON ti.id = lt.tienda_id
       JOIN empresas e ON e.id = ti.empresa_id
       LEFT JOIN paises p ON p.id = e.pais_id
       LEFT JOIN subdivisiones s ON s.id = ti.subdivision_id
       WHERE lt.taller_id = ?
       ORDER BY es_sede DESC, p.nombre, ti.codigo`,
      [tallerId],
      'taller_admin:tiendas_de_local'
    );
  }

  async agregarTiendaALocal(tallerId, tiendaId) {
    return db.query('INSERT INTO taller_local_tiendas (taller_id, tienda_id) VALUES (?, ?)', [tallerId, tiendaId], 'taller_admin:agregar_tienda_local');
  }

  async quitarTiendaDeLocal(tallerId, tiendaId) {
    return db.query('DELETE FROM taller_local_tiendas WHERE taller_id = ? AND tienda_id = ?', [tallerId, tiendaId], 'taller_admin:quitar_tienda_local');
  }

  // Talleres con su país (el de la tienda sede, igual que el calendario) para agrupar «Propuestas compartidas».
  async listarParaPropuestasCompartidas() {
    return db.query(
      `SELECT t.id, t.nombre, t.activo, t.comparte_propuestas, t.tienda_id, px.id AS pais_id, px.nombre AS pais_nombre
       FROM talleres t
       LEFT JOIN tiendas ti ON ti.id = t.tienda_id
       LEFT JOIN departamentos d ON d.id = ti.departamento_id
       LEFT JOIN subdivisiones s ON s.id = ti.subdivision_id
       LEFT JOIN empresas e ON e.id = ti.empresa_id
       LEFT JOIN paises px ON px.id = COALESCE(d.pais_id, s.pais_id, e.pais_id)
       ORDER BY t.activo DESC, t.nombre`,
      [],
      'taller_admin:propuestas_compartidas'
    );
  }

  async actualizarComparteDePropuestas(tallerId, comparte) {
    return db.query('UPDATE talleres SET comparte_propuestas = ? WHERE id = ?', [comparte ? 1 : 0, tallerId], 'taller_admin:comparte_propuestas');
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

  async actualizarHoraMaxima(tallerId, hora) {
    return db.query(
      'UPDATE talleres SET hora_maxima_recepcion = ? WHERE id = ?',
      [hora, tallerId],
      'taller_admin:actualizar_hora_maxima'
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
       SELECT u.id, u.nombre, u.email, r.nombre AS rol_nombre, u.rol_id, 'disenador' AS tipo_vinculo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN taller_disenadores tt ON tt.usuario_id = u.id AND tt.taller_id = ?
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

  // Mismo mecanismo para Diseñador (rol 6) y roles de asistente (varios por taller; el
  // taller se valida en el servicio) — PK en usuario_id, así que reasignar es un upsert
  // simple (nunca puede quedar en dos talleres).
  async asignarDisenador(usuarioId, tallerId) {
    return db.query(
      'INSERT INTO taller_disenadores (usuario_id, taller_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE taller_id = VALUES(taller_id)',
      [usuarioId, tallerId],
      'taller_disenador:asignar'
    );
  }

  async quitarDisenador(usuarioId) {
    return db.query(
      'DELETE FROM taller_disenadores WHERE usuario_id = ?',
      [usuarioId],
      'taller_disenador:quitar'
    );
  }
}

module.exports = new TallerAdminRepository();
