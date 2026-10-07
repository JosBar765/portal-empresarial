// src/modules/vales/repositories/reporteRepository.js
// Lecturas para la pestaña Reportes: la actividad sale de `vale_historial` (quién hizo cada acción y cuándo).
const db = require('../../../config/database');

const COLUMNAS_EVENTO = `h.id, h.vale_id, h.usuario_id, h.taller_id, h.disenador_id, h.estado_anterior, h.estado_nuevo, h.accion, h.creado_en,
  v.correlativo, v.asesor_id, v.tienda_id, v.vale_original_id, v.fecha_entrega, v.cliente_nombre`;

class ReporteRepository {
  // Eventos del período. `desde`/`hasta` son datetimes 'AAAA-MM-DD hh:mm:ss' (hora de Guatemala, igual que la sesión
  // de MySQL) o null. El alcance (`asesorIds`, `tallerIds`, `actorId`) se combina con OR; `tiendaId` y `tallerId` restan.
  // `valesDeDisenadorId`: todo lo ocurrido en los vales donde esa persona trabajó (también las devoluciones, que
  // registra el encargado).
  async listarEventos({ desde = null, hasta = null, asesorIds = null, tallerIds = null, actorId = null, valesDeDisenadorId = null, tiendaId = null, tallerId = null } = {}) {
    const condiciones = [];
    const params = [];
    if (desde) { condiciones.push('h.creado_en >= ?'); params.push(desde); }
    if (hasta) { condiciones.push('h.creado_en <= ?'); params.push(hasta); }

    const alcance = [];
    if (asesorIds) {
      if (asesorIds.length) { alcance.push('v.asesor_id IN (?)'); params.push(asesorIds); } else alcance.push('1 = 0');
    }
    if (tallerIds) {
      if (tallerIds.length) { alcance.push('h.taller_id IN (?)'); params.push(tallerIds); } else alcance.push('1 = 0');
    }
    if (actorId) { alcance.push('(h.usuario_id = ? OR h.disenador_id = ?)'); params.push(actorId, actorId); }
    if (valesDeDisenadorId) {
      alcance.push('h.vale_id IN (SELECT vale_id FROM vale_historial WHERE taller_id IS NOT NULL AND (usuario_id = ? OR disenador_id = ?))');
      params.push(valesDeDisenadorId, valesDeDisenadorId);
    }
    if (alcance.length) condiciones.push(`(${alcance.join(' OR ')})`);
    if (tiendaId) { condiciones.push('v.tienda_id = ?'); params.push(tiendaId); }
    if (tallerId) {
      // Solo los vales que pasaron por ese taller; sus acciones de otros talleres quedan fuera.
      condiciones.push('h.vale_id IN (SELECT vale_id FROM vale_historial WHERE taller_id = ?) AND (h.taller_id = ? OR h.taller_id IS NULL)');
      params.push(tallerId, tallerId);
    }

    return db.query(
      `SELECT ${COLUMNAS_EVENTO}
       FROM vale_historial h
       JOIN vales v ON v.id = h.vale_id
       ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
       ORDER BY h.id ASC`,
      params,
      'reporte:listar_eventos'
    );
  }

  // Historial completo de esos vales (también lo anterior al período) para emparejar acciones y medir tiempos.
  async listarHistorialDeVales(valeIds) {
    if (!valeIds.length) return [];
    const filas = [];
    for (let i = 0; i < valeIds.length; i += 1000) {
      filas.push(...await db.query(
        `SELECT h.id, h.vale_id, h.usuario_id, h.taller_id, h.disenador_id, h.estado_anterior, h.estado_nuevo, h.accion, h.creado_en
         FROM vale_historial h WHERE h.vale_id IN (?) ORDER BY h.id ASC`,
        [valeIds.slice(i, i + 1000)],
        'reporte:historial_de_vales'
      ));
    }
    return filas;
  }

  // Estado actual de los vales listados en el reporte (con estado y atraso congelado).
  async listarValesPorIds(valeIds) {
    if (!valeIds.length) return [];
    const filas = [];
    for (let i = 0; i < valeIds.length; i += 1000) {
      filas.push(...await db.query(
        `SELECT v.*, ev.nombre AS estado
         FROM vales v LEFT JOIN estados_vale ev ON ev.id = v.estado_id
         WHERE v.id IN (?)`,
        [valeIds.slice(i, i + 1000)],
        'reporte:vales_por_ids'
      ));
    }
    return filas;
  }

  // `tiendas` no tiene nombre propio: se deriva de la empresa y la subdivisión (como en el catálogo).
  async listarTiendas() {
    return db.query(
      `SELECT t.id, CONCAT(e.nombre, IF(s.nombre IS NOT NULL, CONCAT(', ', s.nombre), '')) AS nombre
       FROM tiendas t
       JOIN empresas e ON e.id = t.empresa_id
       LEFT JOIN subdivisiones s ON s.id = t.subdivision_id
       ORDER BY nombre`,
      [],
      'reporte:tiendas'
    );
  }

  async listarNombres(usuarioIds) {
    if (!usuarioIds.length) return [];
    return db.query('SELECT id, nombre FROM usuarios WHERE id IN (?)', [usuarioIds], 'reporte:nombres');
  }
}

module.exports = new ReporteRepository();
