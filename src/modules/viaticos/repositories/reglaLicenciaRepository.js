// src/modules/viaticos/repositories/reglaLicenciaRepository.js
const db = require('../../../config/database');
const { filaACamel, filasACamel } = require('../utilidades');

const SELECT = `SELECT r.pais_id, p.nombre AS pais_nombre,
       r.tipo_licencia_id, tl.codigo AS tipo_licencia_codigo, tl.nombre AS tipo_licencia_nombre,
       r.tipo_placa_id, tp.codigo AS tipo_placa_codigo, tp.nombre AS tipo_placa_nombre,
       r.tonelaje_max, r.pasajeros_max
  FROM viaticos_reglas_licencia r
  JOIN paises p ON p.id = r.pais_id
  JOIN viaticos_tipos_licencia tl ON tl.id = r.tipo_licencia_id
  JOIN viaticos_tipos_placa tp ON tp.id = r.tipo_placa_id`;

const CLAVE = 'r.pais_id = ? AND r.tipo_licencia_id = ? AND r.tipo_placa_id = ?';

class ReglaLicenciaRepository {
  async listar() {
    return filasACamel(await db.query(`${SELECT} ORDER BY p.nombre, tl.codigo, tp.codigo`, [], 'viaticos:listarReglas'));
  }

  async obtener({ paisId, tipoLicenciaId, tipoPlacaId }) {
    const filas = await db.query(`${SELECT} WHERE ${CLAVE}`, [paisId, tipoLicenciaId, tipoPlacaId], 'viaticos:obtenerRegla');
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  async insertar({ paisId, tipoLicenciaId, tipoPlacaId, tonelajeMax, pasajerosMax }) {
    await db.query(
      'INSERT INTO viaticos_reglas_licencia (pais_id, tipo_licencia_id, tipo_placa_id, tonelaje_max, pasajeros_max) VALUES (?, ?, ?, ?, ?)',
      [paisId, tipoLicenciaId, tipoPlacaId, tonelajeMax, pasajerosMax], 'viaticos:insertarRegla'
    );
  }

  async actualizarLimites({ paisId, tipoLicenciaId, tipoPlacaId }, { tonelajeMax, pasajerosMax }) {
    await db.query(
      'UPDATE viaticos_reglas_licencia SET tonelaje_max = ?, pasajeros_max = ? WHERE pais_id = ? AND tipo_licencia_id = ? AND tipo_placa_id = ?',
      [tonelajeMax, pasajerosMax, paisId, tipoLicenciaId, tipoPlacaId], 'viaticos:actualizarRegla'
    );
  }

  async eliminar({ paisId, tipoLicenciaId, tipoPlacaId }) {
    await db.query(
      'DELETE FROM viaticos_reglas_licencia WHERE pais_id = ? AND tipo_licencia_id = ? AND tipo_placa_id = ?',
      [paisId, tipoLicenciaId, tipoPlacaId], 'viaticos:eliminarRegla'
    );
  }
}

module.exports = new ReglaLicenciaRepository();
