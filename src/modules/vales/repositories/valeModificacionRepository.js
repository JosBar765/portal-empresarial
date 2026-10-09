// src/modules/vales/repositories/valeModificacionRepository.js
// Solicitud de modificación: nace el vale MOD- (esperando al supervisor, con 24 h de vigencia) y el original queda RECIBIDO.
const db = require('../../../config/database');

class ValeModificacionRepository {
 // Crea el vale MOD- con sus documentos, pasa el original a RECIBIDO y registra el historial de ambos en una sola transacción.
  async crear({ original, datos, correlativo, fechaCreacion, horaCreacion, pdfUrl, documentos, usuarioId, talleresIds, vigenciaHasta }) {
    const ahora = `${fechaCreacion} ${horaCreacion}`;
    return db.transaccion(async (tx) => {
      // El original debe seguir entregado o recibido, y sin otra modificación en trámite.
      const vigentes = await tx.query(
        `SELECT id FROM vales WHERE id = ?
           AND estado_id IN (SELECT id FROM estados_vale WHERE nombre IN ('RECIBIDO', 'PENDIENTE_CONFIRMACION'))
           AND NOT EXISTS (SELECT 1 FROM vales m WHERE m.vale_original_id = vales.id)`,
        [original.id], 'vale:validar_original_modificacion'
      );
      if (vigentes.length !== 1) throw new Error('Solo se puede solicitar una modificación de un vale que ya fue entregado o recibido, y que no tenga otra en curso.');
      const ins = await tx.query(
        `INSERT INTO vales (
          correlativo, asesor_id, tienda_id, vale_original_id, fecha_creacion, hora_creacion, fecha_entrega, fecha_evento, urgente,
          cliente_empresa, cliente_nombre, cliente_telefono, cliente_correo,
          producto, material, tecnica, acabado, cantidad, cotizacion, descripcion, talleres_solicitados, pdf_url, estado_id, vigencia_hasta
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          (SELECT id FROM estados_vale WHERE nombre = 'SOLICITANDO_MODIFICACION'), ?)`,
        [
          correlativo, original.asesor_id, original.tienda_id, original.id, fechaCreacion, horaCreacion,
          datos.fechaEntregaNorm, datos.fechaEventoNorm, datos.urgente ? 1 : 0,
          datos.clienteEmpresa || null, datos.clienteNombre, datos.clienteTelefono, datos.clienteCorreo,
          datos.producto, datos.material, datos.tecnica, datos.acabado, datos.cantidad, datos.cotizacion,
          datos.descripcion, talleresIds.join(','), pdfUrl, vigenciaHasta
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
      // Pedir la modificación cuenta como confirmar de recibido: se congela el atraso y se sella la confirmación.
      if (original.estado === 'PENDIENTE_CONFIRMACION') {
        const res = await tx.query(
          `UPDATE vales SET estado_id = (SELECT id FROM estados_vale WHERE nombre = 'RECIBIDO'),
             atraso_congelado_en = COALESCE(atraso_congelado_en, ?), confirmado_en = COALESCE(confirmado_en, ?)
           WHERE id = ? AND estado_id = (SELECT id FROM estados_vale WHERE nombre = 'PENDIENTE_CONFIRMACION')`,
          [ahora, ahora, original.id], 'vale:recibir_por_modificacion'
        );
        if (res.affectedRows !== 1) throw new Error('Este vale cambió de estado mientras se creaba la solicitud. Actualiza e inténtalo de nuevo.');
      }
      await tx.query(
        'INSERT INTO vale_historial (vale_id, usuario_id, taller_id, estado_anterior, estado_nuevo, accion, disenador_id) VALUES (?, ?, NULL, ?, ?, ?, NULL)',
        [original.id, usuarioId, original.estado, 'RECIBIDO', `Asesor solicitó modificación — se creó el vale ${correlativo}`], 'historial:insert_solicitud'
      );
      await tx.query(
        'INSERT INTO vale_historial (vale_id, usuario_id, taller_id, estado_anterior, estado_nuevo, accion, disenador_id) VALUES (?, ?, NULL, NULL, ?, ?, NULL)',
        [modId, usuarioId, 'SOLICITANDO_MODIFICACION', `Modificación solicitada sobre ${original.correlativo}, esperando autorización del Supervisor`], 'historial:insert_modificacion'
      );
      return modId;
    });
  }
}

module.exports = new ValeModificacionRepository();
