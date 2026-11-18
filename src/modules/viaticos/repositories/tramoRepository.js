// src/modules/viaticos/repositories/tramoRepository.js
const db = require('../../../config/database');
const { filaACamel, filasACamel } = require('../utilidades');

const SELECT = `SELECT t.id,
       t.ubicacion_a_id, ua.nombre AS ubicacion_a_nombre, ua.pais_id AS pais_a_id, pa.nombre AS pais_a_nombre,
       t.ubicacion_b_id, ub.nombre AS ubicacion_b_nombre, ub.pais_id AS pais_b_id, pb.nombre AS pais_b_nombre,
       t.km, t.horas, t.activo
  FROM viaticos_tramos t
  JOIN viaticos_ubicaciones ua ON ua.id = t.ubicacion_a_id
  JOIN paises pa ON pa.id = ua.pais_id
  JOIN viaticos_ubicaciones ub ON ub.id = t.ubicacion_b_id
  JOIN paises pb ON pb.id = ub.pais_id`;

class TramoRepository {
  async listar() {
    return filasACamel(await db.query(`${SELECT} ORDER BY ua.nombre, ub.nombre`, [], 'viaticos:listarTramos'));
  }

  async obtenerPorId(id) {
    const filas = await db.query(`${SELECT} WHERE t.id = ?`, [id], 'viaticos:obtenerTramo');
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  // El par se guarda ordenado (a < b): el llamador ya lo ordenó.
  async existePar(ubicacionAId, ubicacionBId) {
    const filas = await db.query(
      'SELECT id FROM viaticos_tramos WHERE ubicacion_a_id = ? AND ubicacion_b_id = ?',
      [ubicacionAId, ubicacionBId], 'viaticos:existePar'
    );
    return filas.length > 0;
  }

  async insertar({ ubicacionAId, ubicacionBId, km, horas }) {
    const resultado = await db.query(
      'INSERT INTO viaticos_tramos (ubicacion_a_id, ubicacion_b_id, km, horas) VALUES (?, ?, ?, ?)',
      [ubicacionAId, ubicacionBId, km, horas], 'viaticos:insertarTramo'
    );
    return resultado.insertId;
  }

  async actualizar(id, { km, horas }) {
    await db.query('UPDATE viaticos_tramos SET km = ?, horas = ? WHERE id = ?', [km, horas, id], 'viaticos:actualizarTramo');
  }

  async cambiarActivo(id, activo) {
    await db.query('UPDATE viaticos_tramos SET activo = ? WHERE id = ?', [activo, id], 'viaticos:activoTramo');
  }
}

module.exports = new TramoRepository();
