// src/modules/viaticos/repositories/solicitudEscrituraRepository.js
// Escrituras de solicitudes y sus partes. Reciben el ejecutor de la transacción del caso de uso.
const db = require('../../../config/database');
const { filaACamel } = require('../utilidades');

const TABLAS_DE_PARTES = [
  'viaticos_solicitud_tramos', 'viaticos_solicitud_hospedajes', 'viaticos_solicitud_comidas', 'viaticos_solicitud_gastos',
  'viaticos_solicitud_salvedades', 'viaticos_inspeccion_fluidos', 'viaticos_solicitud_kit', 'viaticos_defectos'
];

const COLUMNAS_ENCABEZADO = [
  'pais_id', 'moneda_id', 'modalidad', 'estado_id', 'motivo_id', 'vehiculo_id', 'fecha_salida', 'fecha_regreso',
  'rendimiento_km_galon', 'precio_galon', 'depreciacion_por_km', 'odometro', 'total_solicitado'
];

const valoresDeEncabezado = s => [
  s.paisId, s.monedaId, s.modalidad, s.estadoId, s.motivoId, s.vehiculoId, s.fechaSalida, s.fechaRegreso,
  s.rendimientoKmGalon, s.precioGalon, s.depreciacionPorKm, s.odometro, s.totalSolicitado
];

class SolicitudEscrituraRepository {
  // Número siguiente de la secuencia del país; la fila se crea si no existe y queda bloqueada hasta el commit.
  async siguienteNumero(paisId, ejecutor = db) {
    await ejecutor.query(
      'INSERT INTO viaticos_secuencias (pais_id, ultimo) VALUES (?, LAST_INSERT_ID(1)) ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)',
      [paisId], 'viaticos:siguienteNumero'
    );
    const filas = await ejecutor.query('SELECT LAST_INSERT_ID() AS numero', [], 'viaticos:leerNumero');
    return Number(filas[0].numero);
  }

  async estadoId(nombre, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id FROM viaticos_estados WHERE nombre = ?', [nombre], 'viaticos:estadoPorNombre');
    return filas[0] ? filas[0].id : null;
  }

  // Bloquea la solicitud hasta el fin de la transacción y devuelve su estado actual (null si ya no existe).
  // El estado sale de una subconsulta: un JOIN bloquearía también la fila compartida del catálogo y serializaría solicitudes distintas.
  async bloquear(id, ejecutor = db) {
    const filas = await ejecutor.query(
      'SELECT (SELECT e.nombre FROM viaticos_estados e WHERE e.id = s.estado_id) AS estado FROM viaticos_solicitudes s WHERE s.id = ? FOR UPDATE',
      [id], 'viaticos:bloquearSolicitud'
    );
    return filas[0] ? filas[0].estado : null;
  }

