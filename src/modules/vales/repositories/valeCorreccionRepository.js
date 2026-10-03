// src/modules/vales/repositories/valeCorreccionRepository.js
const db = require('../../../config/database');

class ValeCorreccionRepository {
  // Aplica la corrección completa en una sola transacción: datos del vale,
  // documentos quitados/agregados e historial. El UPDATE solo prospera si el
  // vale sigue esperando autorización.
  async aplicar({ valeId, usuarioId, datos, pdfUrl, documentosQuitarIds, documentosNuevos, accionHistorial }) {
    return db.transaccion(async (tx) => {
      const res = await tx.query(
        `UPDATE vales SET
           fecha_entrega = ?, fecha_evento = ?, urgente = ?,
           cliente_empresa = ?, cliente_nombre = ?, cliente_telefono = ?, cliente_correo = ?,
           producto = ?, material = ?, tecnica = ?, acabado = ?, cantidad = ?, cotizacion = ?,
           descripcion = ?, talleres_solicitados = ?, pdf_url = ?
         WHERE id = ? AND estado_id = (SELECT id FROM estados_vale WHERE nombre = 'ESPERANDO_AUTORIZACION')`,
        [
          datos.fechaEntregaNorm, datos.fechaEventoNorm, datos.urgente ? 1 : 0,
          datos.clienteEmpresa || null, datos.clienteNombre, datos.clienteTelefono, datos.clienteCorreo,
          datos.producto, datos.material, datos.tecnica, datos.acabado, datos.cantidad, datos.cotizacion,
          datos.descripcion || null, datos.talleresIds.join(','), pdfUrl, valeId
        ],
        'vale:corregir'
      );
      if (res.affectedRows !== 1) {
        throw new Error('Este vale ya fue autorizado, así que ya no se puede corregir.');
      }
      if (documentosQuitarIds.length) {
        await tx.query(
          `DELETE FROM vale_documentos WHERE vale_id = ? AND id IN (${documentosQuitarIds.map(() => '?').join(',')})`,
          [valeId, ...documentosQuitarIds],
          'documento:delete_correccion'
        );
      }
      for (const doc of documentosNuevos) {
        await tx.query(
          `INSERT INTO vale_documentos (vale_id, nombre_original, ruta, tipo_id, mime_type, tamano, es_modificacion, subido_por)
           VALUES (?, ?, ?, (SELECT id FROM tipos_documento WHERE nombre = ?), ?, ?, 0, ?)`,
          [valeId, doc.nombre_original, doc.ruta, doc.tipo, doc.mime_type, doc.tamano, usuarioId],
          'documento:insert_correccion'
        );
      }
      await tx.query(
        'INSERT INTO vale_historial (vale_id, usuario_id, taller_id, estado_anterior, estado_nuevo, accion, tecnico_id) VALUES (?, ?, NULL, ?, ?, ?, NULL)',
        [valeId, usuarioId, 'ESPERANDO_AUTORIZACION', 'ESPERANDO_AUTORIZACION', accionHistorial],
        'historial:insert_correccion'
      );
    });
  }
}

module.exports = new ValeCorreccionRepository();
