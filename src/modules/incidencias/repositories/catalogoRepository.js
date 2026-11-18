// src/modules/incidencias/repositories/catalogoRepository.js
// Lectura de la configuración que usa el formulario y las reglas (la edición vive en configRepository, fase 3).
const db = require('../../../config/database');

const FROM_TIENDA = `FROM tiendas t
  JOIN empresas e ON e.id = t.empresa_id
  JOIN paises p ON p.id = e.pais_id
  JOIN departamentos d ON d.id = t.departamento_id
  LEFT JOIN subdivisiones s ON s.id = t.subdivision_id
  LEFT JOIN incidencia_paises ip ON ip.pais_id = p.id`;

const COLUMNAS_TIENDA = `t.id, t.codigo, t.activo, e.nombre AS empresa, d.nombre AS departamento, s.nombre AS subdivision,
  p.id AS pais_id, p.codigo AS pais_codigo, p.nombre AS pais, COALESCE(ip.habilitado, 0) AS pais_habilitado, ip.aviso AS pais_aviso`;

class CatalogoRepository {
  // Una tienda con su empresa, su país y si ese país está habilitado.
  async tienda(tiendaId, ejecutor = db) {
    const filas = await ejecutor.query(`SELECT ${COLUMNAS_TIENDA} ${FROM_TIENDA} WHERE t.id = ?`, [tiendaId], 'incidencias_catalogo:tienda');
    return filas[0] || null;
  }

  // Tiendas activas de los países habilitados: las que se pueden elegir al reportar.
  async tiendasDisponibles() {
    return db.query(
      `SELECT ${COLUMNAS_TIENDA} ${FROM_TIENDA} WHERE t.activo = 1 AND ip.habilitado = 1 ORDER BY p.nombre, e.nombre, t.codigo`,
      [], 'incidencias_catalogo:tiendas');
  }

  // La tienda propia de quien reporta: la del asesor o, si es supervisor, la primera que supervisa.
  async tiendaPropia(usuarioId) {
    const filas = await db.query(
      `SELECT tienda_id FROM (
         SELECT a.tienda_id, 1 AS prioridad FROM asesores a WHERE a.usuario_id = ? AND a.tienda_id IS NOT NULL
         UNION ALL SELECT st.tienda_id, 2 FROM supervisor_tiendas st WHERE st.usuario_id = ?
       ) x ORDER BY prioridad, tienda_id LIMIT 1`,
      [usuarioId, usuarioId], 'incidencias_catalogo:tienda_propia');
    return filas[0] ? filas[0].tienda_id : null;
  }

  async paises() {
    return db.query(
      `SELECT p.id, p.codigo, p.nombre, COALESCE(ip.habilitado, 0) AS habilitado, ip.aviso
       FROM paises p LEFT JOIN incidencia_paises ip ON ip.pais_id = p.id ORDER BY p.nombre`, [], 'incidencias_catalogo:paises');
  }

  async zonas() {
    return db.query('SELECT id, nombre, tienda_id FROM incidencia_zonas WHERE activo = 1 ORDER BY orden, nombre', [], 'incidencias_catalogo:zonas');
  }

  // Una zona sirve si es general (sin tienda) o es de esa tienda.
  async zonaValida(zonaId, tiendaId) {
    const filas = await db.query(
      'SELECT id FROM incidencia_zonas WHERE id = ? AND activo = 1 AND (tienda_id IS NULL OR tienda_id = ?)', [zonaId, tiendaId], 'incidencias_catalogo:zona_valida');
    return filas.length > 0;
  }

  async categorias() {
    return db.query(
      `SELECT c.id, c.nombre, c.especialidad_id, e.nombre AS especialidad FROM incidencia_categorias c
       LEFT JOIN incidencia_especialidades e ON e.id = c.especialidad_id WHERE c.activo = 1 ORDER BY c.orden, c.nombre`,
      [], 'incidencias_catalogo:categorias');
  }

  async categoria(categoriaId) {
    const filas = await db.query('SELECT id, nombre, especialidad_id FROM incidencia_categorias WHERE id = ? AND activo = 1', [categoriaId], 'incidencias_catalogo:categoria');
    return filas[0] || null;
  }

  async tiposDeActivo() {
    return db.query('SELECT id, categoria_id, nombre FROM incidencia_tipos_activo WHERE activo = 1 ORDER BY orden, nombre', [], 'incidencias_catalogo:tipos');
  }

  async tipoValido(tipoId, categoriaId) {
    const filas = await db.query('SELECT id FROM incidencia_tipos_activo WHERE id = ? AND categoria_id = ? AND activo = 1', [tipoId, categoriaId], 'incidencias_catalogo:tipo_valido');
    return filas.length > 0;
  }

  // Prioridades activas de la más urgente a la menos urgente.
  async prioridades(ejecutor = db) {
    return ejecutor.query('SELECT id, codigo, nombre, color, orden FROM incidencia_prioridades WHERE activo = 1 ORDER BY orden', [], 'incidencias_catalogo:prioridades');
  }

  async prioridad(prioridadId, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id, codigo, nombre, color, orden FROM incidencia_prioridades WHERE id = ? AND activo = 1', [prioridadId], 'incidencias_catalogo:prioridad');
    return filas[0] || null;
  }

  // impacto → prioridad (la regla que edita el administrador).
  async reglas() {
    return db.query(
      `SELECT r.impacto, r.prioridad_id FROM incidencia_reglas_prioridad r`, [], 'incidencias_catalogo:reglas');
  }

  async motivosEspera() {
    return db.query('SELECT id, nombre FROM incidencia_motivos_espera WHERE activo = 1 ORDER BY orden, nombre', [], 'incidencias_catalogo:motivos_espera');
  }

  async motivoEspera(motivoId) {
    const filas = await db.query('SELECT id, nombre FROM incidencia_motivos_espera WHERE id = ? AND activo = 1', [motivoId], 'incidencias_catalogo:motivo_espera');
    return filas[0] || null;
  }
}

module.exports = new CatalogoRepository();
