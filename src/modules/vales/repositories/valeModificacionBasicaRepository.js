// src/modules/vales/repositories/valeModificacionBasicaRepository.js
// Modificación básica: no crea vale MOD, el asesor y un taller conversan y el taller acepta o rechaza el cambio.
// Una fila por (vale, taller). Cuelga de `vales` y `vale_talleres` con ON DELETE CASCADE: al eliminarse el vale se van
// la solicitud y su conversación.
const db = require('../../../config/database');

const SELECT_MODIFICACION = `
  SELECT m.*, vt.taller_id, vt.disenador_id, t.nombre AS taller, u.nombre AS solicitante
  FROM vale_modificaciones_basicas m
  JOIN vale_talleres vt ON vt.id = m.vale_taller_id
  JOIN talleres t ON t.id = vt.taller_id
  JOIN usuarios u ON u.id = m.solicitante_id
`;

const SQL_HISTORIAL = 'INSERT INTO vale_historial (vale_id, usuario_id, taller_id, estado_anterior, estado_nuevo, accion, disenador_id) VALUES (?, ?, ?, ?, ?, ?, ?)';

class ValeModificacionBasicaRepository {
  // Abre una solicitud por taller elegido, cada una con el primer mensaje del asesor, y deja el rastro en el historial.
  async crear({ valeId, solicitanteId, filas, fechaAnterior, fechaNueva, mensaje, estadoVale }) {
    return db.transaccion(async (tx) => {
      const ids = [];
      for (const fila of filas) {
        const abierta = await tx.query(
          "SELECT id FROM vale_modificaciones_basicas WHERE vale_taller_id = ? AND estado IN ('EN_CONVERSACION', 'ACEPTADA') LIMIT 1",
          [fila.id], 'modificacion_basica:validar_abierta'
        );
        if (abierta.length) throw new Error(`${fila.taller_nombre} ya tiene una modificación en curso.`);
        const ins = await tx.query(
          'INSERT INTO vale_modificaciones_basicas (vale_id, vale_taller_id, solicitante_id, fecha_entrega_anterior, fecha_entrega_nueva) VALUES (?, ?, ?, ?, ?)',
          [valeId, fila.id, solicitanteId, fechaAnterior, fechaNueva], 'modificacion_basica:insert'
        );
        await tx.query(
          "INSERT INTO vale_modificacion_mensajes (modificacion_id, autor_id, lado, mensaje) VALUES (?, ?, 'ASESOR', ?)",
          [ins.insertId, solicitanteId, mensaje], 'modificacion_basica:insert_mensaje'
        );
        await tx.query(SQL_HISTORIAL,
          [valeId, solicitanteId, fila.taller_id, estadoVale, estadoVale, `Asesor pidió una modificación básica a ${fila.taller_nombre}: ${mensaje}`, fila.disenador_id || null],
          'historial:insert_modificacion_basica');
        ids.push(ins.insertId);
      }
      return ids;
    });
  }

  async obtenerPorId(id) {
    const rows = await db.query(`${SELECT_MODIFICACION} WHERE m.id = ?`, [id], 'modificacion_basica:find_by_id');
    return rows[0] || null;
  }

  async listarPorVale(valeId) {
    return db.query(`${SELECT_MODIFICACION} WHERE m.vale_id = ? ORDER BY m.id ASC`, [valeId], 'modificacion_basica:list_by_vale');
  }

  // Cuántas conversaciones siguen abiertas en un vale (impiden confirmarlo o pedir otra modificación).
  async contarAbiertasPorVale(valeId) {
    const rows = await db.query(
      "SELECT COUNT(*) AS total FROM vale_modificaciones_basicas WHERE vale_id = ? AND estado = 'EN_CONVERSACION'",
      [valeId], 'modificacion_basica:count_abiertas_vale'
    );
    return Number(rows[0].total);
  }

  // Para las listas del buzón: las conversaciones abiertas de varios vales en una sola consulta.
  async listarAbiertasPorVales(valeIds) {
    if (!valeIds.length) return [];
    return db.query(
      `SELECT m.id, m.vale_id, vt.taller_id, m.creado_en
       FROM vale_modificaciones_basicas m JOIN vale_talleres vt ON vt.id = m.vale_taller_id
       WHERE m.vale_id IN (?) AND m.estado = 'EN_CONVERSACION'`,
      [valeIds], 'modificacion_basica:list_abiertas_vales'
    );
  }

  // Rechazos más recientes de cada taller (sin una solicitud posterior al mismo taller): el asesor los ve en su buzón.
  async listarRechazadasRecientesPorVales(valeIds) {
    if (!valeIds.length) return [];
    return db.query(
      `SELECT m.id, m.vale_id, vt.taller_id, m.resuelto_en
       FROM vale_modificaciones_basicas m JOIN vale_talleres vt ON vt.id = m.vale_taller_id
       WHERE m.vale_id IN (?) AND m.estado = 'RECHAZADA'
         AND NOT EXISTS (SELECT 1 FROM vale_modificaciones_basicas n WHERE n.vale_taller_id = m.vale_taller_id AND n.id > m.id)`,
      [valeIds], 'modificacion_basica:list_rechazadas_vales'
    );
  }

