// src/modules/viaticos/repositories/reporteRepository.js
// Consultas de los reportes: solo solicitudes de más de 1 día autorizadas o liquidadas, ubicadas en el tiempo por la fecha en que se AUTORIZARON.
const db = require('../../../config/database');
const { ESTADOS, MODALIDADES } = require('../constantes');
const { filaACamel, filasACamel } = require('../utilidades');

// Fecha de autorización = el primer renglón «autorizada» del historial (si hubiera varios, cuenta una vez, con el más antiguo).
// La zona horaria de la conexión es la de Guatemala, igual que en las listas de Solicitudes y Gestiones.
const DESDE_AUTORIZADAS = `FROM viaticos_solicitudes s
  JOIN viaticos_estados e ON e.id = s.estado_id
  JOIN (SELECT h.solicitud_id, MIN(h.creado_en) AS autorizada_en
          FROM viaticos_historial h JOIN viaticos_estados he ON he.id = h.estado_id
         WHERE he.nombre = ? GROUP BY h.solicitud_id) a ON a.solicitud_id = s.id`;

// Filtros comunes; `monedaId` y `paisId` son opcionales.
function filtrosDe({ desde, hasta, monedaId = null, paisId = null }) {
  const condiciones = ['e.nombre IN (?, ?)', 's.modalidad = ?', 's.moneda_id IS NOT NULL', 'DATE(a.autorizada_en) BETWEEN ? AND ?'];
  const params = [ESTADOS.AUTORIZADA, ESTADOS.LIQUIDADA, MODALIDADES.MAS_DE_UN_DIA, desde, hasta];
  if (monedaId !== null) {
    condiciones.push('s.moneda_id = ?');
    params.push(monedaId);
  }
  if (paisId !== null) {
    condiciones.push('s.pais_id = ?');
    params.push(paisId);
  }
  return { where: condiciones.join(' AND '), params: [ESTADOS.AUTORIZADA, ...params] };
}

class ReporteRepository {
  // Monedas con movimiento en la ventana, de mayor a menor total autorizado (la primera es la de por omisión).
  async monedasConMovimiento({ desde, hasta }, ejecutor = db) {
    const { where, params } = filtrosDe({ desde, hasta });
    return filasACamel(await ejecutor.query(
      `SELECT mo.id, mo.codigo, mo.nombre, mo.simbolo, SUM(s.total_solicitado) AS total
       ${DESDE_AUTORIZADAS}
       JOIN viaticos_monedas mo ON mo.id = s.moneda_id
       WHERE ${where}
       GROUP BY mo.id, mo.codigo, mo.nombre, mo.simbolo
       ORDER BY total DESC, mo.id`,
      params, 'viaticos:reporteMonedas'
    ));
  }

  async paisesConMovimiento({ desde, hasta }, ejecutor = db) {
    const { where, params } = filtrosDe({ desde, hasta });
    return filasACamel(await ejecutor.query(
      `SELECT DISTINCT p.id, p.codigo, p.nombre
       ${DESDE_AUTORIZADAS}
       JOIN paises p ON p.id = s.pais_id
       WHERE ${where}
       ORDER BY p.nombre`,
      params, 'viaticos:reportePaises'
    ));
  }

  async obtenerMoneda(id, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id, codigo, nombre, simbolo FROM viaticos_monedas WHERE id = ?', [id], 'viaticos:reporteMoneda');
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  async obtenerPais(id, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id, codigo, nombre FROM paises WHERE id = ?', [id], 'viaticos:reportePais');
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  // Una fila por solicitud con las partes que el cálculo necesita (km, hospedaje, comidas y gastos ya sumados en SQL;
  // el combustible y la depreciación se calculan en el servicio con calculoService). Solo lo autorizado: nada de lo liquidado.
  async listarSolicitudes(filtros, ejecutor = db) {
    const { where, params } = filtrosDe(filtros);
    return filasACamel(await ejecutor.query(
      `SELECT s.id, s.correlativo, s.solicitante_id, u.nombre AS solicitante_nombre, s.total_solicitado,
              s.rendimiento_km_galon, s.precio_galon, s.depreciacion_por_km, v.propietario_id AS vehiculo_propietario_id,
              (SELECT COALESCE(SUM(st.km), 0) FROM viaticos_solicitud_tramos st WHERE st.solicitud_id = s.id) AS km_total,
              (SELECT COALESCE(SUM(hp.noches * hp.valor_noche), 0) FROM viaticos_solicitud_hospedajes hp WHERE hp.solicitud_id = s.id) AS hospedaje,
              (SELECT COALESCE(SUM(c.valor_unitario), 0) FROM viaticos_solicitud_comidas c WHERE c.solicitud_id = s.id) AS comidas,
              (SELECT COALESCE(SUM(g.monto), 0) FROM viaticos_solicitud_gastos g WHERE g.solicitud_id = s.id) AS otros_gastos
       ${DESDE_AUTORIZADAS}
       JOIN usuarios u ON u.id = s.solicitante_id
       JOIN viaticos_vehiculos v ON v.id = s.vehiculo_id
       WHERE ${where}
       ORDER BY s.id`,
      params, 'viaticos:reporteSolicitudes'
    ));
  }
}

module.exports = new ReporteRepository();
