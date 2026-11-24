// src/modules/proyectos/repositories/proyectoRepository.js
// Proyectos (`proy_proyectos`) con sus tiendas, participantes, etapas, reparto e historial. Todo el SQL vive aquí.
// El alcance (qué proyectos ve cada persona) lo decide el servicio y llega como `alcance`: { todos, usuarioId }.
const db = require('../../../config/database');

// MySQL entrega las columnas JSON ya convertidas; MariaDB (producción) las entrega como texto.
const dato = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

const COLUMNAS = `y.id, y.codigo, y.nombre, y.nicho_id, n.nombre AS nicho, y.anio, y.mes, y.articulo_id, a.nombre AS articulo, y.existencia_muestras,
  y.plantilla_id, (SELECT pl.nombre FROM proy_plantillas pl WHERE pl.id = y.plantilla_id) AS plantilla_nombre, y.meta_monto, y.meta_moneda, y.estado, y.fecha_inicio, y.fecha_fin, y.tope_por_asesor, y.activado_en, y.cerrado_en,
  y.aprobacion_pedida_en, up.nombre AS aprobacion_pedida_por_nombre, y.aprobada_en, y.aprobacion_comentario, y.config_snapshot, y.creado_por, u.nombre AS creado_por_nombre, y.creado_en`;
const DESDE = `FROM proy_proyectos y JOIN proy_nichos n ON n.id = y.nicho_id LEFT JOIN proy_articulos a ON a.id = y.articulo_id
  JOIN usuarios u ON u.id = y.creado_por LEFT JOIN usuarios up ON up.id = y.aprobacion_pedida_por`;

// Quien no ve todo, ve los proyectos con al menos una de SUS tiendas en el alcance, y los que él mismo creó.
const SOLO_MIOS = `(y.creado_por = ? OR EXISTS (SELECT 1 FROM proy_proyecto_tiendas pt WHERE pt.proyecto_id = y.id
  AND pt.tienda_id IN (SELECT tienda_id FROM supervisor_tiendas WHERE usuario_id = ?)))`;

class ProyectoRepository {
  // --- Lectura ---

  async listar({ estados, anio, alcance }) {
    const donde = [];
    const params = [];
    if (!alcance.todos) { donde.push(SOLO_MIOS); params.push(alcance.usuarioId, alcance.usuarioId); }
    if (estados && estados.length) { donde.push('y.estado IN (?)'); params.push(estados); }
    if (anio) { donde.push('y.anio = ?'); params.push(anio); }
    return db.query(
      `SELECT ${COLUMNAS},
         (SELECT COUNT(*) FROM proy_proyecto_tiendas pt WHERE pt.proyecto_id = y.id) AS tiendas,
         (SELECT COUNT(*) FROM proy_participantes pa WHERE pa.proyecto_id = y.id AND pa.estado = 'activo') AS asesores,
         (SELECT COUNT(*) FROM proy_participaciones pc WHERE pc.proyecto_id = y.id) AS empresas
       ${DESDE} ${donde.length ? `WHERE ${donde.join(' AND ')}` : ''} ORDER BY y.anio DESC, y.mes DESC, y.id DESC LIMIT 500`,
      params, 'proyectos_proyecto:listar'
    );
  }

