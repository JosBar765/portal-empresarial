// src/modules/proyectos/repositories/seguimientoRepository.js
// Seguimiento del supervisor: avance por asesor y tienda, estancados, reasignaciones, anulaciones y cola de ventas por confirmar.
// Todo el SQL vive aquí. El alcance (qué tiendas puede ver o tocar cada persona) lo decide el servicio y llega ya resuelto.
const db = require('../../../config/database');

const TERMINALES = ['vendida', 'perdida', 'descartada'];
// Mismas definiciones acumulativas que las cifras del asesor: lo anulado y lo «por confirmar» no cuenta.
const COTIZADA = `(EXISTS (SELECT 1 FROM proy_cotizaciones c WHERE c.participacion_id = p.id AND c.anulada_en IS NULL)
  OR EXISTS (SELECT 1 FROM proy_ventas v WHERE v.participacion_id = p.id AND v.anulada_en IS NULL AND v.estado = 'confirmada'))`;
const VENDIDA = `EXISTS (SELECT 1 FROM proy_ventas v WHERE v.participacion_id = p.id AND v.anulada_en IS NULL AND v.estado = 'confirmada')`;
const CIFRAS = `COUNT(*) AS asignadas, SUM(p.estado <> 'pendiente') AS gestionadas, SUM(p.estado IN ('interesada', 'cotizada', 'vendida')) AS interesadas,
  SUM(${COTIZADA}) AS cotizadas, SUM(${VENDIDA}) AS vendidas`;

const numeros = (f) => ({ asignadas: Number(f.asignadas), gestionadas: Number(f.gestionadas || 0), interesadas: Number(f.interesadas || 0), cotizadas: Number(f.cotizadas || 0), vendidas: Number(f.vendidas || 0) });

class SeguimientoRepository {
  // --- Alcance ---

  async tiendasSupervisadas(usuarioId) {
    const filas = await db.query('SELECT tienda_id FROM supervisor_tiendas WHERE usuario_id = ?', [usuarioId], 'proyectos_seguimiento:tiendas_supervisadas');
    return filas.map(f => f.tienda_id);
  }

  async tiendasDelProyecto(proyectoId) {
    const filas = await db.query('SELECT tienda_id FROM proy_proyecto_tiendas WHERE proyecto_id = ?', [proyectoId], 'proyectos_seguimiento:tiendas_proyecto');
    return filas.map(f => f.tienda_id);
  }

  // Proyectos activos visibles para el alcance (`tiendaIds` null = todos).
  async proyectosActivos(tiendaIds) {
    return db.query(
      `SELECT y.id, y.nombre, y.estado FROM proy_proyectos y WHERE y.estado = 'activo'
         ${tiendaIds ? 'AND EXISTS (SELECT 1 FROM proy_proyecto_tiendas pt WHERE pt.proyecto_id = y.id AND pt.tienda_id IN (?))' : ''} ORDER BY y.activado_en DESC, y.id DESC`,
      tiendaIds ? [tiendaIds] : [], 'proyectos_seguimiento:proyectos_activos'
    );
  }

  // --- Avance ---

  async cifras(proyectoId) {
    const filas = await db.query(`SELECT ${CIFRAS} FROM proy_participaciones p WHERE p.proyecto_id = ? AND p.asesor_id IS NOT NULL`, [proyectoId], 'proyectos_seguimiento:cifras');
    return numeros(filas[0]);
  }

