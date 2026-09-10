// src/modules/vales/repositories/solicitudModificacionRepository.js
// Staging de una solicitud de modificación: se llena cuando el asesor la pide,
// se materializa en un vale de arte nuevo (MOD-...) solo cuando el supervisor
// la aprueba.
const db = require('../../../config/database');

// `estado` vive en el catálogo `estados_solicitud_modificacion` (ver
// analisis_correcciones_24.md #5) — se alias de vuelta a `estado` para que
// el resto del código no note el cambio.
const SELECT_SOLICITUD = `
  SELECT sm.*, esm.nombre AS estado
  FROM vale_solicitudes_modificacion sm
  LEFT JOIN estados_solicitud_modificacion esm ON esm.id = sm.estado_id
`;

class SolicitudModificacionRepository {
  async crear(data) {
    const result = await db.query(
      `INSERT INTO vale_solicitudes_modificacion (
        vale_original_id, asesor_id, fecha_entrega, fecha_evento, urgente,
        cliente_empresa, cliente_nombre, cliente_telefono, cliente_correo,
        producto, material, tecnica, acabado, cantidad, cotizacion, talleres_ids, justificacion, estado_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT id FROM estados_solicitud_modificacion WHERE nombre = 'PENDIENTE'))`,
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
        data.producto,
        data.material,
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
      `${SELECT_SOLICITUD} WHERE sm.vale_original_id = ? AND esm.nombre = 'PENDIENTE' ORDER BY sm.id DESC LIMIT 1`,
      [valeOriginalId],
      'solicitud_modificacion:find_pendiente_by_vale'
    );
    return rows[0] || null;
  }

  async marcarEstado(id, estado) {
    await db.query(
      'UPDATE vale_solicitudes_modificacion SET estado_id = (SELECT id FROM estados_solicitud_modificacion WHERE nombre = ?) WHERE id = ?',
      [estado, id],
      'solicitud_modificacion:marcar_estado'
    );
  }
}

module.exports = new SolicitudModificacionRepository();
