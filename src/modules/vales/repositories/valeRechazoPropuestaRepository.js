// src/modules/vales/repositories/valeRechazoPropuestaRepository.js
// Rechazo de propuesta: el asesor dueño rechaza la propuesta de un taller y conversan; el taller acepta o rechaza el rechazo.
// Una ronda por (vale, taller) en `vale_rechazos_propuesta`; el hilo es uno por taller (`vale_rechazo_propuesta_mensajes`) y lo
// comparten todas sus rondas. Cuelga de `vales` y `vale_talleres` con ON DELETE CASCADE: al eliminarse el vale se va todo.
const db = require('../../../config/database');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');

const SELECT_RECHAZO = `
  SELECT r.*, vt.taller_id, vt.disenador_id, t.nombre AS taller, u.nombre AS solicitante
  FROM vale_rechazos_propuesta r
  JOIN vale_talleres vt ON vt.id = r.vale_taller_id
  JOIN talleres t ON t.id = vt.taller_id
  JOIN usuarios u ON u.id = r.solicitante_id
`;

const SQL_HISTORIAL = 'INSERT INTO vale_historial (vale_id, usuario_id, taller_id, estado_anterior, estado_nuevo, accion, disenador_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
const SQL_MENSAJE = 'INSERT INTO vale_rechazo_propuesta_mensajes (vale_taller_id, autor_id, lado, mensaje) VALUES (?, ?, ?, ?)';

class ValeRechazoPropuestaRepository {
  // Abre una ronda por taller elegido, cada una con el mensaje del asesor en el hilo de ese taller, y deja el rastro en el historial.
  async crear({ valeId, solicitanteId, filas, mensaje, estadoVale }) {
    return db.transaccion(async (tx) => {
      // Bloquea las filas de los talleres (siempre en orden de id) para que dos procesos no abran la misma ronda a la vez.
      const bloqueo = filas.map(f => f.id).sort((a, b) => a - b);
      await tx.query(`SELECT id FROM vale_talleres WHERE id IN (${bloqueo.map(() => '?').join(', ')}) ORDER BY id FOR UPDATE`, bloqueo, 'rechazo_propuesta:bloquear_talleres');
      const ids = [];
      for (const fila of filas) {
        const abierto = await tx.query(
          "SELECT id FROM vale_rechazos_propuesta WHERE vale_taller_id = ? AND estado = 'ABIERTO' LIMIT 1 FOR UPDATE",
          [fila.id], 'rechazo_propuesta:validar_abierto'
        );
        if (abierto.length) throw new ErrorDeNegocio(`Ya hay un rechazo abierto con ${fila.taller_nombre}. Espera su respuesta.`, 409);
        const ins = await tx.query(
          'INSERT INTO vale_rechazos_propuesta (vale_id, vale_taller_id, solicitante_id) VALUES (?, ?, ?)',
          [valeId, fila.id, solicitanteId], 'rechazo_propuesta:insert'
        );
        await tx.query(SQL_MENSAJE, [fila.id, solicitanteId, 'ASESOR', mensaje], 'rechazo_propuesta:insert_mensaje');
        await tx.query(SQL_HISTORIAL,
          [valeId, solicitanteId, fila.taller_id, estadoVale, estadoVale, `Asesor rechazó la propuesta de ${fila.taller_nombre}: ${mensaje}`, fila.disenador_id || null],
          'historial:insert_rechazo_propuesta');
        ids.push(ins.insertId);
      }
      return ids;
    });
  }

  async obtenerPorId(id) {
    const rows = await db.query(`${SELECT_RECHAZO} WHERE r.id = ?`, [id], 'rechazo_propuesta:find_by_id');
    return rows[0] || null;
  }

  // Rondas que siguen a la vista: la última de cada taller si está abierta o fue rechazada por el taller (aceptada o cancelada se cierra).
  async listarVigentesPorVales(valeIds) {
    if (!valeIds.length) return [];
    return db.query(
      `SELECT r.id, r.vale_id, r.vale_taller_id, vt.taller_id, t.nombre AS taller, r.estado, r.creado_en, r.resuelto_en
       FROM vale_rechazos_propuesta r
       JOIN vale_talleres vt ON vt.id = r.vale_taller_id
       JOIN talleres t ON t.id = vt.taller_id
       WHERE r.vale_id IN (?) AND r.estado IN ('ABIERTO', 'RECHAZADO')
         AND NOT EXISTS (SELECT 1 FROM vale_rechazos_propuesta n WHERE n.vale_taller_id = r.vale_taller_id AND n.id > r.id)
       ORDER BY r.id ASC`,
      [valeIds], 'rechazo_propuesta:list_vigentes_vales'
    );
  }