  // El taller aceptó: su fila vuelve a ASIGNADO (mismo diseñador) y el vale sale del paso 5 (o de Recibido) con la nueva fecha de entrega.
  // Todo o nada; cada UPDATE exige el estado esperado por si algo cambió mientras tanto.
  async aceptar({ id, valeId, valeTallerId, tallerId, disenadorId, usuarioId, estadoValeAnterior, fechaEntrega, fechaAsignacion, accion }) {
    return db.transaccion(async (tx) => {
      const mod = await tx.query(
        "UPDATE vale_modificaciones_basicas SET estado = 'ACEPTADA', resuelto_en = NOW(), resuelto_por = ? WHERE id = ? AND estado = 'EN_CONVERSACION'",
        [usuarioId, id], 'modificacion_basica:aceptar'
      );
      if (mod.affectedRows !== 1) throw new Error('Esta solicitud ya se cerró. Actualiza la pantalla.');
      const fila = await tx.query(
        `UPDATE vale_talleres SET estado_id = (SELECT id FROM estados_taller WHERE nombre = 'ASIGNADO'),
           fecha_asignacion = ?, atraso_congelado_en = NULL
         WHERE id = ? AND estado_id = (SELECT id FROM estados_taller WHERE nombre = 'APROBADO')`,
        [fechaAsignacion, valeTallerId], 'modificacion_basica:reabrir_taller'
      );
      if (fila.affectedRows !== 1) throw new Error('El taller ya no tiene la propuesta aprobada. Actualiza la pantalla.');
      const vale = await tx.query(
        `UPDATE vales SET estado_id = (SELECT id FROM estados_vale WHERE nombre = 'CREADO'),
           fecha_entrega = ?, atraso_congelado_en = NULL, atraso_notificado_en = NULL, confirmado_en = NULL
         WHERE id = ? AND estado_id IN (SELECT id FROM estados_vale WHERE nombre IN ('PENDIENTE_CONFIRMACION', 'CREADO', 'RECIBIDO'))`,
        [fechaEntrega, valeId], 'modificacion_basica:reabrir_vale'
      );
      if (vale.affectedRows !== 1) throw new Error('El vale cambió de estado. Actualiza la pantalla.');
      await tx.query(SQL_HISTORIAL, [valeId, usuarioId, tallerId, 'APROBADO', 'ASIGNADO', accion, disenadorId || null], 'historial:insert_modificacion_basica_aceptada');
      if (estadoValeAnterior !== 'CREADO') {
        await tx.query(SQL_HISTORIAL, [valeId, usuarioId, null, estadoValeAnterior, 'CREADO', 'El vale vuelve al taller por una modificación básica aceptada', null], 'historial:insert_vale_reabierto');
      }
    });
  }

  // Rechazada por el taller o cancelada por el asesor: el vale no cambia, solo se cierra la conversación.
  async cerrar({ id, estado, usuarioId, valeId, tallerId, estadoVale, accion }) {
    return db.transaccion(async (tx) => {
      const res = await tx.query(
        "UPDATE vale_modificaciones_basicas SET estado = ?, resuelto_en = NOW(), resuelto_por = ? WHERE id = ? AND estado = 'EN_CONVERSACION'",
        [estado, usuarioId, id], 'modificacion_basica:cerrar'
      );
      if (res.affectedRows !== 1) throw new Error('Esta solicitud ya se cerró. Actualiza la pantalla.');
      await tx.query(SQL_HISTORIAL, [valeId, usuarioId, tallerId, estadoVale, estadoVale, accion, null], 'historial:insert_modificacion_basica_cerrada');
    });
  }

  // La nueva propuesta ya fue aprobada por el encargado: la modificación termina. Devuelve cuántas filas cerró.
  async marcarEntregadaPorFila(valeTallerId) {
    const res = await db.query(
      "UPDATE vale_modificaciones_basicas SET estado = 'ENTREGADA' WHERE vale_taller_id = ? AND estado = 'ACEPTADA'",
      [valeTallerId], 'modificacion_basica:marcar_entregada'
    );
    return res.affectedRows;
  }

  async crearMensaje(modificacionId, autorId, lado, mensaje) {
    const res = await db.query(
      'INSERT INTO vale_modificacion_mensajes (modificacion_id, autor_id, lado, mensaje) VALUES (?, ?, ?, ?)',
      [modificacionId, autorId, lado, mensaje], 'modificacion_basica:insert_mensaje_chat'
    );
    return res.insertId;
  }

  async listarMensajes(modificacionId) {
    return db.query(
      `SELECT m.id, m.lado, m.mensaje, m.creado_en, m.autor_id, u.nombre AS autor
       FROM vale_modificacion_mensajes m JOIN usuarios u ON u.id = m.autor_id
       WHERE m.modificacion_id = ? ORDER BY m.id ASC`,
      [modificacionId], 'modificacion_basica:list_mensajes'
    );
  }

  async contarMensajes(modificacionIds) {
    if (!modificacionIds.length) return new Map();
    const filas = await db.query(
      'SELECT modificacion_id, COUNT(*) AS total FROM vale_modificacion_mensajes WHERE modificacion_id IN (?) GROUP BY modificacion_id',
      [modificacionIds], 'modificacion_basica:count_mensajes'
    );
    return new Map(filas.map(f => [f.modificacion_id, Number(f.total)]));
  }
}

module.exports = new ValeModificacionBasicaRepository();
