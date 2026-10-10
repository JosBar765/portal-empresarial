// src/modules/admin/repositories/mantenimientoRepository.js
const db = require('../../../config/database');

class MantenimientoRepository {
  // segundos_restantes se calcula con el reloj de MySQL (sin depender de la zona horaria de Node).
  async obtener() {
    const rows = await db.query(
      'SELECT *, TIMESTAMPDIFF(SECOND, NOW(), inicia_en) AS segundos_restantes FROM mantenimiento_config WHERE id = 1',
      [], 'mantenimiento:get'
    );
    return rows[0] || null;
  }

  // Al activar fija el fin de la cuenta regresiva (`minutosCuenta` desde ahora); al desactivar limpia todo.
  async actualizar({ activo, mensaje, activadoPor, minutosCuenta }) {
    const on = activo ? 1 : 0;
    return db.query(
      `UPDATE mantenimiento_config SET activo = ?, mensaje = ?, activado_por = ?, activado_en = IF(? = 1, NOW(), activado_en),
         inicia_en = IF(? = 1, NOW() + INTERVAL ? MINUTE, NULL), sesiones_cerradas_en = NULL WHERE id = 1`,
      [on, mensaje || null, activadoPor || null, on, on, minutosCuenta], 'mantenimiento:set'
    );
  }

  // Sella el cierre de sesiones de la activación en curso.
  async marcarSesionesCerradas() {
    return db.query(
      'UPDATE mantenimiento_config SET sesiones_cerradas_en = NOW() WHERE id = 1 AND activo = 1 AND sesiones_cerradas_en IS NULL',
      [], 'mantenimiento:sellar_cierre'
    );
  }
}

module.exports = new MantenimientoRepository();
