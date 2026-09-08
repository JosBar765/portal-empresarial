// src/modules/vales/repositories/solicitudModificacionRepository.js
// Staging de una solicitud de modificación: se llena cuando el asesor la pide,
// se materializa en un vale de arte nuevo (MOD-...) solo cuando el supervisor
// la aprueba (ver analisis_correcciones_3.md, "Notas generales").
const db = require('../../../config/database');

class SolicitudModificacionRepository {
  async crear(data) {
    const result = await db.query(
      `INSERT INTO vale_solicitudes_modificacion (
        vale_original_id, asesor_id, fecha_entrega, fecha_evento, urgente,
        cliente_empresa, cliente_nombre, cliente_telefono, cliente_correo,
        producto_id, material_id, tecnica, acabado, cantidad, cotizacion, talleres_ids, justificacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.valeOriginalId, 
        data.asesorId, 
        data.fechaEntrega, 
        data.fechaEvento,
        data.urgente ? 1 : 0,
        data.clienteEmpresa || null, 
        data.clienteNombre, 
        data.clienteTelefono, 
        data.clienteCorreo,
        data.productoId || null, 
        data.materialId || null, 
        data.tecnica, data.acabado,
        data.cantidad, 
        data.cotizacion, 
        data.talleresIds, 
        data.justificacion
      ],
      'solicitud_modificacion:insert'
    );
    return result.insertId;
  }

  async obtenerPendientePorValeOriginal(valeOriginalId) {
    const rows = await db.query(
      "SELECT * FROM vale_solicitudes_modificacion WHERE vale_original_id = ? AND estado = 'PENDIENTE' ORDER BY id DESC LIMIT 1",
      [valeOriginalId],
      'solicitud_modificacion:find_pendiente_by_vale'
    );
    return rows[0] || null;
  }

  async marcarEstado(id, estado) {
    await db.query('UPDATE vale_solicitudes_modificacion SET estado = ? WHERE id = ?', [estado, id], 'solicitud_modificacion:marcar_estado');
  }
}

module.exports = new SolicitudModificacionRepository();
