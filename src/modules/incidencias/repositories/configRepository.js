// src/modules/incidencias/repositories/configRepository.js
// Todo el SQL de la configuración del módulo: países, catálogos, prioridades y reglas, técnicos, verificadores, roles, parámetros e historial.
const db = require('../../../config/database');

// Los catálogos editables: la tabla, las columnas que se pueden escribir y qué otras tablas dependen de ella.
const CATALOGOS = {
  especialidades: { tabla: 'incidencia_especialidades', columnas: ['nombre', 'orden', 'activo'] },
  categorias: { tabla: 'incidencia_categorias', columnas: ['nombre', 'especialidad_id', 'orden', 'activo'] },
  zonas: { tabla: 'incidencia_zonas', columnas: ['nombre', 'tienda_id', 'orden', 'activo'] },
  'tipos-activo': { tabla: 'incidencia_tipos_activo', columnas: ['categoria_id', 'nombre', 'orden', 'activo'] },
  'motivos-espera': { tabla: 'incidencia_motivos_espera', columnas: ['nombre', 'orden', 'activo'] }
};

const LISTADOS = {
  especialidades: `SELECT e.id, e.nombre, e.orden, e.activo,
      (SELECT COUNT(*) FROM incidencia_categorias c WHERE c.especialidad_id = e.id AND c.activo = 1) AS categorias,
      (SELECT COUNT(*) FROM incidencia_tecnico_especialidades te WHERE te.especialidad_id = e.id) AS tecnicos
    FROM incidencia_especialidades e ORDER BY e.orden, e.nombre`,
  categorias: `SELECT c.id, c.nombre, c.especialidad_id, es.nombre AS especialidad, c.orden, c.activo,
      (SELECT GROUP_CONCAT(ta.nombre ORDER BY ta.orden, ta.nombre SEPARATOR ', ') FROM incidencia_tipos_activo ta WHERE ta.categoria_id = c.id AND ta.activo = 1) AS tipos,
      (SELECT COUNT(*) FROM incidencias i WHERE i.categoria_id = c.id AND i.creado_en >= NOW() - INTERVAL 30 DAY) AS incidencias30
    FROM incidencia_categorias c LEFT JOIN incidencia_especialidades es ON es.id = c.especialidad_id ORDER BY c.orden, c.nombre`,
  zonas: `SELECT z.id, z.nombre, z.tienda_id, t.codigo AS tienda, z.orden, z.activo,
      (SELECT COUNT(*) FROM incidencias i WHERE i.zona_id = z.id) AS usos
    FROM incidencia_zonas z LEFT JOIN tiendas t ON t.id = z.tienda_id ORDER BY z.orden, z.nombre`,
  'tipos-activo': `SELECT ta.id, ta.categoria_id, c.nombre AS categoria, ta.nombre, ta.orden, ta.activo,
      (SELECT COUNT(*) FROM incidencias i WHERE i.tipo_activo_id = ta.id) AS usos
    FROM incidencia_tipos_activo ta JOIN incidencia_categorias c ON c.id = ta.categoria_id ORDER BY c.orden, ta.orden, ta.nombre`,
  'motivos-espera': `SELECT m.id, m.nombre, m.orden, m.activo FROM incidencia_motivos_espera m ORDER BY m.orden, m.nombre`
};

const CONSULTA_USUARIO_PERMISO = (codigo) => `EXISTS (SELECT 1 FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE rp.rol_id = u.rol_id AND p.codigo = '${codigo}')`;

class ConfigRepository {
  definicion(catalogo) { return CATALOGOS[catalogo] || null; }

  // --- Países ---

  async paises() {
    return db.query(
      `SELECT p.id, p.codigo, p.nombre, COALESCE(ip.habilitado, 0) AS habilitado, ip.aviso,
         (SELECT COUNT(*) FROM tiendas t JOIN empresas e ON e.id = t.empresa_id WHERE e.pais_id = p.id AND t.activo = 1) AS tiendas,
         (SELECT COUNT(*) FROM incidencias i JOIN tiendas t ON t.id = i.tienda_id JOIN empresas e ON e.id = t.empresa_id
           WHERE e.pais_id = p.id AND i.creado_en >= NOW() - INTERVAL 30 DAY) AS incidencias30
       FROM paises p LEFT JOIN incidencia_paises ip ON ip.pais_id = p.id ORDER BY (p.codigo = 'GT') DESC, p.nombre`,
      [], 'incidencias_config:paises');
  }

