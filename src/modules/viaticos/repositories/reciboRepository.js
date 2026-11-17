// src/modules/viaticos/repositories/reciboRepository.js
// Recibos firmados de la liquidación: lecturas y escrituras. Reciben el ejecutor de la transacción del caso de uso.
const db = require('../../../config/database');
const { filaACamel, filasACamel } = require('../utilidades');

const SELECT_RECIBO = `SELECT id, solicitud_id, contador, numero, rubro, fecha, monto, monto_letras, recibi_de, concepto,
       forma_pago, numero_cheque, numero_cuenta, ruta, tamano, creado_en
  FROM viaticos_recibos`;

class ReciboRepository {
  async listar(solicitudId, ejecutor = db) {
    return filasACamel(await ejecutor.query(`${SELECT_RECIBO} WHERE solicitud_id = ? ORDER BY contador`, [solicitudId], 'viaticos:recibosDeSolicitud'));
  }

  async obtener(id, ejecutor = db) {
    const filas = await ejecutor.query(`${SELECT_RECIBO} WHERE id = ?`, [id], 'viaticos:reciboPorId');
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  // Con la solicitud bloqueada (FOR UPDATE) dos recibos simultáneos no pueden tomar el mismo número.
  async siguienteContador(solicitudId, ejecutor = db) {
    const filas = await ejecutor.query('SELECT COALESCE(MAX(contador), 0) + 1 AS siguiente FROM viaticos_recibos WHERE solicitud_id = ?', [solicitudId], 'viaticos:reciboSiguienteContador');
    return Number(filas[0].siguiente);
  }

  async insertar(solicitudId, r, ejecutor = db) {
    const res = await ejecutor.query(
      `INSERT INTO viaticos_recibos (solicitud_id, contador, numero, rubro, fecha, monto, monto_letras, recibi_de, concepto,
         forma_pago, numero_cheque, numero_cuenta, ruta, tamano)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [solicitudId, r.contador, r.numero, r.rubro, r.fecha, r.monto, r.montoLetras, r.recibiDe, r.concepto,
        r.formaPago, r.numeroCheque || null, r.numeroCuenta || null, r.ruta, r.tamano],
      'viaticos:insertarRecibo'
    );
    return res.insertId;
  }

  async eliminar(id, ejecutor = db) {
    await ejecutor.query('DELETE FROM viaticos_recibos WHERE id = ?', [id], 'viaticos:eliminarRecibo');
  }
}

module.exports = new ReciboRepository();
