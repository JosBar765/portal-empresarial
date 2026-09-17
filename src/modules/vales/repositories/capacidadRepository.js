// src/modules/vales/repositories/capacidadRepository.js
// Conteo de vales "entrantes" por taller y fecha de ENTREGA, para el límite
// diario opcional de analisis_correcciones_28.md. El reparto a
// vale_talleres solo ocurre al AUTORIZAR la creación (ver
// valeCreacionService.autorizarCreacion) — antes de eso el destino vive
// solo en vales.talleres_solicitados. Sin unir ambas fuentes, un asesor
// podría saltarse el límite creando varios vales que quedan
// ESPERANDO_AUTORIZACION para el mismo día sin que ninguno cuente todavía.
const db = require('../../../config/database');

class CapacidadRepository {
  // El taller destino de cada fila se resuelve en JS desde el CSV
  // (talleres_solicitados) — no en SQL — para no depender de FIND_IN_SET
  // con una lista de talleres de tamaño variable.
  async listarSolicitadosEnRango(fechaDesde, fechaHasta) {
    return db.query(
      `SELECT fecha_entrega, talleres_solicitados
       FROM vales
       WHERE estado_id = (SELECT id FROM estados_vale WHERE nombre = 'ESPERANDO_AUTORIZACION')
         AND fecha_entrega BETWEEN ? AND ?`,
      [`${fechaDesde} 00:00:00`, `${fechaHasta} 23:59:59`],
      'capacidad:listar_solicitados_rango'
    );
  }

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
