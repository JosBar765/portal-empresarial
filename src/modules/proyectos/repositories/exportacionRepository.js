// src/modules/proyectos/repositories/exportacionRepository.js
// Datos de la exportación a CSV de los resultados de un proyecto: una fila por empresa asignada y, aparte, el dinero por empresa y
// moneda. Lo anulado, rechazado o «por confirmar» no cuenta. Todo el SQL vive aquí.
const db = require('../../../config/database');

class ExportacionRepository {
  participaciones(proyectoId) {
    return db.query(
      `SELECT p.id, p.estado, p.tienda_id, p.ultima_gestion_en, p.proxima_gestion_en, c.nombre AS empresa, c.ciudad, pa.nombre AS pais, u.nombre AS asesor,
              t.codigo AS tienda, mp.nombre AS motivo_perdida,
              (SELECT COUNT(*) FROM proy_gestiones g WHERE g.participacion_id = p.id AND g.anulada_en IS NULL) AS gestiones,
              (SELECT COALESCE(SUM(e.cantidad), 0) FROM proy_entregas_muestra e WHERE e.participacion_id = p.id) AS muestras
       FROM proy_participaciones p JOIN proy_clientes c ON c.id = p.cliente_id JOIN paises pa ON pa.id = c.pais_id LEFT JOIN usuarios u ON u.id = p.asesor_id
         LEFT JOIN tiendas t ON t.id = p.tienda_id LEFT JOIN proy_motivos_perdida mp ON mp.id = p.motivo_perdida_id
       WHERE p.proyecto_id = ? AND p.asesor_id IS NOT NULL ORDER BY u.nombre, c.nombre, p.id`,
      [proyectoId], 'proyectos_exportacion:participaciones'
    );
  }

  // Cotizado y vendido por empresa y moneda, con los números de referencia.
  montos(proyectoId) {
    return db.query(
      `SELECT x.participacion_id, x.tipo, x.moneda, SUM(x.monto) AS total, GROUP_CONCAT(x.referencia ORDER BY x.id SEPARATOR ' | ') AS referencias FROM (
         SELECT c.id, c.participacion_id, 'cotizado' AS tipo, c.moneda, c.monto, c.referencia FROM proy_cotizaciones c JOIN proy_participaciones p ON p.id = c.participacion_id
           WHERE p.proyecto_id = ? AND p.asesor_id IS NOT NULL AND c.anulada_en IS NULL
         UNION ALL
         SELECT v.id, v.participacion_id, 'vendido' AS tipo, v.moneda, v.monto, v.referencia FROM proy_ventas v JOIN proy_participaciones p ON p.id = v.participacion_id
           WHERE p.proyecto_id = ? AND p.asesor_id IS NOT NULL AND v.anulada_en IS NULL AND v.estado = 'confirmada'
       ) x GROUP BY x.participacion_id, x.tipo, x.moneda ORDER BY x.moneda`,
      [proyectoId, proyectoId], 'proyectos_exportacion:montos'
    );
  }
}

module.exports = new ExportacionRepository();
