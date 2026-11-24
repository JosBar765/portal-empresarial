// src/modules/viaticos/repositories/pilotoRepository.js
const db = require('../../../config/database');
const { filaACamel, filasACamel } = require('../utilidades');

const SELECT = `SELECT p.id, p.nombre, p.tipo_licencia_id, tl.codigo AS tipo_licencia_codigo, tl.nombre AS tipo_licencia_nombre,
       p.numero, p.vence_el, p.activo
  FROM viaticos_pilotos p
  JOIN viaticos_tipos_licencia tl ON tl.id = p.tipo_licencia_id`;

class PilotoRepository {
  async listar() {
    return filasACamel(await db.query(`${SELECT} ORDER BY p.activo DESC, p.nombre`, [], 'viaticos:listarPilotos'));
  }

  // Los que el formulario ofrece: solo los activos.
  async listarActivos(ejecutor = db) {
    return filasACamel(await ejecutor.query(`${SELECT} WHERE p.activo = 1 ORDER BY p.nombre`, [], 'viaticos:pilotosActivos'));
  }

  async obtenerPorId(id, ejecutor = db) {
    const filas = await ejecutor.query(`${SELECT} WHERE p.id = ?`, [id], 'viaticos:obtenerPiloto');
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  async insertar({ nombre, tipo_licencia_id, numero, vence_el }) {
    const resultado = await db.query(
      'INSERT INTO viaticos_pilotos (nombre, tipo_licencia_id, numero, vence_el) VALUES (?, ?, ?, ?)',
      [nombre, tipo_licencia_id, numero, vence_el], 'viaticos:insertarPiloto'
    );
    return resultado.insertId;
  }

  async actualizar(id, { nombre, tipo_licencia_id, numero, vence_el }) {
    await db.query(
      'UPDATE viaticos_pilotos SET nombre = ?, tipo_licencia_id = ?, numero = ?, vence_el = ? WHERE id = ?',
      [nombre, tipo_licencia_id, numero, vence_el, id], 'viaticos:actualizarPiloto'
    );
  }

  async cambiarActivo(id, activo) {
    await db.query('UPDATE viaticos_pilotos SET activo = ? WHERE id = ?', [activo, id], 'viaticos:activoPiloto');
  }
}

module.exports = new PilotoRepository();
