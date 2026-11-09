// src/modules/proyectos/repositories/campoRepository.js
// Definiciones de los campos propios de la empresa (`proy_campos`). Todo el SQL de A6 vive aquí.
const db = require('../../../config/database');

// MySQL entrega la columna JSON ya convertida; MariaDB (producción) la entrega como texto.
const opcionesDe = (valor) => (typeof valor === 'string' ? JSON.parse(valor) : valor) || [];

const aDefinicion = (f) => ({
  id: f.id, nichoId: f.nicho_id, nicho: f.nicho || null, clave: f.clave, etiqueta: f.etiqueta, tipo: f.tipo, opciones: opcionesDe(f.opciones),
  obligatorio: Boolean(f.obligatorio), visibleEnLista: Boolean(f.visible_en_lista), orden: f.orden, activo: Boolean(f.activo), usos: Number(f.usos || 0)
});

const COLUMNAS = 'c.id, c.nicho_id, n.nombre AS nicho, c.clave, c.etiqueta, c.tipo, c.opciones, c.obligatorio, c.visible_en_lista, c.orden, c.activo';

class CampoRepository {
  // Con `usos`: cuántas empresas tienen un valor guardado para el campo (la clave solo lleva a-z, 0-9 y _).
  async listar({ conUsos = false } = {}) {
    const usos = conUsos ? ', (SELECT COUNT(*) FROM proy_clientes pc WHERE JSON_EXTRACT(pc.datos_extra, CONCAT(\'$."\', c.clave, \'"\')) IS NOT NULL) AS usos' : '';
    const filas = await db.query(
      `SELECT ${COLUMNAS}${usos} FROM proy_campos c LEFT JOIN proy_nichos n ON n.id = c.nicho_id ORDER BY c.nicho_id IS NOT NULL, n.nombre, c.orden, c.id`,
      [], 'proyectos_campos:listar'
    );
    return filas.map(aDefinicion);
  }

  async obtener(id, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT ${COLUMNAS} FROM proy_campos c LEFT JOIN proy_nichos n ON n.id = c.nicho_id WHERE c.id = ?`, [id], 'proyectos_campos:obtener'
    );
    return filas[0] ? aDefinicion(filas[0]) : null;
  }

  async clavesUsadas(ejecutor = db) {
    return new Set((await ejecutor.query('SELECT clave FROM proy_campos', [], 'proyectos_campos:claves')).map(f => f.clave));
  }

  async siguienteOrden(ejecutor = db) {
    return Number((await ejecutor.query('SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM proy_campos', [], 'proyectos_campos:orden'))[0].n);
  }

  async insertar(tx, d) {
    const res = await tx.query(
      'INSERT INTO proy_campos (nicho_id, clave, etiqueta, tipo, opciones, obligatorio, visible_en_lista, orden, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [d.nichoId, d.clave, d.etiqueta, d.tipo, d.opciones && d.opciones.length ? JSON.stringify(d.opciones) : null, d.obligatorio ? 1 : 0, d.visibleEnLista ? 1 : 0, d.orden, d.activo ? 1 : 0],
      'proyectos_campos:insertar'
    );
    return res.insertId;
  }

  // La clave y el tipo no se cambian nunca: por eso no están aquí.
  actualizar(tx, id, d) {
    return tx.query(
      'UPDATE proy_campos SET nicho_id = ?, etiqueta = ?, opciones = ?, obligatorio = ?, visible_en_lista = ?, orden = ? WHERE id = ?',
      [d.nichoId, d.etiqueta, d.opciones && d.opciones.length ? JSON.stringify(d.opciones) : null, d.obligatorio ? 1 : 0, d.visibleEnLista ? 1 : 0, d.orden, id], 'proyectos_campos:actualizar'
    );
  }

  cambiarActivo(tx, id, activo) {
    return tx.query('UPDATE proy_campos SET activo = ? WHERE id = ?', [activo ? 1 : 0, id], 'proyectos_campos:activo');
  }
}

module.exports = new CampoRepository();
