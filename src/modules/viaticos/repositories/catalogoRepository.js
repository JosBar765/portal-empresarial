// src/modules/viaticos/repositories/catalogoRepository.js
// SQL genérico de los catálogos simples: tabla, columnas y orden salen de la definición congelada
// (catalogos.js); los valores siempre van parametrizados.
const db = require('../../../config/database');
const { filaACamel, filasACamel } = require('../utilidades');

function tienePais(def) {
  return def.columnas.some(c => c.tipo === 'pais');
}

function consultaBase(def) {
  const columnas = def.columnas.map(c => `t.\`${c.columna}\``).join(', ');
  const pais = tienePais(def);
  return `SELECT t.id, ${columnas}, t.activo${pais ? ', p.nombre AS pais_nombre' : ''}
          FROM \`${def.tabla}\` t${pais ? ' LEFT JOIN paises p ON p.id = t.pais_id' : ''}`;
}

// Solo las columnas definidas, en el orden de la definición.
function columnasPresentes(def, valores) {
  return def.columnas.map(c => c.columna).filter(c => Object.prototype.hasOwnProperty.call(valores, c));
}

class CatalogoRepository {
  async listar(def) {
    const filas = await db.query(`${consultaBase(def)} ORDER BY ${def.orden}`, [], `viaticos:listar:${def.tabla}`);
    return filasACamel(filas);
  }

  async obtenerPorId(def, id, ejecutor = db) {
    const filas = await ejecutor.query(`${consultaBase(def)} WHERE t.id = ?`, [id], `viaticos:obtener:${def.tabla}`);
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  async insertar(def, valores, ejecutor = db) {
    const columnas = columnasPresentes(def, valores);
    const resultado = await ejecutor.query(
      `INSERT INTO \`${def.tabla}\` (${columnas.map(c => `\`${c}\``).join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
      columnas.map(c => valores[c]), `viaticos:insertar:${def.tabla}`
    );
    return resultado.insertId;
  }

  async actualizar(def, id, valores, ejecutor = db) {
    const columnas = columnasPresentes(def, valores);
    if (columnas.length === 0) return;
    await ejecutor.query(
      `UPDATE \`${def.tabla}\` SET ${columnas.map(c => `\`${c}\` = ?`).join(', ')} WHERE id = ?`,
      [...columnas.map(c => valores[c]), id], `viaticos:actualizar:${def.tabla}`
    );
  }

  async cambiarActivo(def, id, activo, ejecutor = db) {
    await ejecutor.query(`UPDATE \`${def.tabla}\` SET activo = ? WHERE id = ?`, [activo, id], `viaticos:activo:${def.tabla}`);
  }
}

module.exports = new CatalogoRepository();
