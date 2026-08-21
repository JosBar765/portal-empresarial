// src/modules/vales/repositories/valeRepository.js
const db = require('../../../config/database');

class ValeRepository {
  async obtenerLimiteDiario(asesorId) {
    const rows = await db.query(
      'SELECT limite_diario FROM asesor_limites WHERE asesor_id = ? AND activo = 1',
      [asesorId],
      'asesor_limite:get'
    );
    return rows[0] ? rows[0].limite_diario : 6;
  }

  async contarValesPorAsesor(asesorId) {
    const rows = await db.query(
      'SELECT COUNT(*) AS total FROM vales WHERE asesor_id = ?',
      [asesorId],
      'vale:count_por_asesor'
    );
    return rows[0] ? Number(rows[0].total) : 0;
  }

  async contarValesPorAsesorYFecha(asesorId, fecha) {
    const rows = await db.query(
      'SELECT COUNT(*) AS total FROM vales WHERE asesor_id = ? AND fecha_creacion = ?',
      [asesorId, fecha],
      'vale:count_por_fecha'
    );
    return rows[0] ? Number(rows[0].total) : 0;
  }

  async crear(data) {
    const result = await db.query(
      `INSERT INTO vales (
        correlativo, asesor_id, localidad_id, vale_original_id, fecha_creacion, hora_creacion, fecha_entrega, fecha_evento, urgente,
        cliente_empresa, cliente_nombre, cliente_telefono, cliente_correo,
        producto_id, material_id, tecnica, acabado, cantidad, cotizacion, descripcion, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.correlativo, data.asesorId, data.localidadId, data.valeOriginalId || null, data.fechaCreacion, data.horaCreacion,
        data.fechaEntrega, data.fechaEvento, data.urgente ? 1 : 0,
        data.clienteEmpresa || null, data.clienteNombre, data.clienteTelefono, data.clienteCorreo,
        data.productoId || null, data.materialId || null, data.tecnica, data.acabado,
        data.cantidad, data.cotizacion, data.descripcion || null, data.estado || 'CREADO'
      ],
      'vale:insert'
    );
    return result.insertId;
  }

  async obtenerPorId(id) {
    const rows = await db.query('SELECT * FROM vales WHERE id = ?', [id], 'vale:find_by_id');
    return rows[0] || null;
  }

  async listarTodos() {
    return db.query('SELECT * FROM vales', [], 'vale:list_all');
  }

  async actualizarEstado(id, estado) {
    await db.query('UPDATE vales SET estado = ? WHERE id = ?', [estado, id], 'vale:update_estado');
  }

  async actualizarPdfUrl(id, pdfUrl) {
    await db.query('UPDATE vales SET pdf_url = ? WHERE id = ?', [pdfUrl, id], 'vale:update_pdf_url');
  }

  async actualizarTieneAdjuntos(id, valor) {
    await db.query('UPDATE vales SET tiene_adjuntos = ? WHERE id = ?', [valor ? 1 : 0, id], 'vale:update_tiene_adjuntos');
  }

  async marcarModificado(id) {
    await db.query('UPDATE vales SET modificado = 1 WHERE id = ?', [id], 'vale:marcar_modificado');
  }
}

module.exports = new ValeRepository();