  // Todas las rondas de un vale, abiertas o cerradas: el hilo de cada taller permanece como registro mientras el vale exista.
  async listarPorVale(valeId) {
    return db.query(
      `SELECT r.id, r.vale_id, r.vale_taller_id, vt.taller_id, vt.disenador_id, vt.activo, t.nombre AS taller, r.estado, r.creado_en, r.resuelto_en
       FROM vale_rechazos_propuesta r
       JOIN vale_talleres vt ON vt.id = r.vale_taller_id
       JOIN talleres t ON t.id = vt.taller_id
       WHERE r.vale_id = ? ORDER BY r.id ASC`,
      [valeId], 'rechazo_propuesta:list_vale'
    );
  }

  // Una consulta por lote: la última ronda de cada hilo (taller) de los vales dados, para mostrar el acceso al chat en los listados.
  async listarHilosPorVales(valeIds) {
    if (!valeIds.length) return [];
    return db.query(
      `SELECT r.id, r.vale_id, r.vale_taller_id, vt.taller_id, vt.disenador_id, vt.activo, t.nombre AS taller, r.estado
       FROM vale_rechazos_propuesta r
       JOIN vale_talleres vt ON vt.id = r.vale_taller_id
       JOIN talleres t ON t.id = vt.taller_id
       WHERE r.vale_id IN (?)
         AND NOT EXISTS (SELECT 1 FROM vale_rechazos_propuesta n WHERE n.vale_taller_id = r.vale_taller_id AND n.id > r.id)
       ORDER BY r.id ASC`,
      [valeIds], 'rechazo_propuesta:list_hilos_vales'
    );
  }

  // Última ronda de un hilo: dice si la conversación sigue abierta aunque se consulte desde una ronda anterior.
  async obtenerUltimaDeHilo(valeTallerId) {
    const rows = await db.query(`${SELECT_RECHAZO} WHERE r.vale_taller_id = ? ORDER BY r.id DESC LIMIT 1`, [valeTallerId], 'rechazo_propuesta:find_ultima_hilo');
    return rows[0] || null;
  }

  // Cuántas rondas siguen abiertas en un vale (impiden confirmarlo o pedir una modificación).
  async contarAbiertasPorVale(valeId) {
    const rows = await db.query(
      "SELECT COUNT(*) AS total FROM vale_rechazos_propuesta WHERE vale_id = ? AND estado = 'ABIERTO'",
      [valeId], 'rechazo_propuesta:count_abiertas_vale'
    );
    return Number(rows[0].total);
  }

  // Ids de los vales con un rechazo abierto con un taller (o con cualquiera si no se indica): el buzón del taller los muestra siempre.
  async listarValeIdsAbiertosDeTaller(tallerId = null) {
    const filtroTaller = tallerId ? ' AND vt.taller_id = ?' : '';
    const filas = await db.query(
      `SELECT DISTINCT r.vale_id FROM vale_rechazos_propuesta r JOIN vale_talleres vt ON vt.id = r.vale_taller_id
       WHERE r.estado = 'ABIERTO'${filtroTaller}`,
      tallerId ? [tallerId] : [], 'rechazo_propuesta:list_vale_ids_abiertos_taller'
    );
    return filas.map(f => f.vale_id);
  }

  // Ids de los vales devueltos por una ronda aceptada que siguen en manos del taller (su fila ya no está aprobada): el buzón los muestra siempre.
  async listarValeIdsDevueltosDeTaller(tallerId = null) {
    const filtroTaller = tallerId ? ' AND rt.taller_id = ?' : '';
    const filas = await db.query(
      `SELECT DISTINCT r.vale_id FROM vale_rechazos_propuesta r
       JOIN vale_talleres rt ON rt.id = r.vale_taller_id
       JOIN vale_talleres vt ON vt.vale_id = rt.vale_id AND vt.taller_id = rt.taller_id AND vt.activo = 1
       JOIN estados_taller et ON et.id = vt.estado_id
       WHERE r.estado = 'ACEPTADO' AND et.nombre <> 'APROBADO'${filtroTaller}`,
      tallerId ? [tallerId] : [], 'rechazo_propuesta:list_vale_ids_devueltos_taller'
    );
    return filas.map(f => f.vale_id);
  }

