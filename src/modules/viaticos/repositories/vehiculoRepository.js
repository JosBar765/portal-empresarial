// src/modules/viaticos/repositories/vehiculoRepository.js
const db = require('../../../config/database');
const { filaACamel, filasACamel } = require('../utilidades');

const SELECT = `SELECT v.id, v.pais_id, p.nombre AS pais_nombre, v.propietario_id, u.nombre AS propietario_nombre,
       v.marca, v.modelo, v.anio, v.placa, v.tipo_placa_id, tp.nombre AS tipo_placa_nombre,
       v.combustible_id, c.nombre AS combustible_nombre, v.tonelaje, v.pasajeros,
       v.poliza_numero, v.poliza_vence_el, v.tarjeta_vence_el, v.activo
  FROM viaticos_vehiculos v
  JOIN paises p ON p.id = v.pais_id
  LEFT JOIN usuarios u ON u.id = v.propietario_id
  JOIN viaticos_tipos_placa tp ON tp.id = v.tipo_placa_id
  JOIN viaticos_combustibles c ON c.id = v.combustible_id`;

const COLUMNAS = [
  'pais_id', 'propietario_id', 'marca', 'modelo', 'anio', 'placa', 'tipo_placa_id', 'combustible_id',
  'tonelaje', 'pasajeros', 'poliza_numero', 'poliza_vence_el', 'tarjeta_vence_el'
];

class VehiculoRepository {
  async listar() {
    return filasACamel(await db.query(`${SELECT} ORDER BY p.nombre, v.placa`, [], 'viaticos:listarVehiculos'));
  }

  async obtenerPorId(id) {
    const filas = await db.query(`${SELECT} WHERE v.id = ?`, [id], 'viaticos:obtenerVehiculo');
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  // `valores` trae las 13 columnas de COLUMNAS (null donde corresponda).
  async insertar(valores) {
    const resultado = await db.query(
      `INSERT INTO viaticos_vehiculos (${COLUMNAS.join(', ')}) VALUES (${COLUMNAS.map(() => '?').join(', ')})`,
      COLUMNAS.map(c => valores[c]), 'viaticos:insertarVehiculo'
    );
    return resultado.insertId;
  }

  async actualizar(id, valores) {
    await db.query(
      `UPDATE viaticos_vehiculos SET ${COLUMNAS.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...COLUMNAS.map(c => valores[c]), id], 'viaticos:actualizarVehiculo'
    );
  }

  async cambiarActivo(id, activo) {
    await db.query('UPDATE viaticos_vehiculos SET activo = ? WHERE id = ?', [activo, id], 'viaticos:activoVehiculo');
  }
}

module.exports = new VehiculoRepository();
