// src/modules/viaticos/repositories/solicitudRepository.js
// Lecturas de solicitudes y sus partes. Las escrituras están en solicitudEscrituraRepository.
const db = require('../../../config/database');
const { ESTADOS } = require('../constantes');
const { filaACamel, filasACamel } = require('../utilidades');

const ENCABEZADO = `SELECT s.id, s.correlativo, s.pais_id, p.codigo AS pais_codigo, p.nombre AS pais_nombre,
       s.moneda_id, mo.codigo AS moneda_codigo, mo.nombre AS moneda_nombre, mo.simbolo AS moneda_simbolo,
       s.solicitante_id, u.nombre AS solicitante_nombre, s.modalidad, e.nombre AS estado,
       s.motivo_id, mt.nombre AS motivo_nombre, s.vehiculo_id, v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo,
       v.anio AS vehiculo_anio, v.placa AS vehiculo_placa, v.propietario_id AS vehiculo_propietario_id,
       s.fecha_salida, s.fecha_regreso, s.rendimiento_km_galon, s.precio_galon, s.depreciacion_por_km, s.odometro,
       s.total_solicitado, s.pdf_ruta, s.creado_en, s.actualizado_en,
       (SELECT h.motivo FROM viaticos_historial h WHERE h.solicitud_id = s.id AND h.motivo IS NOT NULL ORDER BY h.id DESC LIMIT 1) AS motivo_rechazo,
       (SELECT MAX(h.creado_en) FROM viaticos_historial h JOIN viaticos_estados he ON he.id = h.estado_id
         WHERE h.solicitud_id = s.id AND he.nombre = ?) AS liquidada_en
  FROM viaticos_solicitudes s
  JOIN paises p ON p.id = s.pais_id
  LEFT JOIN viaticos_monedas mo ON mo.id = s.moneda_id
  JOIN usuarios u ON u.id = s.solicitante_id
  JOIN viaticos_estados e ON e.id = s.estado_id
  JOIN viaticos_motivos mt ON mt.id = s.motivo_id
  JOIN viaticos_vehiculos v ON v.id = s.vehiculo_id`;

// El día de salida y el de regreso (o solo la salida) delimitan el viaje; sirve para traslapes y búsquedas por fecha.
const RANGO_VIAJE = 'DATE(s.fecha_salida) <= ? AND COALESCE(s.fecha_regreso, DATE(s.fecha_salida)) >= ?';

function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, '\\$&');
}

class SolicitudRepository {
  // Sin `solicitanteId` lista las de todos. `fecha` (AAAA-MM-DD), `correlativo` y `nombre` (del solicitante) son filtros opcionales de la búsqueda; se combinan con OR.
  async listar({ solicitanteId = null, desde, hasta, correlativo = null, fecha = null, nombre = null }, ejecutor = db) {
    const filtros = [];
    const params = [ESTADOS.LIQUIDADA];
    if (solicitanteId !== null) {
      filtros.push('s.solicitante_id = ?');
      params.push(solicitanteId);
    }
    filtros.push('DATE(s.creado_en) BETWEEN ? AND ?');
    params.push(desde, hasta);
    const busqueda = [];
    if (correlativo) {
      busqueda.push('s.correlativo LIKE ?');
      params.push(`%${escaparLike(correlativo)}%`);
    }
    if (nombre) {
      busqueda.push('u.nombre LIKE ?');
      params.push(`%${escaparLike(nombre)}%`);
    }
    if (fecha) {
      busqueda.push(`(${RANGO_VIAJE})`);
      params.push(fecha, fecha);
    }
    if (busqueda.length > 0) filtros.push(`(${busqueda.join(' OR ')})`);
    const filas = await ejecutor.query(`${ENCABEZADO} WHERE ${filtros.join(' AND ')}`, params, 'viaticos:listarSolicitudes');
    return filasACamel(filas);
  }

