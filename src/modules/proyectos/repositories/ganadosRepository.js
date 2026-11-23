// src/modules/proyectos/repositories/ganadosRepository.js
// Ventas confirmadas por empresa para la cartera de clientes ganados (posventa y recompra). Todo el SQL vive aquí.
// El alcance lo decide el servicio: `todos` (gerencia y administración) o, si no, las ventas propias y las de las tiendas supervisadas.
const db = require('../../../config/database');

class GanadosRepository {
  // Una fila por venta vigente (no anulada, confirmada), la más reciente primero.
  ventas({ todos, usuarioId, tiendaIds, clienteId = null }) {
    const condiciones = ['v.anulada_en IS NULL', "v.estado = 'confirmada'"];
    const params = [];
    if (!todos) {
      condiciones.push(tiendaIds.length ? '(p.asesor_id = ? OR p.tienda_id IN (?))' : 'p.asesor_id = ?');
      params.push(usuarioId);
      if (tiendaIds.length) params.push(tiendaIds);
    }
    if (clienteId) { condiciones.push('c.id = ?'); params.push(clienteId); }
    return db.query(
      `SELECT v.id, v.monto, v.moneda, v.referencia, v.creado_en AS fecha, p.id AS participacion_id, c.id AS cliente_id, c.nombre, c.ciudad, c.telefono,
              pa.nombre AS pais, n.id AS nicho_id, n.nombre AS nicho, u.nombre AS asesor,
              (SELECT t.telefono FROM proy_contactos t WHERE t.cliente_id = c.id AND t.activo = 1 AND t.telefono IS NOT NULL ORDER BY t.principal DESC, t.id LIMIT 1) AS contacto_telefono
       FROM proy_ventas v JOIN proy_participaciones p ON p.id = v.participacion_id JOIN proy_clientes c ON c.id = p.cliente_id
         JOIN paises pa ON pa.id = c.pais_id JOIN proy_nichos n ON n.id = c.nicho_id LEFT JOIN usuarios u ON u.id = p.asesor_id
       WHERE ${condiciones.join(' AND ')} ORDER BY v.creado_en DESC, v.id DESC LIMIT 5000`,
      params, 'proyectos_ganados:ventas'
    );
  }

  async tiendasSupervisadas(usuarioId) {
    const filas = await db.query('SELECT tienda_id FROM supervisor_tiendas WHERE usuario_id = ?', [usuarioId], 'proyectos_ganados:tiendas');
    return filas.map(f => f.tienda_id);
  }
}

module.exports = new GanadosRepository();
