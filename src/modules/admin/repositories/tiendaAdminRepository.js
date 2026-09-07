// src/modules/admin/repositories/tiendaAdminRepository.js
const db = require('../../../config/database');

class TiendaAdminRepository {
  // analisis_correcciones_18.md #5: `tiendas` ya no tiene `pais_id`/`nombre`
  // propios — el país sale de la empresa dueña y el nombre a mostrar se
  // deriva como "{EMPRESA}, {SUBDIVISIÓN}" (o solo "{EMPRESA}" sin
  // subdivisión).
  async listarConDetalle() {
    return db.query(
      `SELECT t.*, e.nombre AS empresa_nombre, e.pais_id AS pais_id, p.nombre AS pais_nombre,
              d.nombre AS departamento_nombre, s.nombre AS subdivision_nombre,
              CONCAT(e.nombre, IF(s.nombre IS NOT NULL, CONCAT(', ', s.nombre), '')) AS nombre
       FROM tiendas t
       JOIN empresas e ON e.id = t.empresa_id
       LEFT JOIN paises p ON p.id = e.pais_id
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

  async crear({ codigo, empresaId, departamentoId, subdivisionId }) {
    const result = await db.query(
      'INSERT INTO tiendas (codigo, empresa_id, departamento_id, subdivision_id) VALUES (?, ?, ?, ?)',
      [codigo, empresaId, departamentoId, subdivisionId || null],
      'tienda_admin:insert'
    );
    return result.insertId;
  }

  async actualizar(id, { codigo, empresaId, departamentoId, subdivisionId, activo }) {
    return db.query(
      'UPDATE tiendas SET codigo = ?, empresa_id = ?, departamento_id = ?, subdivision_id = ?, activo = ? WHERE id = ?',
      [codigo, empresaId, departamentoId, subdivisionId || null, activo ? 1 : 0, id],
      'tienda_admin:update'
    );
  }

  // analisis_correcciones_18.md #3: crea una subdivisión nueva desde el modal
  // "Nueva tienda" (radio "crear nueva") — con su propio país, ya que un
  // departamento puede agrupar subdivisiones de varios países.
  async crearSubdivision(departamentoId, nombre, paisId) {
    const result = await db.query(
      'INSERT INTO subdivisiones (departamento_id, nombre, pais_id) VALUES (?, ?, ?)',
      [departamentoId, nombre, paisId],
      'subdivision:insert'
    );
    return result.insertId;
  }

  async actualizarOrden(ordenes) {
    return db.query('UPDATE tiendas SET orden = ? WHERE id = ? -- (batch)', [ordenes], 'tienda_admin:set_orden');
  }

  // analisis_correcciones_18.md #5: reemplaza `supervisor_asignaciones` — un
  // supervisor cubre tiendas concretas, sin cobertura "heredada" por
  // departamento/subdivisión.
  async agregarSupervisorATienda(usuarioId, tiendaId) {
    const result = await db.query(
      'INSERT INTO supervisor_tiendas (usuario_id, tienda_id) VALUES (?, ?)',
      [usuarioId, tiendaId],
      'supervisor_tienda:insert'
    );
    return result.insertId;
  }

  async quitarSupervisorDeTienda(usuarioId, tiendaId) {
    return db.query(
      'DELETE FROM supervisor_tiendas WHERE usuario_id = ? AND tienda_id = ?',
      [usuarioId, tiendaId],
      'supervisor_tienda:delete'
    );
  }

  async listarPersonalDetalle(tiendaId) {
    return db.query(
      `SELECT u.id, u.nombre, u.email, r.nombre AS rol_nombre, u.rol_id, 'directo' AS tipo_vinculo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN asesores a ON a.usuario_id = u.id AND a.tienda_id = ?
       WHERE u.activo = 1
       UNION ALL
       SELECT u.id, u.nombre, u.email, r.nombre AS rol_nombre, u.rol_id, 'directo' AS tipo_vinculo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN talleres tal ON tal.encargado_id = u.id
       JOIN encargado_tienda et ON et.taller_id = tal.id AND et.tienda_id = ?
       WHERE u.activo = 1
       UNION ALL
       SELECT u.id, u.nombre, u.email, r.nombre AS rol_nombre, u.rol_id, 'directo' AS tipo_vinculo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN taller_tecnicos tt ON tt.usuario_id = u.id
       JOIN encargado_tienda et ON et.taller_id = tt.taller_id AND et.tienda_id = ?
       WHERE u.activo = 1
       UNION ALL
       SELECT u.id, u.nombre, u.email, r.nombre AS rol_nombre, u.rol_id, 'supervisor' AS tipo_vinculo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN supervisor_tiendas st ON st.usuario_id = u.id AND st.tienda_id = ?
       WHERE u.activo = 1 AND u.rol_id = 3
       ORDER BY nombre`,
      [tiendaId, tiendaId, tiendaId, tiendaId],
      'tienda_admin:personal_detalle'
    );
  }

  async listarTiendaIdsCubiertasDirectamente(usuarioId) {
    const rows = await db.query(
      'SELECT tienda_id FROM supervisor_tiendas WHERE usuario_id = ?',
      [usuarioId],
      'supervisor_tienda:list_by_usuario'
    );
    return rows.map(r => r.tienda_id);
  }

  async listarDepartamentos() {
    return db.query('SELECT * FROM departamentos WHERE activo = 1 ORDER BY nombre', [], 'organizacion:departamentos');
  }

  async listarPaises() {
    return db.query('SELECT id, codigo, nombre, codigo_telefono FROM paises ORDER BY nombre', [], 'catalog:paises');
  }

  // analisis_correcciones_19.md #9: crea un departamento nuevo desde el modal
  // "Nueva tienda" (radio "crear nuevo") — siempre de un solo país (el caso
  // multi-país como "Ventas Centroamérica" sigue siendo exclusivo del seed).
  async crearDepartamento(nombre, paisId) {
    const result = await db.query(
      'INSERT INTO departamentos (nombre, pais_id) VALUES (?, ?)',
      [nombre, paisId],
      'departamento:insert'
    );
    return result.insertId;
  }

  async listarSubdivisiones() {
    return db.query('SELECT * FROM subdivisiones WHERE activo = 1 ORDER BY nombre', [], 'organizacion:subdivisiones');
  }

  // analisis_correcciones_18.md #5: catálogo de empresas para el selector de
  // "Nueva tienda" (reemplaza al viejo selector de País).
  async listarEmpresas() {
    return db.query('SELECT * FROM empresas ORDER BY nombre', [], 'organizacion:empresas');
  }
}

module.exports = new TiendaAdminRepository();
