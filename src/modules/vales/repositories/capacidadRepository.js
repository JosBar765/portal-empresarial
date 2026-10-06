// src/modules/vales/repositories/capacidadRepository.js
// Conteo de vales AUTORIZADOS por taller y fecha de ENTREGA, para el límite diario opcional por taller.
const db = require('../../../config/database');

class CapacidadRepository {
  async listarFanOutEnRango(talleresIds, fechaDesde, fechaHasta) {
    if (!talleresIds.length) return [];
    const placeholders = talleresIds.map(() => '?').join(',');
    return db.query(
      `SELECT v.fecha_entrega, vt.taller_id
       FROM vale_talleres vt
       JOIN vales v ON v.id = vt.vale_id
       WHERE vt.activo = 1 AND vt.taller_id IN (${placeholders})
         AND v.fecha_entrega BETWEEN ? AND ?`,
      [...talleresIds, `${fechaDesde} 00:00:00`, `${fechaHasta} 23:59:59`],
      'capacidad:listar_fanout_rango'
    );
  }
}

module.exports = new CapacidadRepository();
