// src/modules/viaticos/repositories/catalogoSolicitudRepository.js
// Lecturas de los catálogos que alimentan el formulario de solicitud y la validación de sus reglas.
const db = require('../../../config/database');
const { filaACamel, filasACamel } = require('../utilidades');

const SELECT_VEHICULO = `SELECT v.id, v.pais_id, v.propietario_id, v.marca, v.modelo, v.anio, v.placa,
       v.tipo_placa_id, tp.nombre AS tipo_placa_nombre, v.combustible_id, c.nombre AS combustible_nombre,
       v.tonelaje, v.pasajeros, v.poliza_numero, v.poliza_vence_el, v.tarjeta_vence_el, v.activo
  FROM viaticos_vehiculos v
  JOIN viaticos_tipos_placa tp ON tp.id = v.tipo_placa_id
  JOIN viaticos_combustibles c ON c.id = v.combustible_id`;

class CatalogoSolicitudRepository {
  async listarMotivosActivos(ejecutor = db) {
    return filasACamel(await ejecutor.query('SELECT id, nombre FROM viaticos_motivos WHERE activo = 1 ORDER BY nombre', [], 'viaticos:motivosActivos'));
  }

  async listarUbicacionesActivas(ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `SELECT u.id, u.pais_id, p.nombre AS pais_nombre, u.nombre
       FROM viaticos_ubicaciones u JOIN paises p ON p.id = u.pais_id
       WHERE u.activo = 1 ORDER BY p.nombre, u.nombre`,
      [], 'viaticos:ubicacionesActivas'
    ));
  }

  // Solo los tramos activos con sus dos ubicaciones activas: son los que se pueden elegir.
  async listarTramosActivos(ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `SELECT t.id, t.ubicacion_a_id, t.ubicacion_b_id, t.km, t.horas
       FROM viaticos_tramos t
       JOIN viaticos_ubicaciones ua ON ua.id = t.ubicacion_a_id AND ua.activo = 1
       JOIN viaticos_ubicaciones ub ON ub.id = t.ubicacion_b_id AND ub.activo = 1
       WHERE t.activo = 1`,
      [], 'viaticos:tramosActivos'
    ));
  }

  async listarMonedasActivas(ejecutor = db) {
    return filasACamel(await ejecutor.query('SELECT id, codigo, nombre, simbolo FROM viaticos_monedas WHERE activo = 1 ORDER BY codigo', [], 'viaticos:monedasActivas'));
  }

  async listarTiposComida(ejecutor = db) {
    return filasACamel(await ejecutor.query('SELECT id, nombre, orden FROM viaticos_tipos_comida ORDER BY orden', [], 'viaticos:tiposComida'));
  }

  async listarValoresComida(ejecutor = db) {
    return filasACamel(await ejecutor.query('SELECT moneda_id, tipo_comida_id, valor FROM viaticos_valores_comida', [], 'viaticos:valoresComida'));
  }

  async listarTiposGastoSeleccionables(ejecutor = db) {
    return filasACamel(await ejecutor.query(
      'SELECT id, nombre, es_otros FROM viaticos_tipos_gasto WHERE activo = 1 AND seleccionable_en_gastos = 1 ORDER BY es_otros, nombre',
      [], 'viaticos:tiposGastoSeleccionables'
    ));
  }

  async listarTiposDefectoActivos(ejecutor = db) {
    return filasACamel(await ejecutor.query('SELECT id, nombre, es_otros FROM viaticos_tipos_defecto WHERE activo = 1 ORDER BY es_otros, nombre', [], 'viaticos:tiposDefectoActivos'));
  }

  async listarFluidos(ejecutor = db) {
    return filasACamel(await ejecutor.query('SELECT id, nombre, permite_no_aplica, orden FROM viaticos_fluidos ORDER BY orden', [], 'viaticos:fluidos'));
  }

  async listarNiveles(ejecutor = db) {
    return filasACamel(await ejecutor.query('SELECT id, nombre, orden, bajo_la_mitad FROM viaticos_niveles ORDER BY orden', [], 'viaticos:niveles'));
  }

  async listarKit(ejecutor = db) {
    return filasACamel(await ejecutor.query('SELECT id, nombre, orden FROM viaticos_kit_items ORDER BY orden', [], 'viaticos:kit'));
  }

  async listarSalvedades(ejecutor = db) {
    return filasACamel(await ejecutor.query('SELECT id, nombre FROM viaticos_salvedades', [], 'viaticos:salvedades'));
  }

  // Vehículos activos del país: los de la empresa y los propios del usuario.
  async listarVehiculosDisponibles(paisId, usuarioId, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `${SELECT_VEHICULO} WHERE v.pais_id = ? AND v.activo = 1 AND (v.propietario_id IS NULL OR v.propietario_id = ?)
       ORDER BY (v.propietario_id IS NOT NULL), v.marca, v.modelo, v.placa`,
      [paisId, usuarioId], 'viaticos:vehiculosDisponibles'
    ));
  }

  async vehiculoPorId(id, ejecutor = db) {
    const filas = await ejecutor.query(`${SELECT_VEHICULO} WHERE v.id = ?`, [id], 'viaticos:vehiculoPorId');
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  async monedaPorId(id, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id, codigo, nombre, simbolo, activo FROM viaticos_monedas WHERE id = ?', [id], 'viaticos:monedaPorId');
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  async motivoPorId(id, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id, nombre, activo FROM viaticos_motivos WHERE id = ?', [id], 'viaticos:motivoPorId');
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  async valoresComidaDeMoneda(monedaId, ejecutor = db) {
    return filasACamel(await ejecutor.query('SELECT tipo_comida_id, valor FROM viaticos_valores_comida WHERE moneda_id = ?', [monedaId], 'viaticos:valoresDeMoneda'));
  }

  // Reglas del tipo de licencia en el país, una por tipo de placa que permite manejar.
  async listarReglasDeLicencia(paisId, tipoLicenciaId, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      'SELECT tipo_placa_id, tonelaje_max, pasajeros_max FROM viaticos_reglas_licencia WHERE pais_id = ? AND tipo_licencia_id = ?',
      [paisId, tipoLicenciaId], 'viaticos:reglasDeLicencia'
    ));
  }

  async ubicacionesPorIds(ids, ejecutor = db) {
    if (ids.length === 0) return [];
    return filasACamel(await ejecutor.query('SELECT id, nombre FROM viaticos_ubicaciones WHERE id IN (?)', [ids], 'viaticos:ubicacionesDeRuta'));
  }

  // Tramos entre las ubicaciones dadas, activos o no: el servicio distingue «no existe» de «desactivado».
  async tramosEntre(ubicacionIds, ejecutor = db) {
    if (ubicacionIds.length === 0) return [];
    return filasACamel(await ejecutor.query(
      'SELECT id, ubicacion_a_id, ubicacion_b_id, km, horas, activo FROM viaticos_tramos WHERE ubicacion_a_id IN (?) AND ubicacion_b_id IN (?)',
      [ubicacionIds, ubicacionIds], 'viaticos:tramosDeRuta'
    ));
  }

  async tiposGastoPorIds(ids, ejecutor = db) {
    if (ids.length === 0) return [];
    return filasACamel(await ejecutor.query('SELECT id, nombre, es_otros, seleccionable_en_gastos, activo FROM viaticos_tipos_gasto WHERE id IN (?)', [ids], 'viaticos:tiposGastoPorIds'));
  }

  // Los rubros fijos de la liquidación (Hospedaje, Combustible) se buscan por su nombre.
  async tiposGastoPorNombres(nombres, ejecutor = db) {
    return filasACamel(await ejecutor.query('SELECT id, nombre, es_otros FROM viaticos_tipos_gasto WHERE nombre IN (?)', [nombres], 'viaticos:tiposGastoPorNombres'));
  }

  async tiposDefectoPorIds(ids, ejecutor = db) {
    if (ids.length === 0) return [];
    return filasACamel(await ejecutor.query('SELECT id, nombre, es_otros, activo FROM viaticos_tipos_defecto WHERE id IN (?)', [ids], 'viaticos:tiposDefectoPorIds'));
  }
}

module.exports = new CatalogoSolicitudRepository();
