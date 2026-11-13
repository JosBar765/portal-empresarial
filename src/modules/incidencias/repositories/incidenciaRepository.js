// src/modules/incidencias/repositories/incidenciaRepository.js
// Todo el SQL de las incidencias, su historial y sus fotos.
const db = require('../../../config/database');
const personal = require('./personalRepository');
const { ABIERTOS } = require('../constantes');

const COLUMNAS = `i.id, i.correlativo, i.tienda_id, i.zona_id, i.categoria_id, i.tipo_activo_id, i.activo_texto, i.titulo, i.descripcion,
  i.impacto, i.prioridad_id, i.reincidente, i.estado, i.reportada_por, i.tecnico_id, i.ronda, i.duplicada_de,
  i.creado_en, i.actualizado_en, i.tomada_en, i.cerrada_en,
  t.codigo AS tienda_codigo, e.nombre AS empresa, e.pais_id, pa.nombre AS pais, d.nombre AS departamento,
  z.nombre AS zona, c.nombre AS categoria, c.especialidad_id, ta.nombre AS tipo_activo,
  pr.codigo AS prioridad_codigo, pr.nombre AS prioridad_nombre, pr.color AS prioridad_color, pr.orden AS prioridad_orden,
  ur.nombre AS reportante, ut.nombre AS tecnico`;

const DESDE = `FROM incidencias i
  JOIN tiendas t ON t.id = i.tienda_id
  JOIN empresas e ON e.id = t.empresa_id
  JOIN paises pa ON pa.id = e.pais_id
  JOIN departamentos d ON d.id = t.departamento_id
  LEFT JOIN incidencia_zonas z ON z.id = i.zona_id
  JOIN incidencia_categorias c ON c.id = i.categoria_id
  LEFT JOIN incidencia_tipos_activo ta ON ta.id = i.tipo_activo_id
  JOIN incidencia_prioridades pr ON pr.id = i.prioridad_id
  JOIN usuarios ur ON ur.id = i.reportada_por
  LEFT JOIN usuarios ut ON ut.id = i.tecnico_id`;

// Lo que se agrega en los listados: el último movimiento y la primera foto.
const EXTRA_LISTA = `,
  (SELECT MAX(ev.creado_en) FROM incidencia_eventos ev WHERE ev.incidencia_id = i.id) AS ultimo_movimiento_en,
  (SELECT f.url FROM incidencia_fotos f WHERE f.incidencia_id = i.id AND f.etapa = 'reporte' ORDER BY f.id LIMIT 1) AS miniatura`;

const AHORA = Symbol('ahora');
const CAMPOS_ACTUALIZABLES = new Set(['estado', 'tecnico_id', 'ronda', 'prioridad_id', 'tomada_en', 'cerrada_en', 'duplicada_de']);

// Las vistas son las listas que ve cada persona; qué vista puede pedir lo decide el servicio por permisos.
function dondeDeVista(vista, usuarioId) {
  switch (vista) {
    case 'reportadas': return { sql: 'i.reportada_por = ?', params: [usuarioId] };
    case 'buzon': return { sql: `i.estado = 'en_buzon' AND ${personal.condicionCobertura('i.tienda_id')}`, params: [usuarioId] };
    case 'tecnico': return { sql: 'i.tecnico_id = ?', params: [usuarioId] };
    case 'verificar': return { sql: `i.estado = 'en_verificacion' AND ${personal.condicionVerificador('i.tienda_id')}`, params: [usuarioId, usuarioId] };
    case 'tiendas': return { sql: personal.condicionVerificador('i.tienda_id'), params: [usuarioId, usuarioId] };
    case 'todas': return { sql: '1 = 1', params: [] };
    default: return null;
  }
}

const comoLike = (texto) => `%${String(texto).replace(/[\\%_]/g, m => `\\${m}`)}%`;

function dondeCompleto(vista, usuarioId, filtros = {}) {
  const base = dondeDeVista(vista, usuarioId);
  if (!base) return null;
  const sql = [base.sql];
  const params = [...base.params];
  if (filtros.estados && filtros.estados.length) { sql.push('i.estado IN (?)'); params.push(filtros.estados); }
  if (filtros.prioridadId) { sql.push('i.prioridad_id = ?'); params.push(filtros.prioridadId); }
  if (filtros.tiendaId) { sql.push('i.tienda_id = ?'); params.push(filtros.tiendaId); }
  if (filtros.q) { sql.push('(i.titulo LIKE ? OR i.correlativo LIKE ?)'); params.push(comoLike(filtros.q), comoLike(filtros.q)); }
  return { sql: sql.join(' AND '), params };
}

class IncidenciaRepository {
  // --- Lectura ---

  async obtener(id, ejecutor = db) {
    const filas = await ejecutor.query(`SELECT ${COLUMNAS} ${DESDE} WHERE i.id = ?`, [id], 'incidencias:obtener');
    return filas[0] || null;
  }

