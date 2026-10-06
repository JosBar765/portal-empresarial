// src/modules/vales/repositories/valeRechazoRepository.js
// Rechazo de una creación y su reenvío: estado, motivo e historial cambian juntos o no cambian.
const db = require('../../../config/database');

class ValeRechazoRepository {
  // `estadoPendiente`: ESPERANDO_AUTORIZACION para un vale normal, SOLICITANDO_MODIFICACION para un MOD-.
  async rechazar({ valeId, usuarioId, motivo, rechazadoEn, accionHistorial, estadoPendiente = 'ESPERANDO_AUTORIZACION' }) {
    return db.transaccion(async (tx) => {
      const res = await tx.query(
        `UPDATE vales SET estado_id = (SELECT id FROM estados_vale WHERE nombre = 'RECHAZADO'),
           rechazado_por = ?, rechazado_en = ?, rechazo_motivo = ?
         WHERE id = ? AND estado_id = (SELECT id FROM estados_vale WHERE nombre = ?)`,
        [usuarioId, rechazadoEn, motivo, valeId, estadoPendiente],
        'vale:rechazar'
      );
      if (res.affectedRows !== 1) throw new Error('Solo se puede rechazar un vale que está esperando autorización.');
      await tx.query(
        'INSERT INTO vale_historial (vale_id, usuario_id, taller_id, estado_anterior, estado_nuevo, accion, tecnico_id) VALUES (?, ?, NULL, ?, ?, ?, NULL)',
        [valeId, usuarioId, estadoPendiente, 'RECHAZADO', accionHistorial],
        'historial:insert_rechazo'
      );
    });
  }

  async reenviar({ valeId, usuarioId, accionHistorial, estadoDestino = 'ESPERANDO_AUTORIZACION' }) {
    return db.transaccion(async (tx) => {
      const res = await tx.query(
        `UPDATE vales SET estado_id = (SELECT id FROM estados_vale WHERE nombre = ?),
           rechazado_por = NULL, rechazado_en = NULL, rechazo_motivo = NULL
         WHERE id = ? AND estado_id = (SELECT id FROM estados_vale WHERE nombre = 'RECHAZADO')`,
        [estadoDestino, valeId],
        'vale:reenviar'
      );
      if (res.affectedRows !== 1) throw new Error('Este vale no está rechazado, no hace falta reenviarlo.');
      await tx.query('DELETE FROM vale_vistos WHERE vale_id = ?', [valeId], 'vale_visto:reiniciar_reenvio');
      await tx.query(
        'INSERT INTO vale_historial (vale_id, usuario_id, taller_id, estado_anterior, estado_nuevo, accion, tecnico_id) VALUES (?, ?, NULL, ?, ?, ?, NULL)',
        [valeId, usuarioId, 'RECHAZADO', estadoDestino, accionHistorial],
        'historial:insert_reenvio'
      );
    });
  }
}

module.exports = new ValeRechazoRepository();
