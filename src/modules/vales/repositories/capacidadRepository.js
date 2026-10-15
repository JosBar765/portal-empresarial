// src/modules/vales/repositories/capacidadRepository.js
// Conteo de vales AUTORIZADOS por taller y fecha de ENTREGA, para el límite diario opcional por taller, y vales por
// autorizar (con sus talleres solicitados) y conteos por día para el calendario del Buzón.
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

  // Vales esperando autorización con fecha de entrega en el rango (los talleres van en `talleres_solicitados`, porque
  // todavía no tienen filas en vale_talleres). `asesorIds` null = todos.
  async listarPendientesEnRango(asesorIds, fechaDesde, fechaHasta) {
    if (asesorIds && !asesorIds.length) return [];
    const filtroAsesores = asesorIds ? `AND v.asesor_id IN (${asesorIds.map(() => '?').join(',')})` : '';
    return db.query(
      `SELECT v.id, v.correlativo, v.fecha_entrega, v.talleres_solicitados, v.asesor_id, u.nombre AS asesor_nombre
       FROM vales v
       JOIN estados_vale ev ON ev.id = v.estado_id AND ev.nombre = 'ESPERANDO_AUTORIZACION'
       LEFT JOIN usuarios u ON u.id = v.asesor_id
       WHERE v.fecha_entrega BETWEEN ? AND ? ${filtroAsesores}`,
      [`${fechaDesde} 00:00:00`, `${fechaHasta} 23:59:59`, ...(asesorIds || [])],
      'capacidad:listar_pendientes_rango'
    );
  }

  // Cuántos vales entran cada día (por fecha de entrega) a unos talleres o a un diseñador, para el calendario del Buzón.
  // Devuelve { 'AAAA-MM-DD': n } con los días que tienen vales.
  async contarPorDia({ fechaDesde, fechaHasta, talleresIds = null, disenadorId = null }) {
    if (talleresIds && !talleresIds.length) return {};
    const filtro = disenadorId
      ? 'AND vt.disenador_id = ?'
      : `AND vt.taller_id IN (${talleresIds.map(() => '?').join(',')})`;
    const filas = await db.query(
      `SELECT DATE(v.fecha_entrega) AS fecha, COUNT(DISTINCT v.id) AS n
       FROM vale_talleres vt
       JOIN vales v ON v.id = vt.vale_id
       WHERE vt.activo = 1 AND v.fecha_entrega BETWEEN ? AND ? ${filtro}
       GROUP BY DATE(v.fecha_entrega)`,
      [`${fechaDesde} 00:00:00`, `${fechaHasta} 23:59:59`, ...(disenadorId ? [disenadorId] : talleresIds)],
      'capacidad:contar_por_dia'
    );
    return Object.fromEntries(filas.map(f => [String(f.fecha).slice(0, 10), Number(f.n)]));
  }
}

module.exports = new CapacidadRepository();