  // La fila entera, bloqueada hasta que termine la transacción: las transiciones de estado parten de aquí.
  async bloquear(tx, id) {
    const filas = await tx.query('SELECT * FROM incidencias WHERE id = ? FOR UPDATE', [id], 'incidencias:bloquear');
    return filas[0] || null;
  }

  async listar(vista, usuarioId, filtros, { limite, desplazamiento }) {
    const donde = dondeCompleto(vista, usuarioId, filtros);
    if (!donde) return [];
    const orden = vista === 'buzon' ? 'pr.orden ASC, i.creado_en ASC, i.id ASC'
      : vista === 'verificar' ? 'i.actualizado_en ASC, i.id ASC'
        : 'i.creado_en DESC, i.id DESC';
    return db.query(`SELECT ${COLUMNAS}${EXTRA_LISTA} ${DESDE} WHERE ${donde.sql} ORDER BY ${orden} LIMIT ? OFFSET ?`,
      [...donde.params, limite, desplazamiento], 'incidencias:listar');
  }

  async contar(vista, usuarioId, filtros = {}) {
    const donde = dondeCompleto(vista, usuarioId, filtros);
    if (!donde) return 0;
    const filas = await db.query(`SELECT COUNT(*) AS n FROM incidencias i JOIN tiendas t ON t.id = i.tienda_id JOIN incidencia_prioridades pr ON pr.id = i.prioridad_id WHERE ${donde.sql}`,
      donde.params, 'incidencias:contar');
    return Number(filas[0].n);
  }

