// src/modules/admin/repositories/tiendaAdminRepository.js
const db = require('../../../config/database');

class TiendaAdminRepository {
  async listarConDetalle() {
    return db.query(
      `SELECT t.*, p.nombre AS pais_nombre, d.nombre AS departamento_nombre, s.nombre AS subdivision_nombre
       FROM tiendas t
       LEFT JOIN paises p ON p.id = t.pais_id
       JOIN departamentos d ON d.id = t.departamento_id
       LEFT JOIN subdivisiones s ON s.id = t.subdivision_id
       ORDER BY t.orden`,
      [],
      'tienda_admin:list'
    );
  }

  async obtenerPorId(id) {
    const rows = await db.query('SELECT * FROM tiendas WHERE id = ?', [id], 'tienda_admin:find_by_id');
    return rows[0] || null;
  }

  async obtenerPorCodigo(codigo) {
    const rows = await db.query('SELECT * FROM tiendas WHERE codigo = ?', [codigo], 'tienda_admin:find_by_codigo');
    return rows[0] || null;
  }

  async crear({ codigo, nombre, paisId, departamentoId, subdivisionId }) {
    const result = await db.query(
      'INSERT INTO tiendas (codigo, nombre, pais_id, departamento_id, subdivision_id) VALUES (?, ?, ?, ?, ?)',
      [codigo, nombre, paisId || null, departamentoId, subdivisionId || null],
      'tienda_admin:insert'
    );
    return result.insertId;
  }

  async actualizar(id, { codigo, nombre, paisId, departamentoId, subdivisionId, activo }) {
    return db.query(
      'UPDATE tiendas SET codigo = ?, nombre = ?, pais_id = ?, departamento_id = ?, subdivision_id = ?, activo = ? WHERE id = ?',
      [codigo, nombre, paisId || null, departamentoId, subdivisionId || null, activo ? 1 : 0, id],
      'tienda_admin:update'
    );
  }

  async actualizarOrden(ordenes) {
    return db.query('UPDATE tiendas SET orden = ? WHERE id = ? -- (batch)', [ordenes], 'tienda_admin:set_orden');
  }

  async asignarTiendaAUsuario(usuarioId, tiendaId) {
    return db.query('UPDATE usuarios SET tienda_id = ? WHERE id = ?', [tiendaId, usuarioId], 'tienda_admin:asignar_usuario');
  }

  async quitarTiendaDeUsuario(usuarioId) {
    return db.query('UPDATE usuarios SET tienda_id = NULL WHERE id = ?', [usuarioId], 'tienda_admin:quitar_usuario');
  }

  async agregarSupervisorATienda(usuarioId, tiendaId) {
    const result = await db.query(
      'INSERT INTO supervisor_asignaciones (usuario_id, tienda_id) VALUES (?, ?)',
      [usuarioId, tiendaId],
      'supervisor_asignacion:insert_tienda'
    );
    return result.insertId;
  }

  async quitarSupervisorDeTienda(usuarioId, tiendaId) {
    return db.query(
      'DELETE FROM supervisor_asignaciones WHERE usuario_id = ? AND tienda_id = ?',
      [usuarioId, tiendaId],
      'supervisor_asignacion:delete_tienda'
    );
  }

  async listarPersonalDetalle(tiendaId) {
    return db.query(
      `SELECT u.id, u.nombre, u.email, r.nombre AS rol_nombre, u.rol_id,
              CASE WHEN u.tienda_id = ? THEN 'directo' ELSE 'supervisor' END AS tipo_vinculo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.activo = 1 AND (
         u.tienda_id = ? OR
         (u.rol_id = 3 AND EXISTS (
           SELECT 1 FROM supervisor_asignaciones sa
           JOIN tiendas t ON t.id = ?
           WHERE sa.usuario_id = u.id AND sa.activo = 1 AND (
             sa.tienda_id = t.id OR
             (sa.tienda_id IS NULL AND sa.departamento_id = t.departamento_id AND (sa.subdivision_id IS NULL OR sa.subdivision_id = t.subdivision_id))
           )
         ))
       )
       ORDER BY u.nombre`,
      [tiendaId, tiendaId, tiendaId],
      'tienda_admin:personal_detalle'
    );
  }

  async listarTiendaIdsCubiertasDirectamente(usuarioId) {
    const rows = await db.query(
      'SELECT tienda_id FROM supervisor_asignaciones WHERE usuario_id = ? AND activo = 1 AND tienda_id IS NOT NULL',
      [usuarioId],
      'supervisor_asignacion:list_tiendas_directas'
    );
    return rows.map(r => r.tienda_id);
  }

  // analisis_correcciones_15.md #10: además de los nombres (para el texto de
  // ayuda), se devuelven los ids — el selector en cascada de "Tiendas
  // supervisadas" los necesita para saber CUÁLES tiendas concretas quedan
  // pre-marcadas (y bloqueadas) por venir de una cobertura heredada.
  async listarCoberturaHeredada(usuarioId) {
    return db.query(
      `SELECT sa.departamento_id, sa.subdivision_id, d.nombre AS departamento_nombre, s.nombre AS subdivision_nombre
       FROM supervisor_asignaciones sa
       JOIN departamentos d ON d.id = sa.departamento_id
       LEFT JOIN subdivisiones s ON s.id = sa.subdivision_id
       WHERE sa.usuario_id = ? AND sa.activo = 1 AND sa.tienda_id IS NULL`,
      [usuarioId],
      'supervisor_asignacion:list_heredada'
    );
  }

  async listarDepartamentos() {
    return db.query('SELECT * FROM departamentos WHERE activo = 1 ORDER BY nombre', [], 'organizacion:departamentos');
  }

  async listarSubdivisiones() {
    return db.query('SELECT * FROM subdivisiones WHERE activo = 1 ORDER BY nombre', [], 'organizacion:subdivisiones');
  }
}

module.exports = new TiendaAdminRepository();