  // Bloquea la solicitud y devuelve lo que decide si se puede autorizar o rechazar. El nombre del estado sale de una subconsulta
  // para no bloquear también la fila compartida del catálogo de estados (el bloqueo solo alcanza a la consulta externa).
  async bloquearParaDecidir(id, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT s.id, s.correlativo, s.solicitante_id, s.modalidad, s.fecha_salida, s.fecha_regreso,
              (SELECT e.nombre FROM viaticos_estados e WHERE e.id = s.estado_id) AS estado
       FROM viaticos_solicitudes s WHERE s.id = ? FOR UPDATE`,
      [id], 'viaticos:bloquearParaDecidir'
    );
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  async actualizarEstado(id, estadoId, ejecutor = db) {
    await ejecutor.query('UPDATE viaticos_solicitudes SET estado_id = ? WHERE id = ?', [estadoId, id], 'viaticos:actualizarEstado');
  }

  async insertarEncabezado(solicitud, ejecutor = db) {
    const res = await ejecutor.query(
      `INSERT INTO viaticos_solicitudes (correlativo, solicitante_id, ${COLUMNAS_ENCABEZADO.join(', ')}) VALUES (?, ?, ${COLUMNAS_ENCABEZADO.map(() => '?').join(', ')})`,
      [solicitud.correlativo, solicitud.solicitanteId, ...valoresDeEncabezado(solicitud)], 'viaticos:insertarSolicitud'
    );
    return res.insertId;
  }

  async actualizarEncabezado(id, solicitud, ejecutor = db) {
    await ejecutor.query(
      `UPDATE viaticos_solicitudes SET ${COLUMNAS_ENCABEZADO.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...valoresDeEncabezado(solicitud), id], 'viaticos:actualizarSolicitud'
    );
  }

  // Quita todas las partes de la solicitud (no el historial); sirve para el reemplazo completo al modificar.
  async borrarPartes(id, ejecutor = db) {
    for (const tabla of TABLAS_DE_PARTES) {
      await ejecutor.query(`DELETE FROM ${tabla} WHERE solicitud_id = ?`, [id], `viaticos:borrar:${tabla}`);
    }
  }

  async eliminar(id, ejecutor = db) {
    await ejecutor.query('DELETE FROM viaticos_solicitudes WHERE id = ?', [id], 'viaticos:eliminarSolicitud');
  }

  // `motivo`: razón libre del rechazo; NULL en los demás renglones.
  async insertarHistorial(solicitudId, estadoId, usuarioId, motivo, ejecutor = db) {
    await ejecutor.query(
      'INSERT INTO viaticos_historial (solicitud_id, estado_id, usuario_id, motivo) VALUES (?, ?, ?, ?)',
      [solicitudId, estadoId, usuarioId, motivo], 'viaticos:insertarHistorial'
    );
  }

  async insertarTramos(solicitudId, tramos, ejecutor = db) {
    if (tramos.length === 0) return;
    await ejecutor.query(
      'INSERT INTO viaticos_solicitud_tramos (solicitud_id, orden, tramo_id, sentido, km, horas) VALUES ?',
      [tramos.map(t => [solicitudId, t.orden, t.tramoId, t.sentido, t.km, t.horas])], 'viaticos:insertarTramos'
    );
  }

  async insertarHospedajes(solicitudId, hospedajes, ejecutor = db) {
    if (hospedajes.length === 0) return;
    await ejecutor.query(
      'INSERT INTO viaticos_solicitud_hospedajes (solicitud_id, hotel, lugar, noches, valor_noche) VALUES ?',
      [hospedajes.map(h => [solicitudId, h.hotel, h.lugar, h.noches, h.valorNoche])], 'viaticos:insertarHospedajes'
    );
  }

  async insertarComidas(solicitudId, comidas, ejecutor = db) {
    if (comidas.length === 0) return;
    await ejecutor.query(
      'INSERT INTO viaticos_solicitud_comidas (solicitud_id, fecha, tipo_comida_id, valor_unitario) VALUES ?',
      [comidas.map(c => [solicitudId, c.fecha, c.tipoComidaId, c.valorUnitario])], 'viaticos:insertarComidas'
    );
  }

  async insertarGastos(solicitudId, gastos, ejecutor = db) {
    if (gastos.length === 0) return;
    await ejecutor.query(
      'INSERT INTO viaticos_solicitud_gastos (solicitud_id, tipo_gasto_id, descripcion, monto) VALUES ?',
      [gastos.map(g => [solicitudId, g.tipoGastoId, g.descripcion, g.monto])], 'viaticos:insertarGastos'
    );
  }

  async insertarSalvedades(solicitudId, salvedadIds, ejecutor = db) {
    if (salvedadIds.length === 0) return;
    await ejecutor.query(
      'INSERT INTO viaticos_solicitud_salvedades (solicitud_id, salvedad_id) VALUES ?',
      [salvedadIds.map(id => [solicitudId, id])], 'viaticos:insertarSalvedades'
    );
  }

  async insertarFluidos(solicitudId, fluidos, ejecutor = db) {
    if (fluidos.length === 0) return;
    await ejecutor.query(
      'INSERT INTO viaticos_inspeccion_fluidos (solicitud_id, fluido_id, nivel_id) VALUES ?',
      [fluidos.map(f => [solicitudId, f.fluidoId, f.nivelId])], 'viaticos:insertarFluidos'
    );
  }

  async insertarKit(solicitudId, kit, ejecutor = db) {
    if (kit.length === 0) return;
    await ejecutor.query(
      'INSERT INTO viaticos_solicitud_kit (solicitud_id, kit_item_id, presente) VALUES ?',
      [kit.map(k => [solicitudId, k.kitItemId, k.presente ? 1 : 0])], 'viaticos:insertarKit'
    );
  }

  async guardarPdfRuta(id, ruta, ejecutor = db) {
    await ejecutor.query('UPDATE viaticos_solicitudes SET pdf_ruta = ? WHERE id = ?', [ruta, id], 'viaticos:guardarPdfRuta');
  }

  async guardarPdfRuta(id, ruta, ejecutor = db) {
    await ejecutor.query('UPDATE viaticos_solicitudes SET pdf_ruta = ? WHERE id = ?', [ruta, id], 'viaticos:guardarPdfRuta');
  }

  async insertarDefecto(solicitudId, { tipoDefectoId, descripcion, ruta, mimeType, tamano }, ejecutor = db) {
    await ejecutor.query(
      'INSERT INTO viaticos_defectos (solicitud_id, tipo_defecto_id, descripcion, ruta, mime_type, tamano) VALUES (?, ?, ?, ?, ?, ?)',
      [solicitudId, tipoDefectoId, descripcion || null, ruta, mimeType, tamano], 'viaticos:insertarDefecto'
    );
  }
}

module.exports = new SolicitudEscrituraRepository();