  // Por asesor, con el tiempo de reacción: minutos entre su primera asignación y su primera gestión (o hasta ahora si aún no gestiona).
  async porAsesor(proyectoId) {
    // Parte de los participantes activos (no de las empresas): quien quedó sin empresas sigue en la tabla con 0 asignadas.
    const filas = await db.query(
      `SELECT pp.usuario_id AS asesor_id, u.nombre, pp.tienda_id, t.codigo AS tienda, e.nombre AS empresa, ${CIFRAS.replace('COUNT(*)', 'COUNT(p.id)')},
         TIMESTAMPDIFF(MINUTE, MIN(p.asignada_en), COALESCE((SELECT MIN(g.creado_en) FROM proy_gestiones g JOIN proy_participaciones q ON q.id = g.participacion_id
           WHERE q.proyecto_id = pp.proyecto_id AND q.asesor_id = pp.usuario_id AND g.anulada_en IS NULL), NOW())) AS minutos_reaccion,
         EXISTS (SELECT 1 FROM proy_gestiones g JOIN proy_participaciones q ON q.id = g.participacion_id WHERE q.proyecto_id = pp.proyecto_id AND q.asesor_id = pp.usuario_id AND g.anulada_en IS NULL) AS ya_gestiono
       FROM proy_participantes pp JOIN usuarios u ON u.id = pp.usuario_id JOIN tiendas t ON t.id = pp.tienda_id JOIN empresas e ON e.id = t.empresa_id
         LEFT JOIN proy_participaciones p ON p.proyecto_id = pp.proyecto_id AND p.asesor_id = pp.usuario_id
       WHERE pp.proyecto_id = ? AND pp.estado = 'activo'
       GROUP BY pp.proyecto_id, pp.usuario_id, u.nombre, pp.tienda_id, t.codigo, e.nombre ORDER BY u.nombre, pp.usuario_id`,
      [proyectoId], 'proyectos_seguimiento:por_asesor'
    );
    return filas.map(f => ({ asesorId: f.asesor_id, nombre: f.nombre, tiendaId: f.tienda_id, tienda: f.tienda, empresa: f.empresa, ...numeros(f), minutosReaccion: Math.max(0, Number(f.minutos_reaccion || 0)), yaGestiono: Boolean(f.ya_gestiono) }));
  }

  async porTienda(proyectoId) {
    const filas = await db.query(
      `SELECT p.tienda_id, t.codigo AS tienda, e.nombre AS empresa, COUNT(DISTINCT p.asesor_id) AS asesores, ${CIFRAS}
       FROM proy_participaciones p JOIN tiendas t ON t.id = p.tienda_id JOIN empresas e ON e.id = t.empresa_id
       WHERE p.proyecto_id = ? AND p.asesor_id IS NOT NULL GROUP BY p.tienda_id, t.codigo, e.nombre ORDER BY e.nombre, t.codigo`,
      [proyectoId], 'proyectos_seguimiento:por_tienda'
    );
    return filas.map(f => ({ tiendaId: f.tienda_id, tienda: f.tienda, empresa: f.empresa, asesores: Number(f.asesores), ...numeros(f) }));
  }

  // Sin gestión desde `limite` (fecha y hora) o antes; de la más antigua a la más reciente.
  async estancados(proyectoId, limite, tope) {
    const base = `FROM proy_participaciones p JOIN proy_clientes c ON c.id = p.cliente_id JOIN usuarios u ON u.id = p.asesor_id JOIN tiendas t ON t.id = p.tienda_id
       WHERE p.proyecto_id = ? AND p.abierta = 1 AND p.asesor_id IS NOT NULL AND p.estado NOT IN (?) AND COALESCE(p.ultima_gestion_en, p.asignada_en) <= ?`;
    const params = [proyectoId, TERMINALES, limite];
    const [total, filas] = await Promise.all([
      db.query(`SELECT COUNT(*) AS n ${base}`, params, 'proyectos_seguimiento:estancados_total'),
      db.query(
        `SELECT p.id, p.estado, p.tienda_id, p.asesor_id, p.ultima_gestion_en, p.asignada_en, c.nombre AS empresa, c.ciudad, u.nombre AS asesor, t.codigo AS tienda ${base}
         ORDER BY COALESCE(p.ultima_gestion_en, p.asignada_en) ASC, p.id ASC LIMIT ?`,
        [...params, tope], 'proyectos_seguimiento:estancados'
      )
    ]);
    return { total: Number(total[0].n), filas };
  }