  async obtenerEncabezado(id, ejecutor = db) {
    const filas = await ejecutor.query(`${ENCABEZADO} WHERE s.id = ?`, [ESTADOS.LIQUIDADA, id], 'viaticos:obtenerSolicitud');
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  // Solicitudes activas (cualquier estado menos rechazada) del solicitante que ocupan días de [desde, hasta].
  async buscarTraslapes(usuarioId, desde, hasta, excluirId = null, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `SELECT s.id, s.correlativo, DATE(s.fecha_salida) AS fecha_salida, s.fecha_regreso
       FROM viaticos_solicitudes s JOIN viaticos_estados e ON e.id = s.estado_id
       WHERE s.solicitante_id = ? AND e.nombre <> ? AND ${RANGO_VIAJE} AND (? IS NULL OR s.id <> ?)
       ORDER BY s.fecha_salida`,
      [usuarioId, ESTADOS.RECHAZADA, hasta, desde, excluirId, excluirId], 'viaticos:buscarTraslapes'
    ));
  }

  // El par de un tramo se guarda ordenado (A < B); «ida» significa de A hacia B.
  async listarTramos(solicitudId, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `SELECT st.orden, st.tramo_id, st.sentido, st.km, st.horas,
              t.ubicacion_a_id, ua.nombre AS ubicacion_a_nombre, t.ubicacion_b_id, ub.nombre AS ubicacion_b_nombre
       FROM viaticos_solicitud_tramos st
       JOIN viaticos_tramos t ON t.id = st.tramo_id
       JOIN viaticos_ubicaciones ua ON ua.id = t.ubicacion_a_id
       JOIN viaticos_ubicaciones ub ON ub.id = t.ubicacion_b_id
       WHERE st.solicitud_id = ? ORDER BY st.orden`,
      [solicitudId], 'viaticos:tramosDeSolicitud'
    ));
  }

  async listarHospedajes(solicitudId, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      'SELECT id, hotel, lugar, noches, valor_noche FROM viaticos_solicitud_hospedajes WHERE solicitud_id = ? ORDER BY id',
      [solicitudId], 'viaticos:hospedajesDeSolicitud'
    ));
  }

  async listarComidas(solicitudId, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `SELECT c.fecha, c.tipo_comida_id, tc.nombre AS tipo_comida_nombre, c.valor_unitario
       FROM viaticos_solicitud_comidas c JOIN viaticos_tipos_comida tc ON tc.id = c.tipo_comida_id
       WHERE c.solicitud_id = ? ORDER BY c.fecha, tc.orden`,
      [solicitudId], 'viaticos:comidasDeSolicitud'
    ));
  }

  async listarGastos(solicitudId, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `SELECT g.id, g.tipo_gasto_id, tg.nombre AS tipo_gasto_nombre, g.descripcion, g.monto
       FROM viaticos_solicitud_gastos g JOIN viaticos_tipos_gasto tg ON tg.id = g.tipo_gasto_id
       WHERE g.solicitud_id = ? ORDER BY g.id`,
      [solicitudId], 'viaticos:gastosDeSolicitud'
    ));
  }

  async listarSalvedades(solicitudId, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `SELECT sv.id, sv.nombre, sv.texto_pdf
       FROM viaticos_solicitud_salvedades ss JOIN viaticos_salvedades sv ON sv.id = ss.salvedad_id
       WHERE ss.solicitud_id = ? ORDER BY sv.id`,
      [solicitudId], 'viaticos:salvedadesDeSolicitud'
    ));
  }

  async listarFluidos(solicitudId, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `SELECT f.id AS fluido_id, f.nombre AS fluido_nombre, n.id AS nivel_id, n.nombre AS nivel_nombre, n.bajo_la_mitad
       FROM viaticos_inspeccion_fluidos i
       JOIN viaticos_fluidos f ON f.id = i.fluido_id JOIN viaticos_niveles n ON n.id = i.nivel_id
       WHERE i.solicitud_id = ? ORDER BY f.orden`,
      [solicitudId], 'viaticos:fluidosDeSolicitud'
    ));
  }

  async listarKit(solicitudId, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `SELECT k.id AS kit_item_id, k.nombre AS kit_item_nombre, sk.presente
       FROM viaticos_solicitud_kit sk JOIN viaticos_kit_items k ON k.id = sk.kit_item_id
       WHERE sk.solicitud_id = ? ORDER BY k.orden`,
      [solicitudId], 'viaticos:kitDeSolicitud'
    ));
  }

  // `url` es la URL pública de la foto: con `id` permite la miniatura y reenviar `defectoId` para conservarla.
  async listarDefectos(solicitudId, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `SELECT d.id, d.tipo_defecto_id, td.nombre AS tipo_defecto_nombre, d.descripcion, d.mime_type, d.tamano, d.ruta AS url
       FROM viaticos_defectos d JOIN viaticos_tipos_defecto td ON td.id = d.tipo_defecto_id
       WHERE d.solicitud_id = ? ORDER BY d.id`,
      [solicitudId], 'viaticos:defectosDeSolicitud'
    ));
  }

  // Con la ruta de Storage: para el visor de documentos y para borrar los archivos.
  async listarArchivosDefectos(solicitudId, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `SELECT d.id, td.nombre AS tipo_defecto_nombre, d.ruta, d.mime_type, d.tamano
       FROM viaticos_defectos d JOIN viaticos_tipos_defecto td ON td.id = d.tipo_defecto_id
       WHERE d.solicitud_id = ? ORDER BY d.id`,
      [solicitudId], 'viaticos:archivosDeDefectos'
    ));
  }

  // Datos que el detalle no trae y el PDF necesita: puesto y licencia del solicitante, póliza y combustible del vehículo.
  async obtenerDatosDocumento(id, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT r.nombre AS puesto, l.numero AS licencia_numero, tl.codigo AS licencia_tipo,
              v.poliza_numero, c.nombre AS combustible
       FROM viaticos_solicitudes s
       JOIN usuarios u ON u.id = s.solicitante_id
       JOIN roles r ON r.id = u.rol_id
       LEFT JOIN viaticos_licencias l ON l.usuario_id = s.solicitante_id
       LEFT JOIN viaticos_tipos_licencia tl ON tl.id = l.tipo_licencia_id
       JOIN viaticos_vehiculos v ON v.id = s.vehiculo_id
       JOIN viaticos_combustibles c ON c.id = v.combustible_id
       WHERE s.id = ?`,
      [id], 'viaticos:datosDocumento'
    );
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  async listarHistorial(solicitudId, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `SELECT h.id, e.nombre AS estado, h.usuario_id, u.nombre AS usuario_nombre, h.motivo, h.creado_en
       FROM viaticos_historial h
       JOIN viaticos_estados e ON e.id = h.estado_id JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.solicitud_id = ? ORDER BY h.id`,
      [solicitudId], 'viaticos:historialDeSolicitud'
    ));
  }
}

module.exports = new SolicitudRepository();