  async pais(paisId) {
    const filas = await db.query('SELECT p.id, p.nombre, COALESCE(ip.habilitado, 0) AS habilitado, ip.aviso FROM paises p LEFT JOIN incidencia_paises ip ON ip.pais_id = p.id WHERE p.id = ?', [paisId], 'incidencias_config:pais');
    return filas[0] || null;
  }

  async guardarPais(paisId, habilitado, aviso) {
    await db.query(
      'INSERT INTO incidencia_paises (pais_id, habilitado, aviso) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE habilitado = VALUES(habilitado), aviso = VALUES(aviso)',
      [paisId, habilitado ? 1 : 0, aviso], 'incidencias_config:guardar_pais');
  }

  // --- Catálogos ---

  async listarCatalogo(catalogo) {
    return db.query(LISTADOS[catalogo], [], `incidencias_config:catalogo_${catalogo}`);
  }

  async obtenerDeCatalogo(catalogo, id) {
    const filas = await db.query(`SELECT * FROM \`${CATALOGOS[catalogo].tabla}\` WHERE id = ?`, [id], 'incidencias_config:catalogo_obtener');
    return filas[0] || null;
  }

  async siguienteOrden(catalogo) {
    const filas = await db.query(`SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM \`${CATALOGOS[catalogo].tabla}\``, [], 'incidencias_config:orden');
    return Number(filas[0].n);
  }

  // ¿Ya existe otro registro con ese nombre dentro del mismo ámbito (la categoría de un activo, la tienda de una zona)?
  async nombreEnUso(catalogo, nombre, { excluirId = null, categoriaId = null, tiendaId = null } = {}) {
    const tabla = CATALOGOS[catalogo].tabla;
    const donde = ['nombre = ?'];
    const params = [nombre];
    if (catalogo === 'tipos-activo') { donde.push('categoria_id = ?'); params.push(categoriaId); }
    if (catalogo === 'zonas') { donde.push(tiendaId ? 'tienda_id = ?' : 'tienda_id IS NULL'); if (tiendaId) params.push(tiendaId); }
    if (excluirId) { donde.push('id <> ?'); params.push(excluirId); }
    const filas = await db.query(`SELECT id FROM \`${tabla}\` WHERE ${donde.join(' AND ')} LIMIT 1`, params, 'incidencias_config:nombre_en_uso');
    return filas.length > 0;
  }

