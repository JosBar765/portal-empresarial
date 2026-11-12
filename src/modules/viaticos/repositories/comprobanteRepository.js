// src/modules/viaticos/repositories/comprobanteRepository.js
// Comprobantes de la liquidación: lecturas y escrituras. Reciben el ejecutor de la transacción del caso de uso.
const db = require('../../../config/database');
const { filaACamel, filasACamel } = require('../utilidades');

const SELECT_COMPROBANTE = `SELECT c.id, c.solicitud_id, c.tipo_gasto_id, tg.nombre AS tipo_gasto_nombre, c.descripcion, c.monto,
       c.nombre_original, c.ruta, c.mime_type, c.tamano, c.subido_en
  FROM viaticos_comprobantes c JOIN viaticos_tipos_gasto tg ON tg.id = c.tipo_gasto_id`;

class ComprobanteRepository {
  async listar(solicitudId, ejecutor = db) {
    return filasACamel(await ejecutor.query(`${SELECT_COMPROBANTE} WHERE c.solicitud_id = ? ORDER BY c.id`, [solicitudId], 'viaticos:comprobantesDeSolicitud'));
  }

  async obtener(id, ejecutor = db) {
    const filas = await ejecutor.query(`${SELECT_COMPROBANTE} WHERE c.id = ?`, [id], 'viaticos:comprobantePorId');
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  async insertar(solicitudId, { tipoGastoId, descripcion, monto, nombreOriginal, ruta, mimeType, tamano }, ejecutor = db) {
    const res = await ejecutor.query(
      'INSERT INTO viaticos_comprobantes (solicitud_id, tipo_gasto_id, descripcion, monto, nombre_original, ruta, mime_type, tamano) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [solicitudId, tipoGastoId, descripcion || null, monto, nombreOriginal, ruta, mimeType, tamano], 'viaticos:insertarComprobante'
    );
    return res.insertId;
  }

  async eliminar(id, ejecutor = db) {
    await ejecutor.query('DELETE FROM viaticos_comprobantes WHERE id = ?', [id], 'viaticos:eliminarComprobante');
  }
}

module.exports = new ComprobanteRepository();