  async obtener(id, alcance, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT ${COLUMNAS} ${DESDE} WHERE y.id = ? ${alcance && !alcance.todos ? `AND ${SOLO_MIOS}` : ''}`,
      alcance && !alcance.todos ? [id, alcance.usuarioId, alcance.usuarioId] : [id], 'proyectos_proyecto:obtener'
    );
    return filas[0] ? { ...filas[0], config_snapshot: filas[0].config_snapshot ? dato(filas[0].config_snapshot) : null } : null;
  }

  tiendasDe(id, ejecutor = db) {
    return ejecutor.query(
      `SELECT t.id, t.codigo, e.nombre AS empresa, e.pais_id, p.nombre AS pais
       FROM proy_proyecto_tiendas pt JOIN tiendas t ON t.id = pt.tienda_id JOIN empresas e ON e.id = t.empresa_id JOIN paises p ON p.id = e.pais_id
       WHERE pt.proyecto_id = ? ORDER BY p.nombre, t.codigo`, [id], 'proyectos_proyecto:tiendas'
    );
  }

  participantesDe(id, ejecutor = db) {
    return ejecutor.query(
      `SELECT pa.usuario_id, u.nombre, pa.tienda_id, t.codigo AS tienda, e.pais_id, p.nombre AS pais, pa.estado, pa.motivo
       FROM proy_participantes pa JOIN usuarios u ON u.id = pa.usuario_id JOIN tiendas t ON t.id = pa.tienda_id
       JOIN empresas e ON e.id = t.empresa_id JOIN paises p ON p.id = e.pais_id WHERE pa.proyecto_id = ? ORDER BY p.nombre, t.codigo, u.nombre`,
      [id], 'proyectos_proyecto:participantes'
    );
  }

  etapasDe(id, ejecutor = db) {
    return ejecutor.query('SELECT orden, nombre, descripcion, fecha_inicio, fecha_fin FROM proy_proyecto_etapas WHERE proyecto_id = ? ORDER BY orden', [id], 'proyectos_proyecto:etapas');
  }

  // Cuántas empresas recibió cada asesor (y las que quedaron en reserva, sin asesor) en un proyecto ya repartido.
  resumenReparto(id) {
    return db.query(
      `SELECT pc.asesor_id, u.nombre AS asesor, pc.tienda_id, t.codigo AS tienda, COUNT(*) AS empresas
       FROM proy_participaciones pc LEFT JOIN usuarios u ON u.id = pc.asesor_id LEFT JOIN tiendas t ON t.id = pc.tienda_id
       WHERE pc.proyecto_id = ? GROUP BY pc.asesor_id, u.nombre, pc.tienda_id, t.codigo ORDER BY u.nombre`, [id], 'proyectos_proyecto:resumen_reparto'
    );
  }

  // --- Alcance de tiendas y asesores ---

  // Las tiendas que esta persona puede incluir (todas si es administrador) con el proyecto que las ocupa, si lo hay.
  tiendasPosibles({ todas, usuarioId }) {
    return db.query(
      `SELECT t.id, t.codigo, e.nombre AS empresa, e.pais_id, p.nombre AS pais, o.proyecto_id AS ocupada_por_id, y.nombre AS ocupada_por, y.fecha_fin AS ocupada_fin
       FROM tiendas t JOIN empresas e ON e.id = t.empresa_id JOIN paises p ON p.id = e.pais_id
       LEFT JOIN proy_proyecto_tiendas o ON o.tienda_id = t.id AND o.proyecto_abierto = 1
       LEFT JOIN proy_proyectos y ON y.id = o.proyecto_id
       WHERE t.activo = 1 ${todas ? '' : 'AND t.id IN (SELECT tienda_id FROM supervisor_tiendas WHERE usuario_id = ?)'}
       ORDER BY p.nombre, t.codigo`,
      todas ? [] : [usuarioId], 'proyectos_proyecto:tiendas_posibles'
    );
  }

  // Las tiendas pedidas que otro proyecto activo ya ocupa (distinto de `proyectoId`).
  tiendasOcupadas(tiendaIds, proyectoId = 0, ejecutor = db) {
    if (!tiendaIds.length) return [];
    return ejecutor.query(
      `SELECT t.id, t.codigo, y.id AS proyecto_id, y.nombre AS proyecto, y.fecha_fin
       FROM proy_proyecto_tiendas o JOIN tiendas t ON t.id = o.tienda_id JOIN proy_proyectos y ON y.id = o.proyecto_id
       WHERE o.proyecto_abierto = 1 AND o.proyecto_id <> ? AND o.tienda_id IN (?) ORDER BY t.codigo`,
      [proyectoId, tiendaIds], 'proyectos_proyecto:tiendas_ocupadas'
    );
  }

  // Quienes podrían participar: los asesores de esas tiendas y, si el ajuste lo permite, los supervisores que las cubren.
  async candidatos(tiendaIds, { conSupervisores }, ejecutor = db) {
    if (!tiendaIds.length) return [];
    const asesores = await ejecutor.query(
      `SELECT u.id AS usuario_id, u.nombre, a.tienda_id, t.codigo AS tienda, e.pais_id, p.nombre AS pais, 'asesor' AS tipo
       FROM asesores a JOIN usuarios u ON u.id = a.usuario_id AND u.activo = 1 JOIN tiendas t ON t.id = a.tienda_id
       JOIN empresas e ON e.id = t.empresa_id JOIN paises p ON p.id = e.pais_id WHERE a.tienda_id IN (?) ORDER BY u.id`,
      [tiendaIds], 'proyectos_proyecto:candidatos_asesores'
    );
    if (!conSupervisores) return asesores;
    // Un supervisor participa desde la primera de sus tiendas del alcance.
    const supervisores = await ejecutor.query(
      `SELECT u.id AS usuario_id, u.nombre, MIN(st.tienda_id) AS tienda_id, 'supervisor' AS tipo
       FROM supervisor_tiendas st JOIN usuarios u ON u.id = st.usuario_id AND u.activo = 1 WHERE st.tienda_id IN (?) GROUP BY u.id, u.nombre ORDER BY u.id`,
      [tiendaIds], 'proyectos_proyecto:candidatos_supervisores'
    );
    if (!supervisores.length) return asesores;
    const tiendas = await ejecutor.query(
      `SELECT t.id, t.codigo, e.pais_id, p.nombre AS pais FROM tiendas t JOIN empresas e ON e.id = t.empresa_id JOIN paises p ON p.id = e.pais_id WHERE t.id IN (?)`,
      [supervisores.map(s => s.tienda_id)], 'proyectos_proyecto:tiendas_supervisores'
    );
    const porId = new Map(tiendas.map(t => [t.id, t]));
    const yaAsesor = new Set(asesores.map(a => a.usuario_id));
    return [...asesores, ...supervisores.filter(s => !yaAsesor.has(s.usuario_id)).map(s => ({
      usuario_id: s.usuario_id, nombre: s.nombre, tienda_id: s.tienda_id, tienda: porId.get(s.tienda_id).codigo,
      pais_id: porId.get(s.tienda_id).pais_id, pais: porId.get(s.tienda_id).pais, tipo: 'supervisor'
    }))];
  }

  // --- Reparto ---

  // Las empresas que entrarían al reparto: activas, del nicho, de los países del alcance, sin participación abierta en otro
  // proyecto y fuera del periodo de descanso tras una venta. Con `bloquear`, quedan bloqueadas en orden de id.
  elegibles({ nichoId, paisIds, descansoMeses, bloquear = false }, ejecutor = db) {
    if (!paisIds.length) return [];
    return ejecutor.query(
      `SELECT c.id, c.pais_id, c.tienda_origen_id FROM proy_clientes c
       WHERE c.estado = 'activa' AND c.nicho_id = ? AND c.pais_id IN (?)
         AND NOT EXISTS (SELECT 1 FROM proy_participaciones p WHERE p.cliente_id = c.id AND p.abierta = 1)
         AND (? = 0 OR NOT EXISTS (SELECT 1 FROM proy_participaciones p JOIN proy_proyectos y ON y.id = p.proyecto_id
              WHERE p.cliente_id = c.id AND p.estado = 'vendida' AND y.nicho_id = c.nicho_id AND y.cerrado_en IS NOT NULL
                AND y.cerrado_en >= DATE_SUB(NOW(), INTERVAL ? MONTH)))
       ORDER BY c.id ${bloquear ? 'FOR UPDATE' : ''}`,
      [nichoId, paisIds, descansoMeses, descansoMeses], 'proyectos_proyecto:elegibles'
    );
  }

  // Cuántas empresas elegibles hay por nicho en esos países (para elegir el nicho del mes en el asistente).
  async contarElegiblesPorNicho({ paisIds, descansoMeses }, ejecutor = db) {
    if (!paisIds.length) return new Map();
    const filas = await ejecutor.query(
      `SELECT c.nicho_id, COUNT(*) AS n FROM proy_clientes c
       WHERE c.estado = 'activa' AND c.pais_id IN (?)
         AND NOT EXISTS (SELECT 1 FROM proy_participaciones p WHERE p.cliente_id = c.id AND p.abierta = 1)
         AND (? = 0 OR NOT EXISTS (SELECT 1 FROM proy_participaciones p JOIN proy_proyectos y ON y.id = p.proyecto_id
              WHERE p.cliente_id = c.id AND p.estado = 'vendida' AND y.nicho_id = c.nicho_id AND y.cerrado_en IS NOT NULL
                AND y.cerrado_en >= DATE_SUB(NOW(), INTERVAL ? MONTH)))
       GROUP BY c.nicho_id`,
      [paisIds, descansoMeses, descansoMeses], 'proyectos_proyecto:elegibles_por_nicho'
    );
    return new Map(filas.map(f => [f.nicho_id, Number(f.n)]));
  }

  async actualizarCodigo(tx, proyectoId, codigo) {
    await tx.query('UPDATE proy_proyectos SET codigo = ? WHERE id = ?', [codigo, proyectoId], 'proyectos_proyecto:codigo');
  }

  // Resuelve el visto bueno del cierre (dar, devolver o reenviar) solo si sigue en el estado de partida; devuelve las filas cambiadas.
  async resolverVistoBueno(tx, proyectoId, { desde, hacia, por = null, comentario = null, conclusiones }) {
    const asignarConclusiones = conclusiones === undefined ? '' : ', conclusiones = ?';
    const extra = conclusiones === undefined ? [] : [conclusiones];
    const r = await tx.query(
      `UPDATE proy_proyectos SET visto_bueno_estado = ?, visto_bueno_por = ?, visto_bueno_en = ?, visto_bueno_comentario = ?${asignarConclusiones}
       WHERE id = ? AND estado = 'cerrado' AND visto_bueno_estado = ?`,
      [hacia, por, por ? new Date() : null, comentario, ...extra, proyectoId, desde], 'proyectos_proyecto:visto_bueno');
    return r.affectedRows;
  }

  async insertarParticipaciones(tx, proyectoId, asignaciones, reserva) {
    const filas = [
      ...asignaciones.map(a => [proyectoId, a.clienteId, a.asesorId, a.tiendaId]),
      ...reserva.map(clienteId => [proyectoId, clienteId, null, null])
    ];
    const ahora = new Date();
    for (let i = 0; i < filas.length; i += 500) {
      await tx.query('INSERT INTO proy_participaciones (proyecto_id, cliente_id, asesor_id, tienda_id, asignada_en) VALUES ?',
        [filas.slice(i, i + 500).map(f => [...f, f[2] === null ? null : ahora])], 'proyectos_proyecto:insertar_participaciones');
    }
  }

  // El proyecto activo del nicho en el que esta persona participa como asesor y que cubre el país de la empresa
  // (regla 16: la empresa nueva de ese nicho se le asigna a ella). `null` si no hay.
  async proyectoActivoDe(usuarioId, nichoId, paisId, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT y.id, pa.tienda_id FROM proy_proyectos y
       JOIN proy_participantes pa ON pa.proyecto_id = y.id AND pa.usuario_id = ? AND pa.estado = 'activo'
       WHERE y.estado = 'activo' AND y.nicho_id = ?
         AND EXISTS (SELECT 1 FROM proy_proyecto_tiendas pt JOIN tiendas t ON t.id = pt.tienda_id JOIN empresas e ON e.id = t.empresa_id
                     WHERE pt.proyecto_id = y.id AND e.pais_id = ?)
       ORDER BY y.id LIMIT 1`,
      [usuarioId, nichoId, paisId], 'proyectos_proyecto:activo_de'
    );
    return filas[0] || null;
  }

  asignarEmpresa(tx, { proyectoId, clienteId, asesorId, tiendaId, asignadaPor }) {
    return tx.query(
      'INSERT INTO proy_participaciones (proyecto_id, cliente_id, asesor_id, tienda_id, asignada_en, asignada_por) VALUES (?, ?, ?, ?, NOW(), ?)',
      [proyectoId, clienteId, asesorId, tiendaId, asignadaPor], 'proyectos_proyecto:asignar_empresa'
    );
  }

  // --- Escritura del proyecto ---

  async insertar(tx, d) {
    const res = await tx.query(
      `INSERT INTO proy_proyectos (codigo, nombre, nicho_id, anio, mes, articulo_id, existencia_muestras, plantilla_id, meta_monto, meta_moneda,
         estado, fecha_inicio, fecha_fin, tope_por_asesor, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?, ?, ?, ?)`,
      [d.codigo, d.nombre, d.nichoId, d.anio, d.mes, d.articuloId, d.existenciaMuestras, d.plantillaId, d.metaMonto, d.metaMoneda, d.fechaInicio, d.fechaFin, d.topePorAsesor, d.creadoPor],
      'proyectos_proyecto:insertar'
    );
    return res.insertId;
  }

  actualizar(tx, id, d) {
    return tx.query(
      `UPDATE proy_proyectos SET nombre = ?, nicho_id = ?, anio = ?, mes = ?, articulo_id = ?, existencia_muestras = ?, plantilla_id = ?, meta_monto = ?,
         meta_moneda = ?, fecha_inicio = ?, fecha_fin = ?, tope_por_asesor = ? WHERE id = ? AND estado = 'borrador'`,
      [d.nombre, d.nichoId, d.anio, d.mes, d.articuloId, d.existenciaMuestras, d.plantillaId, d.metaMonto, d.metaMoneda, d.fechaInicio, d.fechaFin, d.topePorAsesor, id], 'proyectos_proyecto:actualizar'
    );
  }

  async reemplazarTiendas(tx, id, tiendaIds) {
    await tx.query('DELETE FROM proy_proyecto_tiendas WHERE proyecto_id = ?', [id], 'proyectos_proyecto:borrar_tiendas');
    for (const tiendaId of tiendaIds) await tx.query('INSERT INTO proy_proyecto_tiendas (proyecto_id, tienda_id, proyecto_abierto) VALUES (?, ?, 0)', [id, tiendaId], 'proyectos_proyecto:insertar_tienda');
  }

  async reemplazarParticipantes(tx, id, filas) {
    await tx.query('DELETE FROM proy_participantes WHERE proyecto_id = ?', [id], 'proyectos_proyecto:borrar_participantes');
    for (const f of filas) {
      await tx.query('INSERT INTO proy_participantes (proyecto_id, usuario_id, tienda_id, estado, motivo) VALUES (?, ?, ?, ?, ?)',
        [id, f.usuarioId, f.tiendaId, f.estado, f.motivo || null], 'proyectos_proyecto:insertar_participante');
    }
  }

  async reemplazarEtapas(tx, id, etapas) {
    await tx.query('DELETE FROM proy_proyecto_etapas WHERE proyecto_id = ?', [id], 'proyectos_proyecto:borrar_etapas');
    for (const [i, e] of etapas.entries()) {
      await tx.query('INSERT INTO proy_proyecto_etapas (proyecto_id, orden, nombre, descripcion, fecha_inicio, fecha_fin) VALUES (?, ?, ?, ?, ?, ?)',
        [id, i + 1, e.nombre, e.descripcion || null, e.fechaInicio || null, e.fechaFin || null], 'proyectos_proyecto:insertar_etapa');
    }
  }

  // Los códigos que ya empiezan igual, para no repetir el del proyecto nuevo.
  async codigosCon(prefijo, ejecutor = db) {
    const escapado = String(prefijo).replace(/[\\%_]/g, '\\$&');
    return new Set((await ejecutor.query('SELECT codigo FROM proy_proyectos WHERE codigo LIKE ?', [`${escapado}%`], 'proyectos_proyecto:codigos')).map(f => f.codigo));
  }

  // --- Cambios de estado (todos condicionales: el UPDATE compara el estado de partida) ---

  async cambiarEstado(tx, id, desde, hasta, extra = {}) {
    const columnas = Object.keys(extra);
    const res = await tx.query(
      `UPDATE proy_proyectos SET estado = ?${columnas.map(c => `, \`${c}\` = ?`).join('')} WHERE id = ? AND estado IN (?)`,
      [hasta, ...columnas.map(c => extra[c]), id, desde], 'proyectos_proyecto:estado'
    );
    return res.affectedRows;
  }

  abrirTiendas(tx, id) {
    return tx.query('UPDATE proy_proyecto_tiendas SET proyecto_abierto = 1 WHERE proyecto_id = ?', [id], 'proyectos_proyecto:abrir_tiendas');
  }

  cerrarTiendas(tx, id) {
    return tx.query('UPDATE proy_proyecto_tiendas SET proyecto_abierto = 0 WHERE proyecto_id = ?', [id], 'proyectos_proyecto:cerrar_tiendas');
  }

  liberarEmpresas(tx, id) {
    return tx.query('UPDATE proy_participaciones SET abierta = 0 WHERE proyecto_id = ?', [id], 'proyectos_proyecto:liberar_empresas');
  }

  registrarHistorial(tx, { proyectoId, usuarioId, accion, detalle }) {
    return tx.query('INSERT INTO proy_historial (proyecto_id, usuario_id, accion, detalle) VALUES (?, ?, ?, ?)',
      [proyectoId, usuarioId, accion, detalle ? JSON.stringify(detalle) : null], 'proyectos_proyecto:historial');
  }

  // Quién bloquea cada tienda o empresa de este proyecto: para decir con claridad por qué falló una activación.
  async conflictosDeActivacion(id) {
    const tiendas = await db.query(
      `SELECT t.codigo AS tienda, y.nombre AS proyecto FROM proy_proyecto_tiendas a JOIN proy_proyecto_tiendas b
         ON b.tienda_id = a.tienda_id AND b.proyecto_abierto = 1 AND b.proyecto_id <> a.proyecto_id
       JOIN proy_proyectos y ON y.id = b.proyecto_id JOIN tiendas t ON t.id = a.tienda_id WHERE a.proyecto_id = ? ORDER BY t.codigo`,
      [id], 'proyectos_proyecto:conflicto_tiendas'
    );
    return { tiendas };
  }
}

module.exports = new ProyectoRepository();
