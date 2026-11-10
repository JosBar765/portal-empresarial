// src/modules/proyectos/repositories/participacionRepository.js
// Trabajo del asesor sobre sus empresas (`proy_participaciones` y sus gestiones, muestras, cotizaciones y ventas). Todo el SQL vive aquí.
// Toda lectura y escritura filtra por `asesor_id`: una participación ajena se comporta como si no existiera.
const db = require('../../../config/database');

const TERMINALES = ['vendida', 'perdida', 'descartada'];
const PAGINA = 50;

class ParticipacionRepository {
  // --- Proyecto del asesor ---

  // El proyecto activo donde la persona tiene empresas abiertas (el más reciente si hubiera varios).
  async proyectoActivoDe(asesorId) {
    const filas = await db.query(
      `SELECT y.id FROM proy_proyectos y
       WHERE y.estado = 'activo' AND EXISTS (SELECT 1 FROM proy_participaciones p WHERE p.proyecto_id = y.id AND p.asesor_id = ? AND p.abierta = 1)
       ORDER BY y.activado_en DESC, y.id DESC LIMIT 1`, [asesorId], 'proyectos_gestion:proyecto_activo'
    );
    return filas[0] ? filas[0].id : null;
  }

  // `bloquear`: lectura con bloqueo (FOR UPDATE) de la fila del proyecto, para descontar existencias sin carreras.
  async proyecto(id, ejecutor = db, bloquear = false) {
    const filas = await ejecutor.query(
      `SELECT y.id, y.codigo, y.nombre, y.estado, y.anio, y.mes, y.fecha_inicio, y.fecha_fin, y.articulo_id, a.nombre AS articulo,
              y.existencia_muestras, y.meta_monto, y.meta_moneda, n.nombre AS nicho, y.config_snapshot
       FROM proy_proyectos y JOIN proy_nichos n ON n.id = y.nicho_id LEFT JOIN proy_articulos a ON a.id = y.articulo_id WHERE y.id = ?${bloquear ? ' FOR UPDATE' : ''}`,
      [id], 'proyectos_gestion:proyecto'
    );
    return filas[0] || null;
  }

  etapas(proyectoId) {
    return db.query('SELECT orden, nombre, descripcion, fecha_inicio, fecha_fin FROM proy_proyecto_etapas WHERE proyecto_id = ? ORDER BY orden', [proyectoId], 'proyectos_gestion:etapas');
  }

  async muestrasEntregadas(proyectoId) {
    const filas = await db.query(
      `SELECT COALESCE(SUM(e.cantidad), 0) AS n FROM proy_entregas_muestra e JOIN proy_participaciones p ON p.id = e.participacion_id WHERE p.proyecto_id = ?`,
      [proyectoId], 'proyectos_gestion:muestras_entregadas'
    );
    return Number(filas[0].n);
  }

  // Las cifras de Mi proyecto. Las tasas son acumulativas: una venta sin cotización previa cuenta también como cotizada.
  async cifras(proyectoId, asesorId) {
    const filas = await db.query(
      `SELECT COUNT(*) AS asignadas,
         SUM(p.estado <> 'pendiente') AS gestionadas,
         SUM(p.estado IN ('interesada', 'cotizada', 'vendida')) AS interesadas,
         SUM(EXISTS (SELECT 1 FROM proy_cotizaciones c WHERE c.participacion_id = p.id AND c.anulada_en IS NULL)
             OR EXISTS (SELECT 1 FROM proy_ventas v WHERE v.participacion_id = p.id AND v.anulada_en IS NULL AND v.estado = 'confirmada')) AS cotizadas,
         SUM(EXISTS (SELECT 1 FROM proy_ventas v WHERE v.participacion_id = p.id AND v.anulada_en IS NULL AND v.estado = 'confirmada')) AS vendidas
       FROM proy_participaciones p WHERE p.proyecto_id = ? AND p.asesor_id = ?`,
      [proyectoId, asesorId], 'proyectos_gestion:cifras'
    );
    const f = filas[0];
    return {
      asignadas: Number(f.asignadas), gestionadas: Number(f.gestionadas || 0), interesadas: Number(f.interesadas || 0),
      cotizadas: Number(f.cotizadas || 0), vendidas: Number(f.vendidas || 0)
    };
  }

  async conteosPorEstado(proyectoId, asesorId) {
    const filas = await db.query('SELECT estado, COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id = ? GROUP BY estado', [proyectoId, asesorId], 'proyectos_gestion:conteos');
    return Object.fromEntries(filas.map(f => [f.estado, Number(f.n)]));
  }