  // --- Una participación vista por el supervisor ---

  async participacion(id, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT p.id, p.proyecto_id, p.cliente_id, p.asesor_id, p.tienda_id, p.estado, p.abierta, p.ultima_gestion_en, p.proxima_gestion_en, p.asignada_en,
              c.nombre, c.ciudad, c.direccion, c.sitio_web, c.telefono, c.pais_id, pa.nombre AS pais, n.nombre AS nicho, es.nombre AS estructura,
              u.nombre AS asesor, t.codigo AS tienda
       FROM proy_participaciones p JOIN proy_clientes c ON c.id = p.cliente_id JOIN paises pa ON pa.id = c.pais_id JOIN proy_nichos n ON n.id = c.nicho_id
         JOIN proy_estructuras es ON es.id = c.estructura_id LEFT JOIN usuarios u ON u.id = p.asesor_id LEFT JOIN tiendas t ON t.id = p.tienda_id
       WHERE p.id = ?`,
      [id], 'proyectos_seguimiento:participacion'
    );
    return filas[0] || null;
  }

  async bloquearParticipacion(tx, id) {
    const filas = await tx.query('SELECT id, proyecto_id, asesor_id, tienda_id, estado, abierta FROM proy_participaciones WHERE id = ? FOR UPDATE', [id], 'proyectos_seguimiento:bloquear');
    return filas[0] || null;
  }

  // --- Reasignación ---

  // Las empresas pendientes de un asesor en el proyecto.
  async pendientesDe(proyectoId, asesorId) {
    const filas = await db.query("SELECT id FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id = ? AND abierta = 1 AND estado = 'pendiente' ORDER BY id", [proyectoId, asesorId], 'proyectos_seguimiento:pendientes');
    return filas.map(f => f.id);
  }

  // Participantes activos del proyecto con su tienda y país (los posibles destinos de una reasignación).
  async participantes(proyectoId, ejecutor = db) {
    return ejecutor.query(
      `SELECT pa.usuario_id, u.nombre, pa.tienda_id, t.codigo AS tienda, e.pais_id
       FROM proy_participantes pa JOIN usuarios u ON u.id = pa.usuario_id AND u.activo = 1 JOIN tiendas t ON t.id = pa.tienda_id JOIN empresas e ON e.id = t.empresa_id
       WHERE pa.proyecto_id = ? AND pa.estado = 'activo' ORDER BY pa.usuario_id`,
      [proyectoId], 'proyectos_seguimiento:participantes'
    );
  }

  // Empresas a mover con su país (para repartirlas por país) y su dueño actual, bloqueadas en orden de id.
  async paraReasignar(tx, proyectoId, ids, bloquear) {
    return tx.query(
      `SELECT p.id, p.asesor_id, p.tienda_id, p.estado, p.abierta, c.pais_id, c.nombre
       FROM proy_participaciones p JOIN proy_clientes c ON c.id = p.cliente_id WHERE p.proyecto_id = ? AND p.id IN (?) ORDER BY p.id${bloquear ? ' FOR UPDATE' : ''}`,
      [proyectoId, ids], 'proyectos_seguimiento:para_reasignar'
    );
  }

  async cargaPorAsesor(proyectoId, ejecutor = db) {
    const filas = await ejecutor.query('SELECT asesor_id, COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id IS NOT NULL AND abierta = 1 GROUP BY asesor_id', [proyectoId], 'proyectos_seguimiento:carga');
    return new Map(filas.map(f => [f.asesor_id, Number(f.n)]));
  }

  moverEmpresa(tx, id, asesorId, tiendaId) {
    return tx.query('UPDATE proy_participaciones SET asesor_id = ?, tienda_id = ? WHERE id = ?', [asesorId, tiendaId, id], 'proyectos_seguimiento:mover');
  }

  insertarReasignaciones(tx, filas) {
    if (!filas.length) return Promise.resolve();
    return tx.query('INSERT INTO proy_reasignaciones (participacion_id, de_usuario_id, a_usuario_id, motivo, por_usuario_id) VALUES ?',
      [filas.map(f => [f.participacionId, f.deAsesorId, f.aAsesorId, f.motivo, f.porUsuarioId])], 'proyectos_seguimiento:insertar_reasignaciones');
  }

  // --- Anulación y confirmación ---

  async anularCotizacion(tx, id, participacionId, { usuarioId, ahora, motivo }) {
    const res = await tx.query('UPDATE proy_cotizaciones SET anulada_en = ?, anulada_por = ?, anulacion_motivo = ? WHERE id = ? AND participacion_id = ? AND anulada_en IS NULL',
      [ahora, usuarioId, motivo, id, participacionId], 'proyectos_seguimiento:anular_cotizacion');
    return res.affectedRows === 1;
  }

  async anularVenta(tx, id, participacionId, { usuarioId, ahora, motivo }) {
    const res = await tx.query('UPDATE proy_ventas SET anulada_en = ?, anulada_por = ?, anulacion_motivo = ? WHERE id = ? AND participacion_id = ? AND anulada_en IS NULL',
      [ahora, usuarioId, motivo, id, participacionId], 'proyectos_seguimiento:anular_venta');
    return res.affectedRows === 1;
  }

  async venta(id, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT v.id, v.participacion_id, v.monto, v.moneda, v.referencia, v.estado, v.anulada_en, v.creado_en, p.asesor_id, p.tienda_id, p.proyecto_id, c.nombre AS empresa
       FROM proy_ventas v JOIN proy_participaciones p ON p.id = v.participacion_id JOIN proy_clientes c ON c.id = p.cliente_id WHERE v.id = ?`,
      [id], 'proyectos_seguimiento:venta'
    );
    return filas[0] || null;
  }

  async revisarVenta(tx, id, { estado, usuarioId, ahora, motivo }) {
    const res = await tx.query(
      "UPDATE proy_ventas SET estado = ?, revisada_por = ?, revisada_en = ?, revision_motivo = ? WHERE id = ? AND estado = 'por_confirmar' AND anulada_en IS NULL",
      [estado, usuarioId, ahora, motivo, id], 'proyectos_seguimiento:revisar_venta'
    );
    return res.affectedRows === 1;
  }

  // Ventas de las tiendas indicadas (null = todas) en un estado; las anuladas no se muestran.
  async ventas({ estado, tiendaIds }) {
    return db.query(
      `SELECT v.id, v.monto, v.moneda, v.referencia, v.estado, v.creado_en, v.revision_motivo, c.nombre AS empresa, u.nombre AS asesor, p.id AS participacion_id, y.nombre AS proyecto
       FROM proy_ventas v JOIN proy_participaciones p ON p.id = v.participacion_id JOIN proy_proyectos y ON y.id = p.proyecto_id JOIN proy_clientes c ON c.id = p.cliente_id
         LEFT JOIN usuarios u ON u.id = p.asesor_id
       WHERE v.estado = ? AND v.anulada_en IS NULL ${tiendaIds ? 'AND p.tienda_id IN (?)' : ''} ORDER BY v.id DESC LIMIT 200`,
      tiendaIds ? [estado, tiendaIds] : [estado], 'proyectos_seguimiento:ventas'
    );
  }

  async conteoVentas(tiendaIds) {
    const filas = await db.query(
      `SELECT v.estado, COUNT(*) AS n FROM proy_ventas v JOIN proy_participaciones p ON p.id = v.participacion_id
       WHERE v.anulada_en IS NULL ${tiendaIds ? 'AND p.tienda_id IN (?)' : ''} GROUP BY v.estado`,
      tiendaIds ? [tiendaIds] : [], 'proyectos_seguimiento:conteo_ventas'
    );
    return Object.fromEntries(filas.map(f => [f.estado, Number(f.n)]));
  }
}

module.exports = new SeguimientoRepository();
