// src/modules/admin/repositories/mantenimientoRepository.js
const db = require('../../../config/database');

class MantenimientoRepository {
  async obtener() {
    const rows = await db.query('SELECT * FROM mantenimiento_config WHERE id = 1', [], 'mantenimiento:get');
    return rows[0] || null;
  }

  async actualizar({ activo, mensaje, activadoPor }) {
    return db.query(
      'UPDATE mantenimiento_config SET activo = ?, mensaje = ?, activado_por = ?, activado_en = IF(? = 1, NOW(), activado_en) WHERE id = 1',
      [activo ? 1 : 0, mensaje || null, activadoPor || null, activo ? 1 : 0],
      'mantenimiento:set'
    );
  }
}

module.exports = new MantenimientoRepository();
