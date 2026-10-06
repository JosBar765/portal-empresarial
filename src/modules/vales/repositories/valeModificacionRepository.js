// src/modules/vales/repositories/valeModificacionRepository.js
// Solicitud de modificación: el vale MOD- nace al solicitarla (esperando autorización) y se borra si se rechaza.
const db = require('../../../config/database');

class ValeModificacionRepository {
  // Crea el vale MOD- con sus documentos, marca el original como "solicitando modificación" y registra ambos historiales.
  async crear({ original, datos, correlativo, fechaCreacion, horaCreacion, pdfUrl, documentos, usuarioId, talleresIds }) {
    return db.transaccion(async (tx) => {
      const res = await tx.query(
        `UPDATE vales SET estado_id = (SELECT id FROM estados_vale WHERE nombre = 'SOLICITANDO_MODIFICACION')
         WHERE id = ? AND estado_id IN (SELECT id FROM estados_vale WHERE nombre IN ('RECIBIDO', 'PENDIENTE_CONFIRMACION'))`,
        [original.id], 'vale:solicitar_modificacion'
      );
      if (res.affectedRows !== 1) throw new Error('Solo se puede solicitar una modificación de un vale que ya fue entregado o recibido.');
      const ins = await tx.query(
        `INSERT INTO vales (
          correlativo, asesor_id, tienda_id, vale_original_id, fecha_creacion, hora_creacion, fecha_entrega, fecha_evento, urgente,
          cliente_empresa, cliente_nombre, cliente_telefono, cliente_correo,
          producto, material, tecnica, acabado, cantidad, cotizacion, descripcion, talleres_solicitados, pdf_url, estado_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          (SELECT id FROM estados_vale WHERE nombre = 'ESPERANDO_AUTORIZACION'))`,
        [
          correlativo, original.asesor_id, original.tienda_id, original.id, fechaCreacion, horaCreacion,
          datos.fechaEntregaNorm, datos.fechaEventoNorm, datos.urgente ? 1 : 0,
          datos.clienteEmpresa || null, datos.clienteNombre, datos.clienteTelefono, datos.clienteCorreo,
          datos.producto, datos.material, datos.tecnica, datos.acabado, datos.cantidad, datos.cotizacion,
          datos.descripcion, talleresIds.join(','), pdfUrl
        ],
        'vale:insert_modificacion'
      );
      const modId = ins.insertId;
      for (const doc of documentos) {
        await tx.query(
          `INSERT INTO vale_documentos (vale_id, nombre_original, ruta, tipo_id, mime_type, tamano, es_modificacion, subido_por)
           VALUES (?, ?, ?, (SELECT id FROM tipos_documento WHERE nombre = ?), ?, ?, ?, ?)`,
          [modId, doc.nombre_original, doc.ruta, doc.tipo, doc.mime_type, doc.tamano, doc.nuevo ? 1 : 0, usuarioId],
          'documento:insert_modificacion'
        );
      }
      await tx.query(
        'INSERT INTO vale_historial (vale_id, usuario_id, taller_id, estado_anterior, estado_nuevo, accion, tecnico_id) VALUES (?, ?, NULL, ?, ?, ?, NULL)',
        [original.id, usuarioId, original.estado, 'SOLICITANDO_MODIFICACION', 'Asesor solicitó modificación'], 'historial:insert_solicitud'
      );
      await tx.query(
        'INSERT INTO vale_historial (vale_id, usuario_id, taller_id, estado_anterior, estado_nuevo, accion, tecnico_id) VALUES (?, ?, NULL, NULL, ?, ?, NULL)',
        [modId, usuarioId, 'ESPERANDO_AUTORIZACION', `Modificación solicitada sobre ${original.correlativo}, esperando autorización del Supervisor`], 'historial:insert_modificacion'
      );
      return modId;
    });
  }

  // Rechazo: se borra el vale MOD- (sus documentos e historial caen en cascada) y el original vuelve a su estado previo.
  async rechazar({ original, modId, estadoAnterior, usuarioId }) {
    return db.transaccion(async (tx) => {
      const res = await tx.query(
        `UPDATE vales SET estado_id = (SELECT id FROM estados_vale WHERE nombre = ?)
         WHERE id = ? AND estado_id = (SELECT id FROM estados_vale WHERE nombre = 'SOLICITANDO_MODIFICACION')`,
        [estadoAnterior, original.id], 'vale:revertir_solicitud'
      );
      if (res.affectedRows !== 1) throw new Error('Este vale no tiene una modificación pendiente de decisión.');
      if (modId) {
        await tx.query(
          `DELETE FROM vales WHERE id = ? AND vale_original_id = ?
             AND estado_id = (SELECT id FROM estados_vale WHERE nombre = 'ESPERANDO_AUTORIZACION')`,
          [modId, original.id], 'vale:delete_modificacion'
        );
      }
      await tx.query(
        'INSERT INTO vale_historial (vale_id, usuario_id, taller_id, estado_anterior, estado_nuevo, accion, tecnico_id) VALUES (?, ?, NULL, ?, ?, ?, NULL)',
        [original.id, usuarioId, 'SOLICITANDO_MODIFICACION', estadoAnterior, 'Supervisor rechazó la solicitud de modificación'], 'historial:insert_rechazo_modificacion'
      );
    });
  }
}

module.exports = new ValeModificacionRepository();