  // El buzón del técnico en resumen: cuántas esperan, cuántas son de la prioridad más alta y cuál es la más antigua.
  async resumenBuzon(usuarioId) {
    const donde = dondeDeVista('buzon', usuarioId);
    const filas = await db.query(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(pr.orden = (SELECT MIN(orden) FROM incidencia_prioridades WHERE activo = 1)), 0) AS criticas
       FROM incidencias i JOIN tiendas t ON t.id = i.tienda_id JOIN incidencia_prioridades pr ON pr.id = i.prioridad_id WHERE ${donde.sql}`,
      donde.params, 'incidencias:resumen_buzon');
    const masAntigua = await db.query(
      `SELECT i.id, i.correlativo, i.titulo, i.creado_en FROM incidencias i JOIN tiendas t ON t.id = i.tienda_id WHERE ${donde.sql} ORDER BY i.creado_en ASC LIMIT 1`,
      donde.params, 'incidencias:resumen_buzon_antigua');
    const critica = await db.query(
      `SELECT i.id, i.correlativo, i.titulo, i.creado_en FROM incidencias i JOIN tiendas t ON t.id = i.tienda_id JOIN incidencia_prioridades pr ON pr.id = i.prioridad_id
       WHERE ${donde.sql} AND pr.orden = (SELECT MIN(orden) FROM incidencia_prioridades WHERE activo = 1) ORDER BY i.creado_en ASC LIMIT 1`,
      donde.params, 'incidencias:resumen_buzon_critica');
    return { total: Number(filas[0].total), criticas: Number(filas[0].criticas), masAntigua: masAntigua[0] || null, critica: critica[0] || null };
  }

  // Las del técnico que llevan `dias` días o más sin movimiento del técnico.
  async contarSinAvance(usuarioId, dias) {
    const filas = await db.query(
      `SELECT COUNT(*) AS n FROM incidencias i WHERE i.tecnico_id = ? AND i.estado IN ('en_proceso','correccion_pedida')
         AND COALESCE((SELECT MAX(ev.creado_en) FROM incidencia_eventos ev WHERE ev.incidencia_id = i.id AND ev.tipo IN ('toma','avance','reanudacion','correccion_pedida')), i.creado_en) < NOW() - INTERVAL ? DAY`,
      [usuarioId, dias], 'incidencias:sin_avance');
    return Number(filas[0].n);
  }

  async reportesRecientes(usuarioId) {
    const filas = await db.query('SELECT COUNT(*) AS n FROM incidencias WHERE reportada_por = ? AND creado_en >= NOW() - INTERVAL 1 DAY', [usuarioId], 'incidencias:reportes_recientes');
    return Number(filas[0].n);
  }

  // Reportes abiertos y recientes de la misma tienda y categoría, en la misma zona o del mismo tipo de activo.
  async similares({ tiendaId, zonaId, categoriaId, tipoActivoId, dias }) {
    if (!dias) return [];
    return db.query(
      `SELECT i.id, i.correlativo, i.titulo, i.creado_en FROM incidencias i
       WHERE i.tienda_id = ? AND i.categoria_id = ? AND i.estado IN (?) AND i.creado_en >= NOW() - INTERVAL ? DAY
         AND ((? IS NOT NULL AND i.zona_id = ?) OR (? IS NOT NULL AND i.tipo_activo_id = ?))
       ORDER BY i.creado_en DESC LIMIT 3`,
      [tiendaId, categoriaId, ABIERTOS, dias, zonaId, zonaId, tipoActivoId, tipoActivoId], 'incidencias:similares');
  }

  // ¿Hubo otra incidencia en la misma tienda, zona y categoría dentro de la ventana? (la prioridad sube un nivel)
  async hayReincidencia({ tiendaId, zonaId, categoriaId, dias }) {
    if (!dias || !zonaId) return false;
    const filas = await db.query(
      `SELECT 1 AS si FROM incidencias WHERE tienda_id = ? AND zona_id = ? AND categoria_id = ? AND estado <> 'descartada'
         AND creado_en >= NOW() - INTERVAL ? DAY LIMIT 1`,
      [tiendaId, zonaId, categoriaId, dias], 'incidencias:reincidencia');
    return filas.length > 0;
  }

  async existe(id) {
    const filas = await db.query('SELECT id FROM incidencias WHERE id = ?', [id], 'incidencias:existe');
    return filas.length > 0;
  }

  // ¿Esta persona trabajó la incidencia (la tomó, publicó avances o la envió a verificar)? No puede verificarla.
  async trabajoEn(id, usuarioId, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT 1 AS si FROM incidencia_eventos WHERE incidencia_id = ? AND usuario_id = ? AND tipo IN ('toma','avance','a_verificacion') LIMIT 1`,
      [id, usuarioId], 'incidencias:trabajo_en');
    return filas.length > 0;
  }

  // --- Escritura ---

  async insertar(tx, d) {
    const r = await tx.query(
      `INSERT INTO incidencias (tienda_id, zona_id, categoria_id, tipo_activo_id, activo_texto, titulo, descripcion, impacto, prioridad_id, reincidente, reportada_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.tiendaId, d.zonaId, d.categoriaId, d.tipoActivoId, d.activoTexto, d.titulo, d.descripcion, d.impacto, d.prioridadId, d.reincidente ? 1 : 0, d.reportadaPor],
      'incidencias:insertar');
    return r.insertId;
  }

  // INC-000123: el id con ceros a la izquierda, en la misma transacción que la creó.
  async fijarCorrelativo(tx, id) {
    const correlativo = `INC-${String(id).padStart(6, '0')}`;
    await tx.query('UPDATE incidencias SET correlativo = ? WHERE id = ?', [correlativo, id], 'incidencias:correlativo');
    return correlativo;
  }

  // Cambia la incidencia solo si sigue en uno de los estados de partida; devuelve las filas cambiadas (1 o 0).
  // Un valor `AHORA` se escribe como la hora de la base (así todas las fechas salen del mismo reloj).
  async actualizarSi(tx, id, estadosDesde, campos) {
    const claves = Object.keys(campos);
    if (!claves.length || claves.some(k => !CAMPOS_ACTUALIZABLES.has(k))) throw new Error('Campo no actualizable de incidencias.');
    const sets = claves.map(k => (campos[k] === AHORA ? `\`${k}\` = NOW()` : `\`${k}\` = ?`)).join(', ');
    const valores = claves.filter(k => campos[k] !== AHORA).map(k => campos[k]);
    const r = await tx.query(`UPDATE incidencias SET ${sets}, actualizado_en = NOW() WHERE id = ? AND estado IN (?)`, [...valores, id, estadosDesde], 'incidencias:actualizar');
    return r.affectedRows;
  }

  // Marca la incidencia como movida (un avance o un comentario no cambian su estado pero sí su última actividad).
  async tocar(tx, id) {
    await tx.query('UPDATE incidencias SET actualizado_en = NOW() WHERE id = ?', [id], 'incidencias:tocar');
  }

  async insertarEvento(tx, e) {
    const r = await tx.query(
      `INSERT INTO incidencia_eventos (incidencia_id, tipo, usuario_id, texto, evolucion, ronda, datos, visible_reportante)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [e.incidenciaId, e.tipo, e.usuarioId || null, e.texto || null, e.evolucion || null, e.ronda ?? null,
        e.datos ? JSON.stringify(e.datos) : null, e.visibleReportante === false ? 0 : 1],
      'incidencias:evento');
    return r.insertId;
  }

  async insertarFotos(tx, incidenciaId, eventoId, etapa, urls, usuarioId) {
    if (!urls.length) return;
    await tx.query('INSERT INTO incidencia_fotos (incidencia_id, evento_id, etapa, url, subida_por) VALUES ?',
      [urls.map(url => [incidenciaId, eventoId, etapa, url, usuarioId])], 'incidencias:fotos');
  }

  async eventos(id) {
    return db.query(
      `SELECT ev.id, ev.tipo, ev.usuario_id, u.nombre AS usuario, ev.texto, ev.evolucion, ev.ronda, ev.datos, ev.visible_reportante, ev.creado_en
       FROM incidencia_eventos ev LEFT JOIN usuarios u ON u.id = ev.usuario_id WHERE ev.incidencia_id = ? ORDER BY ev.creado_en DESC, ev.id DESC`,
      [id], 'incidencias:eventos');
  }

  async fotos(id) {
    return db.query('SELECT id, evento_id, etapa, url FROM incidencia_fotos WHERE incidencia_id = ? ORDER BY id', [id], 'incidencias:fotos_de');
  }
}

const repositorio = new IncidenciaRepository();
repositorio.AHORA = AHORA;
module.exports = repositorio;