  async insertarEnCatalogo(catalogo, datos) {
    const def = CATALOGOS[catalogo];
    const columnas = def.columnas.filter(c => datos[c] !== undefined);
    const r = await db.query(`INSERT INTO \`${def.tabla}\` (${columnas.map(c => `\`${c}\``).join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
      columnas.map(c => datos[c]), 'incidencias_config:catalogo_insertar');
    return r.insertId;
  }

  async actualizarEnCatalogo(catalogo, id, datos) {
    const def = CATALOGOS[catalogo];
    const columnas = def.columnas.filter(c => datos[c] !== undefined);
    if (!columnas.length) return;
    await db.query(`UPDATE \`${def.tabla}\` SET ${columnas.map(c => `\`${c}\` = ?`).join(', ')} WHERE id = ?`,
      [...columnas.map(c => datos[c]), id], 'incidencias_config:catalogo_actualizar');
  }

  async existe(tabla, id) {
    const permitidas = ['incidencia_especialidades', 'incidencia_categorias', 'tiendas', 'usuarios', 'incidencia_prioridades'];
    if (!permitidas.includes(tabla)) throw new Error('Tabla no permitida.');
    const filas = await db.query(`SELECT id FROM \`${tabla}\` WHERE id = ?`, [id], 'incidencias_config:existe');
    return filas.length > 0;
  }

  // --- Prioridades y reglas ---

  async prioridades() {
    return db.query(
      `SELECT p.id, p.codigo, p.nombre, p.color, p.orden, p.activo,
         (SELECT COUNT(*) FROM incidencias i WHERE i.prioridad_id = p.id AND i.estado NOT IN ('cerrada','descartada')) AS abiertas
       FROM incidencia_prioridades p ORDER BY p.activo DESC, p.orden`, [], 'incidencias_config:prioridades');
  }

  async prioridad(id) {
    const filas = await db.query('SELECT id, codigo, nombre, color, orden, activo FROM incidencia_prioridades WHERE id = ?', [id], 'incidencias_config:prioridad');
    return filas[0] || null;
  }

  async codigoDePrioridadEnUso(codigo) {
    const filas = await db.query('SELECT id FROM incidencia_prioridades WHERE codigo = ?', [codigo], 'incidencias_config:codigo_prioridad');
    return filas.length > 0;
  }

  async insertarPrioridad(d) {
    const r = await db.query('INSERT INTO incidencia_prioridades (codigo, nombre, color, orden) VALUES (?, ?, ?, ?)', [d.codigo, d.nombre, d.color, d.orden], 'incidencias_config:prioridad_insertar');
    return r.insertId;
  }

  async actualizarPrioridad(id, d) {
    const columnas = ['nombre', 'color', 'orden', 'activo'].filter(c => d[c] !== undefined);
    if (!columnas.length) return;
    await db.query(`UPDATE incidencia_prioridades SET ${columnas.map(c => `\`${c}\` = ?`).join(', ')} WHERE id = ?`, [...columnas.map(c => d[c]), id], 'incidencias_config:prioridad_actualizar');
  }

  async reglas() {
    return db.query('SELECT impacto, prioridad_id FROM incidencia_reglas_prioridad', [], 'incidencias_config:reglas');
  }

  // Los impactos que usan una prioridad (para no apagarla mientras alguna regla la usa).
  async impactosQueUsan(prioridadId) {
    const filas = await db.query('SELECT impacto FROM incidencia_reglas_prioridad WHERE prioridad_id = ?', [prioridadId], 'incidencias_config:impactos_que_usan');
    return filas.map(f => f.impacto);
  }

  async guardarReglas(reglas) {
    await db.transaccion(async (tx) => {
      for (const r of reglas) {
        await tx.query('INSERT INTO incidencia_reglas_prioridad (impacto, prioridad_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE prioridad_id = VALUES(prioridad_id)', [r.impacto, r.prioridadId], 'incidencias_config:guardar_regla');
      }
    });
  }

  // --- Técnicos ---

  async tecnicos() {
    const filas = await db.query(
      `SELECT tc.usuario_id, u.nombre, u.email, ro.nombre AS rol, tc.activo, tc.todas_las_tiendas,
         ${CONSULTA_USUARIO_PERMISO('incidencias.resolver')} AS con_permiso,
         (SELECT COUNT(*) FROM incidencias i WHERE i.tecnico_id = tc.usuario_id AND i.estado IN ('en_proceso','en_espera','correccion_pedida','en_verificacion')) AS abiertas
       FROM incidencia_tecnicos tc JOIN usuarios u ON u.id = tc.usuario_id JOIN roles ro ON ro.id = u.rol_id ORDER BY tc.activo DESC, u.nombre`,
      [], 'incidencias_config:tecnicos');
    if (!filas.length) return [];
    const ids = filas.map(f => f.usuario_id);
    const [especialidades, tiendas] = await Promise.all([
      db.query('SELECT te.usuario_id, e.id, e.nombre FROM incidencia_tecnico_especialidades te JOIN incidencia_especialidades e ON e.id = te.especialidad_id WHERE te.usuario_id IN (?) ORDER BY e.orden', [ids], 'incidencias_config:tecnicos_especialidades'),
      db.query('SELECT tt.usuario_id, t.id, t.codigo FROM incidencia_tecnico_tiendas tt JOIN tiendas t ON t.id = tt.tienda_id WHERE tt.usuario_id IN (?) ORDER BY t.codigo', [ids], 'incidencias_config:tecnicos_tiendas')
    ]);
    return filas.map(f => ({
      ...f,
      especialidades: especialidades.filter(e => e.usuario_id === f.usuario_id).map(e => ({ id: e.id, nombre: e.nombre })),
      tiendas: tiendas.filter(t => t.usuario_id === f.usuario_id).map(t => ({ id: t.id, codigo: t.codigo }))
    }));
  }

  async tecnico(usuarioId) {
    const filas = await db.query('SELECT usuario_id, activo, todas_las_tiendas FROM incidencia_tecnicos WHERE usuario_id = ?', [usuarioId], 'incidencias_config:tecnico');
    return filas[0] || null;
  }

  async usuarioActivo(usuarioId) {
    const filas = await db.query('SELECT id, nombre FROM usuarios WHERE id = ? AND activo = 1', [usuarioId], 'incidencias_config:usuario_activo');
    return filas[0] || null;
  }

  // Personas que todavía no son técnicos, para el selector de «Agregar técnico».
  async candidatosTecnico(q) {
    const params = [];
    let filtro = '';
    if (q) { filtro = ' AND (u.nombre LIKE ? OR u.email LIKE ?)'; const like = `%${String(q).replace(/[\\%_]/g, m => `\\${m}`)}%`; params.push(like, like); }
    return db.query(
      `SELECT u.id, u.nombre, u.email, ro.nombre AS rol, ${CONSULTA_USUARIO_PERMISO('incidencias.resolver')} AS con_permiso
       FROM usuarios u JOIN roles ro ON ro.id = u.rol_id
       WHERE u.activo = 1 AND NOT EXISTS (SELECT 1 FROM incidencia_tecnicos tc WHERE tc.usuario_id = u.id)${filtro}
       ORDER BY u.nombre LIMIT 20`, params, 'incidencias_config:candidatos');
  }

  // Personas activas para el selector de «Asignar verificador» (cualquiera puede ser verificador; el listado avisa si su rol no puede verificar).
  async personasParaVerificar(q) {
    const params = [];
    let filtro = '';
    if (q) { filtro = ' AND (u.nombre LIKE ? OR u.email LIKE ?)'; const like = `%${String(q).replace(/[\\%_]/g, m => `\\${m}`)}%`; params.push(like, like); }
    return db.query(
      `SELECT u.id, u.nombre, u.email, ro.nombre AS rol, ${CONSULTA_USUARIO_PERMISO('incidencias.verificar')} AS con_permiso
       FROM usuarios u JOIN roles ro ON ro.id = u.rol_id WHERE u.activo = 1${filtro} ORDER BY u.nombre LIMIT 20`, params, 'incidencias_config:personas_verificar');
  }

  async abiertasDeTecnico(usuarioId) {
    const filas = await db.query("SELECT COUNT(*) AS n FROM incidencias WHERE tecnico_id = ? AND estado IN ('en_proceso','en_espera','correccion_pedida','en_verificacion')", [usuarioId], 'incidencias_config:abiertas_tecnico');
    return Number(filas[0].n);
  }

  async guardarTecnico(usuarioId, { activo, todasLasTiendas, especialidadIds, tiendaIds }, nuevo) {
    await db.transaccion(async (tx) => {
      if (nuevo) await tx.query('INSERT INTO incidencia_tecnicos (usuario_id, activo, todas_las_tiendas) VALUES (?, ?, ?)', [usuarioId, activo ? 1 : 0, todasLasTiendas ? 1 : 0], 'incidencias_config:tecnico_insertar');
      else await tx.query('UPDATE incidencia_tecnicos SET activo = ?, todas_las_tiendas = ? WHERE usuario_id = ?', [activo ? 1 : 0, todasLasTiendas ? 1 : 0, usuarioId], 'incidencias_config:tecnico_actualizar');
      await tx.query('DELETE FROM incidencia_tecnico_especialidades WHERE usuario_id = ?', [usuarioId], 'incidencias_config:tecnico_borrar_esp');
      if (especialidadIds.length) await tx.query('INSERT INTO incidencia_tecnico_especialidades (usuario_id, especialidad_id) VALUES ?', [especialidadIds.map(e => [usuarioId, e])], 'incidencias_config:tecnico_esp');
      await tx.query('DELETE FROM incidencia_tecnico_tiendas WHERE usuario_id = ?', [usuarioId], 'incidencias_config:tecnico_borrar_tiendas');
      if (!todasLasTiendas && tiendaIds.length) await tx.query('INSERT INTO incidencia_tecnico_tiendas (usuario_id, tienda_id) VALUES ?', [tiendaIds.map(t => [usuarioId, t])], 'incidencias_config:tecnico_tiendas');
    });
  }

  // --- Verificadores ---

  async verificadores() {
    return db.query(
      `SELECT v.id, v.usuario_id, u.nombre, v.tienda_id, v.pais_id, ${CONSULTA_USUARIO_PERMISO('incidencias.verificar')} AS con_permiso
       FROM incidencia_verificadores v JOIN usuarios u ON u.id = v.usuario_id AND u.activo = 1 ORDER BY u.nombre`,
      [], 'incidencias_config:verificadores');
  }

  // Las tiendas activas de los países habilitados: donde importa tener quién verifique.
  async tiendasHabilitadas() {
    return db.query(
      `SELECT t.id, t.codigo, e.nombre AS empresa, d.nombre AS departamento, s.nombre AS subdivision, p.id AS pais_id, p.nombre AS pais
       FROM tiendas t JOIN empresas e ON e.id = t.empresa_id JOIN paises p ON p.id = e.pais_id
       JOIN departamentos d ON d.id = t.departamento_id LEFT JOIN subdivisiones s ON s.id = t.subdivision_id
       JOIN incidencia_paises ip ON ip.pais_id = p.id AND ip.habilitado = 1
       WHERE t.activo = 1 ORDER BY p.nombre, e.nombre, t.codigo`, [], 'incidencias_config:tiendas_habilitadas');
  }

  async verificadorExiste(usuarioId, tiendaId, paisId) {
    const filas = await db.query(
      tiendaId ? 'SELECT id FROM incidencia_verificadores WHERE usuario_id = ? AND tienda_id = ?' : 'SELECT id FROM incidencia_verificadores WHERE usuario_id = ? AND pais_id = ?',
      [usuarioId, tiendaId || paisId], 'incidencias_config:verificador_existe');
    return filas.length > 0;
  }

  async agregarVerificador(usuarioId, tiendaId, paisId) {
    const r = await db.query('INSERT INTO incidencia_verificadores (usuario_id, tienda_id, pais_id) VALUES (?, ?, ?)', [usuarioId, tiendaId || null, tiendaId ? null : paisId], 'incidencias_config:verificador_insertar');
    return r.insertId;
  }

  async verificador(id) {
    const filas = await db.query('SELECT v.id, v.usuario_id, u.nombre, v.tienda_id, v.pais_id FROM incidencia_verificadores v JOIN usuarios u ON u.id = v.usuario_id WHERE v.id = ?', [id], 'incidencias_config:verificador');
    return filas[0] || null;
  }

  async quitarVerificador(id) {
    await db.query('DELETE FROM incidencia_verificadores WHERE id = ?', [id], 'incidencias_config:verificador_quitar');
  }

  // --- Roles y permisos ---

  async permisosDelModulo() {
    return db.query("SELECT id, codigo, nombre, descripcion FROM permisos WHERE modulo = 'incidencias' ORDER BY id", [], 'incidencias_config:permisos');
  }

  async rolesActivos() {
    return db.query(
      `SELECT r.id, r.nombre, r.descripcion, r.hereda_de_rol_id,
         (SELECT COUNT(*) FROM usuarios u WHERE u.rol_id = r.id AND u.activo = 1) AS usuarios
       FROM roles r WHERE r.activo = 1 ORDER BY r.nombre`, [], 'incidencias_config:roles');
  }

  async rol(rolId) {
    const filas = await db.query('SELECT id, nombre FROM roles WHERE id = ? AND activo = 1', [rolId], 'incidencias_config:rol');
    return filas[0] || null;
  }

  async permisosPorRol() {
    return db.query(
      `SELECT rp.rol_id, p.codigo FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE p.modulo = 'incidencias'`,
      [], 'incidencias_config:permisos_por_rol');
  }

  async permisoIdsDeRol(rolId) {
    const filas = await db.query('SELECT rp.permiso_id, p.modulo, p.codigo FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE rp.rol_id = ?', [rolId], 'incidencias_config:permiso_ids_rol');
    return filas;
  }

  // Cuántos roles activos, además de `exceptoRolId`, tienen un permiso del módulo.
  async rolesConPermiso(codigo, exceptoRolId) {
    const filas = await db.query(
      `SELECT COUNT(DISTINCT r.id) AS n FROM roles r JOIN rol_permisos rp ON rp.rol_id = r.id JOIN permisos p ON p.id = rp.permiso_id
       WHERE r.activo = 1 AND p.codigo = ? AND r.id <> ?`, [codigo, exceptoRolId], 'incidencias_config:roles_con_permiso');
    return Number(filas[0].n);
  }

  // --- Parámetros ---

  async guardarParametro(clave, valor) {
    await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [clave, String(valor)], 'incidencias_config:parametro');
  }

  // --- Historial de cambios ---

  async registrarHistorial({ usuarioId, entidad, clave, accion, antes = null, despues = null }) {
    await db.query('INSERT INTO incidencia_config_historial (usuario_id, entidad, clave, accion, antes, despues) VALUES (?, ?, ?, ?, ?, ?)',
      [usuarioId || null, entidad, String(clave).slice(0, 80), accion, antes === null ? null : JSON.stringify(antes), despues === null ? null : JSON.stringify(despues)], 'incidencias_config:historial_insertar');
  }

  async historial(limite) {
    return db.query(
      `SELECT h.id, h.entidad, h.clave, h.accion, h.antes, h.despues, h.creado_en, u.nombre AS usuario
       FROM incidencia_config_historial h LEFT JOIN usuarios u ON u.id = h.usuario_id ORDER BY h.id DESC LIMIT ?`, [limite], 'incidencias_config:historial');
  }

  // --- Estado general (los avisos de arriba de Configuración) ---

  async tecnicosActivos() {
    const filas = await db.query('SELECT COUNT(*) AS n FROM incidencia_tecnicos tc JOIN usuarios u ON u.id = tc.usuario_id AND u.activo = 1 WHERE tc.activo = 1', [], 'incidencias_config:tecnicos_activos');
    return Number(filas[0].n);
  }
}

module.exports = new ConfigRepository();
module.exports.CATALOGOS = CATALOGOS;