  // --- Listas ---

  // Orden fijo: cerradas al final → vencidas primero → fecha más próxima → sin contactar antes que contactadas.
  async listar({ proyectoId, asesorId, estado, q, pagina, hoy }) {
    const donde = ['p.proyecto_id = ?', 'p.asesor_id = ?'];
    const params = [proyectoId, asesorId];
    if (estado) { donde.push('p.estado = ?'); params.push(estado); }
    if (q) { donde.push('(c.nombre LIKE ? OR c.ciudad LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const base = `FROM proy_participaciones p JOIN proy_clientes c ON c.id = p.cliente_id WHERE ${donde.join(' AND ')}`;
    const [total, filas] = await Promise.all([
      db.query(`SELECT COUNT(*) AS n ${base}`, params, 'proyectos_gestion:total'),
      db.query(
        `SELECT p.id, p.estado, p.ultima_gestion_en, p.proxima_gestion_en, p.asignada_en, c.nombre, c.ciudad, c.telefono,
           (SELECT t.nombre FROM proy_contactos t WHERE t.cliente_id = c.id AND t.activo = 1 ORDER BY t.principal DESC, t.id LIMIT 1) AS contacto,
           (SELECT t.telefono FROM proy_contactos t WHERE t.cliente_id = c.id AND t.activo = 1 AND t.telefono IS NOT NULL ORDER BY t.principal DESC, t.id LIMIT 1) AS contacto_telefono
         ${base}
         ORDER BY (p.estado IN ('vendida', 'perdida', 'descartada')) ASC,
                  (p.proxima_gestion_en IS NOT NULL AND p.proxima_gestion_en < ?) DESC,
                  (p.proxima_gestion_en IS NULL) ASC, p.proxima_gestion_en ASC,
                  (p.ultima_gestion_en IS NULL) DESC, p.id ASC
         LIMIT ? OFFSET ?`,
        [...params, `${hoy} 00:00:00`, PAGINA, (pagina - 1) * PAGINA], 'proyectos_gestion:listar'
      )
    ]);
    return { total: Number(total[0].n), filas };
  }

  // Todas las empresas abiertas, sin vendida, perdida ni descartada: el servicio las reparte en vencidas, de hoy y sin tocar.
  paraHoy(proyectoId, asesorId) {
    return db.query(
      `SELECT p.id, p.estado, p.ultima_gestion_en, p.proxima_gestion_en, p.asignada_en, c.nombre, c.ciudad, c.direccion, pa.nombre AS pais, c.telefono,
         (SELECT t.telefono FROM proy_contactos t WHERE t.cliente_id = c.id AND t.activo = 1 AND t.telefono IS NOT NULL ORDER BY t.principal DESC, t.id LIMIT 1) AS contacto_telefono
       FROM proy_participaciones p JOIN proy_clientes c ON c.id = p.cliente_id JOIN paises pa ON pa.id = c.pais_id
       WHERE p.proyecto_id = ? AND p.asesor_id = ? AND p.abierta = 1 AND p.estado NOT IN (?) ORDER BY p.id LIMIT 500`,
      [proyectoId, asesorId, TERMINALES], 'proyectos_gestion:para_hoy'
    );
  }

  // Los proyectos ya cerrados o cancelados en los que la persona tuvo empresas, con su resultado.
  proyectosAnteriores(asesorId) {
    return db.query(
      `SELECT y.id, y.nombre, y.anio, y.mes, y.estado, y.cerrado_en, n.nombre AS nicho,
         COUNT(*) AS asignadas, SUM(p.estado <> 'pendiente') AS gestionadas, SUM(p.estado IN ('interesada', 'cotizada', 'vendida')) AS interesadas,
         SUM(p.estado = 'vendida') AS vendidas
       FROM proy_participaciones p JOIN proy_proyectos y ON y.id = p.proyecto_id JOIN proy_nichos n ON n.id = y.nicho_id
       WHERE p.asesor_id = ? AND y.estado IN ('cerrado', 'cancelado') GROUP BY y.id, y.nombre, y.anio, y.mes, y.estado, y.cerrado_en, n.nombre
       ORDER BY y.anio DESC, y.mes DESC, y.id DESC LIMIT 100`,
      [asesorId], 'proyectos_gestion:anteriores'
    );
  }

  // Lo vendido (ventas confirmadas y vigentes) por proyecto y moneda: nunca se suman monedas distintas.
  vendidoPorMoneda(asesorId) {
    return db.query(
      `SELECT p.proyecto_id, v.moneda, SUM(v.monto) AS total FROM proy_ventas v JOIN proy_participaciones p ON p.id = v.participacion_id
       WHERE p.asesor_id = ? AND v.anulada_en IS NULL AND v.estado = 'confirmada' GROUP BY p.proyecto_id, v.moneda ORDER BY v.moneda`,
      [asesorId], 'proyectos_gestion:vendido_por_moneda'
    );
  }

  // --- Ficha ---

  async participacion(id, asesorId, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT p.id, p.proyecto_id, p.cliente_id, p.estado, p.abierta, p.ultima_gestion_en, p.proxima_gestion_en, p.motivo_perdida_id, p.asignada_en,
              c.nombre, c.ciudad, c.direccion, c.sitio_web, c.telefono, c.pais_id, pa.nombre AS pais, n.nombre AS nicho, e.nombre AS estructura
       FROM proy_participaciones p JOIN proy_clientes c ON c.id = p.cliente_id JOIN paises pa ON pa.id = c.pais_id
         JOIN proy_nichos n ON n.id = c.nicho_id JOIN proy_estructuras e ON e.id = c.estructura_id
       WHERE p.id = ? AND p.asesor_id = ?`,
      [id, asesorId], 'proyectos_gestion:participacion'
    );
    return filas[0] || null;
  }

  // Bloquea la fila para que dos registros a la vez sobre la misma empresa no se pisen.
  async bloquear(tx, id, asesorId) {
    const filas = await tx.query('SELECT id, proyecto_id, estado, abierta, proxima_gestion_en FROM proy_participaciones WHERE id = ? AND asesor_id = ? FOR UPDATE', [id, asesorId], 'proyectos_gestion:bloquear');
    return filas[0] || null;
  }

  async cliente(id) {
    const filas = await db.query('SELECT id, nombre, telefono FROM proy_clientes WHERE id = ?', [id], 'proyectos_gestion:cliente');
    return filas[0] || null;
  }

  contactos(clienteId) {
    return db.query(
      `SELECT t.id, t.nombre, t.cargo, t.telefono, t.correo, t.principal, a.nombre AS area
       FROM proy_contactos t JOIN proy_areas_contacto a ON a.id = t.area_id WHERE t.cliente_id = ? AND t.activo = 1 ORDER BY t.principal DESC, t.id`,
      [clienteId], 'proyectos_gestion:contactos'
    );
  }

  // Gestiones, muestras, cotizaciones y ventas de una empresa; el servicio las junta en una línea de tiempo.
  async historial(participacionId) {
    const [gestiones, muestras, cotizaciones, ventas, vales] = await Promise.all([
      db.query(
        `SELECT g.id, g.creado_en, g.nota, g.proxima_en, g.anulada_en, ca.nombre AS canal, r.nombre AS resultado, t.nombre AS contacto, u.nombre AS usuario
         FROM proy_gestiones g JOIN proy_canales ca ON ca.id = g.canal_id JOIN proy_resultados_gestion r ON r.id = g.resultado_id
           JOIN usuarios u ON u.id = g.usuario_id LEFT JOIN proy_contactos t ON t.id = g.contacto_id WHERE g.participacion_id = ? ORDER BY g.id DESC`,
        [participacionId], 'proyectos_gestion:historial_gestiones'),
      db.query(
        `SELECT e.id, e.creado_en, e.cantidad, a.nombre AS area, u.nombre AS usuario
         FROM proy_entregas_muestra e JOIN usuarios u ON u.id = e.entregada_por LEFT JOIN proy_areas_contacto a ON a.id = e.area_id WHERE e.participacion_id = ? ORDER BY e.id DESC`,
        [participacionId], 'proyectos_gestion:historial_muestras'),
      db.query(
        `SELECT c.id, c.creado_en, c.monto, c.moneda, c.referencia, c.nota, c.anulada_en, u.nombre AS usuario
         FROM proy_cotizaciones c JOIN usuarios u ON u.id = c.creado_por WHERE c.participacion_id = ? ORDER BY c.id DESC`,
        [participacionId], 'proyectos_gestion:historial_cotizaciones'),
      db.query(
        `SELECT v.id, v.creado_en, v.monto, v.moneda, v.referencia, v.estado, v.anulada_en, u.nombre AS usuario
         FROM proy_ventas v JOIN usuarios u ON u.id = v.creado_por WHERE v.participacion_id = ? ORDER BY v.id DESC`,
        [participacionId], 'proyectos_gestion:historial_ventas'),
      db.query(
        `SELECT pv.id, pv.vale_id, pv.vinculado_en, va.correlativo, u.nombre AS usuario FROM proy_vales pv JOIN vales va ON va.id = pv.vale_id JOIN usuarios u ON u.id = pv.vinculado_por
         WHERE pv.participacion_id = ? ORDER BY pv.id DESC`,
        [participacionId], 'proyectos_gestion:historial_vales')
    ]);
    return { gestiones, muestras, cotizaciones, ventas, vales };
  }

  // --- Catálogos que usan las hojas de registro ---

  async catalogos() {
    const [canales, resultados, motivos, monedas, areas] = await Promise.all([
      db.query('SELECT id, nombre, presencial FROM proy_canales WHERE activo = 1 ORDER BY id', [], 'proyectos_gestion:canales'),
      db.query('SELECT id, nombre, contacto_logrado, requiere_proxima, efecto_estado FROM proy_resultados_gestion WHERE activo = 1 ORDER BY orden, id', [], 'proyectos_gestion:resultados'),
      db.query('SELECT id, nombre FROM proy_motivos_perdida WHERE activo = 1 ORDER BY orden, id', [], 'proyectos_gestion:motivos'),
      db.query('SELECT codigo, nombre, simbolo FROM proy_monedas WHERE activa = 1 ORDER BY codigo', [], 'proyectos_gestion:monedas'),
      db.query('SELECT id, nombre FROM proy_areas_contacto WHERE activo = 1 ORDER BY orden, id', [], 'proyectos_gestion:areas')
    ]);
    return { canales, resultados, motivos, monedas, areas };
  }

  async resultado(id, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id, requiere_proxima, efecto_estado FROM proy_resultados_gestion WHERE id = ? AND activo = 1', [id], 'proyectos_gestion:resultado');
    return filas[0] || null;
  }

  async canalActivo(id, ejecutor = db) {
    return (await ejecutor.query('SELECT id FROM proy_canales WHERE id = ? AND activo = 1', [id], 'proyectos_gestion:canal'))[0] || null;
  }

  async motivoActivo(id, ejecutor = db) {
    return (await ejecutor.query('SELECT id FROM proy_motivos_perdida WHERE id = ? AND activo = 1', [id], 'proyectos_gestion:motivo'))[0] || null;
  }

  async contactoDe(clienteId, contactoId, ejecutor = db) {
    return (await ejecutor.query('SELECT id FROM proy_contactos WHERE id = ? AND cliente_id = ?', [contactoId, clienteId], 'proyectos_gestion:contacto'))[0] || null;
  }

  async areaActiva(id, ejecutor = db) {
    return (await ejecutor.query('SELECT id FROM proy_areas_contacto WHERE id = ? AND activo = 1', [id], 'proyectos_gestion:area'))[0] || null;
  }

  // --- Registros (siempre dentro de una transacción) ---

  async anularGestion(tx, id, participacionId, { usuarioId, ahora, motivo }) {
    const res = await tx.query('UPDATE proy_gestiones SET anulada_en = ?, anulada_por = ?, anulacion_motivo = ? WHERE id = ? AND participacion_id = ? AND anulada_en IS NULL',
      [ahora, usuarioId, motivo, id, participacionId], 'proyectos_gestion:anular_gestion');
    return res.affectedRows === 1;
  }

  // Tras anular una gestión, el último contacto y el próximo seguimiento vuelven a ser los de la última gestión que sigue vigente.
  // `ultima_gestion_en` se guarda en hora de Guatemala; `creado_en` va en la hora de la base: se corrige con la diferencia entre ambos relojes.
  refrescarSeguimiento(tx, participacionId, ahoraGT) {
    return tx.query(
      `UPDATE proy_participaciones SET
         ultima_gestion_en = (SELECT DATE_ADD(MAX(g.creado_en), INTERVAL ROUND(TIMESTAMPDIFF(MINUTE, NOW(), ?) / 60) * 60 MINUTE) FROM proy_gestiones g WHERE g.participacion_id = proy_participaciones.id AND g.anulada_en IS NULL),
         proxima_gestion_en = (SELECT g.proxima_en FROM proy_gestiones g WHERE g.participacion_id = proy_participaciones.id AND g.anulada_en IS NULL ORDER BY g.id DESC LIMIT 1)
       WHERE id = ?`,
      [ahoraGT, participacionId], 'proyectos_gestion:refrescar_seguimiento'
    );
  }

  async insertarGestion(tx, d) {
    const res = await tx.query(
      `INSERT INTO proy_gestiones (participacion_id, usuario_id, canal_id, contacto_id, resultado_id, nota, proxima_en) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [d.participacionId, d.usuarioId, d.canalId, d.contactoId, d.resultadoId, d.nota, d.proximaEn], 'proyectos_gestion:insertar_gestion'
    );
    return res.insertId;
  }

  // Baja la existencia solo si alcanza: la condición y el descuento van en una sola sentencia, así dos entregas a la vez no pasan del total.
  async descontarExistencia(tx, proyectoId, cantidad) {
    const res = await tx.query('UPDATE proy_proyectos SET existencia_muestras = existencia_muestras - ? WHERE id = ? AND existencia_muestras >= ?', [cantidad, proyectoId, cantidad], 'proyectos_gestion:descontar_existencia');
    return res.affectedRows === 1;
  }

  async existencia(tx, proyectoId) {
    const filas = await tx.query('SELECT existencia_muestras FROM proy_proyectos WHERE id = ?', [proyectoId], 'proyectos_gestion:existencia');
    return filas[0] ? filas[0].existencia_muestras : null;
  }

  insertarEntrega(tx, d) {
    return tx.query('INSERT INTO proy_entregas_muestra (participacion_id, area_id, cantidad, entregada_por) VALUES (?, ?, ?, ?)', [d.participacionId, d.areaId, d.cantidad, d.usuarioId], 'proyectos_gestion:insertar_entrega');
  }

  async insertarCotizacion(tx, d) {
    const res = await tx.query(
      'INSERT INTO proy_cotizaciones (participacion_id, monto, moneda, referencia, nota, creado_por) VALUES (?, ?, ?, ?, ?, ?)',
      [d.participacionId, d.monto, d.moneda, d.referencia, d.nota, d.usuarioId], 'proyectos_gestion:insertar_cotizacion'
    );
    return res.insertId;
  }

  async insertarVenta(tx, d) {
    const res = await tx.query(
      'INSERT INTO proy_ventas (participacion_id, monto, moneda, referencia, estado, creado_por) VALUES (?, ?, ?, ?, ?, ?)',
      [d.participacionId, d.monto, d.moneda, d.referencia, d.estado, d.usuarioId], 'proyectos_gestion:insertar_venta'
    );
    return res.insertId;
  }

  // La orden de venta ya usada en otra venta que sigue vigente (no anulada ni rechazada).
  async ventaConReferencia(tx, referencia) {
    const filas = await tx.query(
      `SELECT v.id, v.creado_en, c.nombre AS cliente FROM proy_ventas v JOIN proy_participaciones p ON p.id = v.participacion_id JOIN proy_clientes c ON c.id = p.cliente_id
       WHERE v.referencia = ? AND v.anulada_en IS NULL AND v.estado <> 'rechazada' ORDER BY v.id LIMIT 1`,
      [referencia], 'proyectos_gestion:venta_con_referencia'
    );
    return filas[0] || null;
  }

  // Lo registrado sin lo anulado: de aquí sale el estado de la participación.
  async hechos(tx, participacionId) {
    const filas = await tx.query(
      `SELECT (SELECT COUNT(*) FROM proy_gestiones WHERE participacion_id = ? AND anulada_en IS NULL) AS gestiones,
              (SELECT COUNT(*) FROM proy_gestiones g JOIN proy_resultados_gestion r ON r.id = g.resultado_id WHERE g.participacion_id = ? AND g.anulada_en IS NULL AND r.efecto_estado = 'interesada') AS interesadas,
              (SELECT COUNT(*) FROM proy_cotizaciones WHERE participacion_id = ? AND anulada_en IS NULL) AS cotizaciones,
              (SELECT COUNT(*) FROM proy_ventas WHERE participacion_id = ? AND anulada_en IS NULL AND estado = 'confirmada') AS ventas`,
      [participacionId, participacionId, participacionId, participacionId], 'proyectos_gestion:hechos'
    );
    const f = filas[0];
    return { gestiones: Number(f.gestiones), interesadas: Number(f.interesadas), cotizaciones: Number(f.cotizaciones), ventasConfirmadas: Number(f.ventas) };
  }

  // `cambios`: columnas de la participación a actualizar (estado, ultima_gestion_en, proxima_gestion_en, motivo_perdida_id…).
  actualizar(tx, id, cambios) {
    const columnas = Object.keys(cambios);
    return tx.query(`UPDATE proy_participaciones SET ${columnas.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...columnas.map(c => cambios[c]), id], 'proyectos_gestion:actualizar');
  }
}

module.exports = new ParticipacionRepository();
module.exports.PAGINA = PAGINA;
module.exports.TERMINALES = TERMINALES;