  // El taller acepta: su fila vuelve a «Por asignar» (sin diseñador), el vale sale del paso 5 y el atraso vuelve a correr.
  // La fecha de entrega no se toca. Todo o nada; cada UPDATE exige el estado esperado por si algo cambió mientras tanto.
  async aceptar({ id, valeId, valeTallerId, tallerId, usuarioId, estadoValeAnterior, accion }) {
    return db.transaccion(async (tx) => {
      const ronda = await tx.query(
        "UPDATE vale_rechazos_propuesta SET estado = 'ACEPTADO', resuelto_en = NOW(), resuelto_por = ? WHERE id = ? AND estado = 'ABIERTO'",
        [usuarioId, id], 'rechazo_propuesta:aceptar'
      );
      if (ronda.affectedRows !== 1) throw new ErrorDeNegocio('Este rechazo ya se cerró. Actualiza la pantalla.', 409);
      const fila = await tx.query(
        `UPDATE vale_talleres SET estado_id = (SELECT id FROM estados_taller WHERE nombre = 'PENDIENTE_ASIGNACION'),
           disenador_id = NULL, fecha_asignacion = NULL, atraso_congelado_en = NULL
         WHERE id = ? AND estado_id = (SELECT id FROM estados_taller WHERE nombre = 'APROBADO')`,
        [valeTallerId], 'rechazo_propuesta:reabrir_taller'
      );
      if (fila.affectedRows !== 1) throw new ErrorDeNegocio('El taller ya no tiene la propuesta aprobada. Actualiza la pantalla.', 409);
      const vale = await tx.query(
        `UPDATE vales SET estado_id = (SELECT id FROM estados_vale WHERE nombre = 'CREADO'),
           atraso_congelado_en = NULL, atraso_notificado_en = NULL
         WHERE id = ? AND estado_id IN (SELECT id FROM estados_vale WHERE nombre IN ('PENDIENTE_CONFIRMACION', 'CREADO', 'APROBADO_DEPARTAMENTO'))`,
        [valeId], 'rechazo_propuesta:reabrir_vale'
      );
      if (vale.affectedRows !== 1) throw new ErrorDeNegocio('El vale cambió de estado. Actualiza la pantalla.', 409);
      await tx.query(SQL_HISTORIAL, [valeId, usuarioId, tallerId, 'APROBADO', 'PENDIENTE_ASIGNACION', accion, null], 'historial:insert_rechazo_propuesta_aceptado');
      if (estadoValeAnterior !== 'CREADO') {
        await tx.query(SQL_HISTORIAL, [valeId, usuarioId, null, estadoValeAnterior, 'CREADO', 'El vale vuelve al taller por un rechazo de propuesta aceptado', null], 'historial:insert_vale_reabierto');
      }
    });
  }

  // Rechazada por el taller (con su mensaje en el hilo) o cancelada por el asesor: la ronda se cierra y el vale no cambia.
  async cerrar({ id, estado, usuarioId, valeId, tallerId, valeTallerId, estadoVale, accion, mensaje = null }) {
    return db.transaccion(async (tx) => {
      const res = await tx.query(
        "UPDATE vale_rechazos_propuesta SET estado = ?, resuelto_en = NOW(), resuelto_por = ? WHERE id = ? AND estado = 'ABIERTO'",
        [estado, usuarioId, id], 'rechazo_propuesta:cerrar'
      );
      if (res.affectedRows !== 1) throw new ErrorDeNegocio('Este rechazo ya se cerró. Actualiza la pantalla.', 409);
      if (mensaje) await tx.query(SQL_MENSAJE, [valeTallerId, usuarioId, 'TALLER', mensaje], 'rechazo_propuesta:insert_mensaje_cierre');
      await tx.query(SQL_HISTORIAL, [valeId, usuarioId, tallerId, estadoVale, estadoVale, accion, null], 'historial:insert_rechazo_propuesta_cerrado');
    });
  }

  async crearMensaje(valeTallerId, autorId, lado, mensaje) {
    const res = await db.query(SQL_MENSAJE, [valeTallerId, autorId, lado, mensaje], 'rechazo_propuesta:insert_mensaje_chat');
    return res.insertId;
  }

  async listarMensajes(valeTallerId) {
    return db.query(
      `SELECT m.id, m.lado, m.mensaje, m.creado_en, m.autor_id, u.nombre AS autor
       FROM vale_rechazo_propuesta_mensajes m JOIN usuarios u ON u.id = m.autor_id
       WHERE m.vale_taller_id = ? ORDER BY m.id ASC`,
      [valeTallerId], 'rechazo_propuesta:list_mensajes'
    );
  }

  // Registro: todos los hilos de un vale (abiertos o cerrados), con el nombre del taller.
  async listarMensajesPorVale(valeId) {
    return db.query(
      `SELECT m.id, vt.taller_id, t.nombre AS taller, m.lado, m.mensaje, m.creado_en, m.autor_id, u.nombre AS autor
       FROM vale_rechazo_propuesta_mensajes m
       JOIN vale_talleres vt ON vt.id = m.vale_taller_id
       JOIN talleres t ON t.id = vt.taller_id
       JOIN usuarios u ON u.id = m.autor_id
       WHERE vt.vale_id = ? ORDER BY m.id ASC`,
      [valeId], 'rechazo_propuesta:list_mensajes_vale'
    );
  }
}

module.exports = new ValeRechazoPropuestaRepository();
