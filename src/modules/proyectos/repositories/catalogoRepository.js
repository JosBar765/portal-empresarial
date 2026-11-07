// src/modules/proyectos/repositories/catalogoRepository.js
// SQL genérico de los catálogos del módulo. Tabla y columnas vienen del registro `catalogos.js`, nunca de la petición.
const db = require('../../../config/database');

const col = nombre => `\`${nombre}\``;

function columnasSelect(def) {
  const partes = [
    `t.${col(def.pk)} AS id`,
    ...def.campos.map(c => `t.${col(c.columna)} AS ${col(c.clave)}`),
    `t.${col(def.activo)} AS activo`,
    def.orden ? `t.${col(def.orden)} AS orden` : 'NULL AS orden',
    `${def.usos} AS usos`
  ];
  return partes.join(', ');
}

const ordenPor = def => (def.orden ? `t.${col(def.orden)}, t.${col(def.campos[0].columna)}` : `t.${col(def.campos[0].columna)}`);

class CatalogoRepository {
  listar(def) {
    return db.query(`SELECT ${columnasSelect(def)} FROM ${col(def.tabla)} t ORDER BY ${ordenPor(def)}`, [], `proyectos_catalogo:listar:${def.tabla}`);
  }

  async contar(def) {
    const filas = await db.query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(${col(def.activo)}), 0) AS activas FROM ${col(def.tabla)}`, [], `proyectos_catalogo:contar:${def.tabla}`
    );
    return { total: Number(filas[0].total), activas: Number(filas[0].activas) };
  }

  async obtener(def, id, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT ${columnasSelect(def)} FROM ${col(def.tabla)} t WHERE t.${col(def.pk)} = ?`, [id], `proyectos_catalogo:obtener:${def.tabla}`
    );
    return filas[0] || null;
  }

  async siguienteOrden(tx, def) {
    const filas = await tx.query(`SELECT COALESCE(MAX(${col(def.orden)}), 0) + 1 AS n FROM ${col(def.tabla)}`, [], `proyectos_catalogo:orden:${def.tabla}`);
    return filas[0].n;
  }

  // `valores`: { columna: valor }. Devuelve el id de la fila (el código en las monedas).
  async insertar(tx, def, valores) {
    const columnas = Object.keys(valores);
    const res = await tx.query(
      `INSERT INTO ${col(def.tabla)} (${columnas.map(col).join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
      columnas.map(c => valores[c]), `proyectos_catalogo:insertar:${def.tabla}`
    );
    return def.pk === 'id' ? res.insertId : valores[def.pk];
  }

  actualizar(tx, def, id, valores) {
    const columnas = Object.keys(valores);
    if (!columnas.length) return Promise.resolve();
    return tx.query(
      `UPDATE ${col(def.tabla)} SET ${columnas.map(c => `${col(c)} = ?`).join(', ')} WHERE ${col(def.pk)} = ?`,
      [...columnas.map(c => valores[c]), id], `proyectos_catalogo:actualizar:${def.tabla}`
    );
  }
}

module.exports = new CatalogoRepository();
