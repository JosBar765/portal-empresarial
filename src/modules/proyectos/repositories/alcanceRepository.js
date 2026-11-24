// src/modules/proyectos/repositories/alcanceRepository.js
// De qué países es cada persona: los de su tienda (asesor) o de sus tiendas (supervisor) vía tiendas → empresas → países,
// más las excepciones que el administrador agrega o quita (`proy_usuario_paises`).
const db = require('../../../config/database');

class AlcanceRepository {
  async paisesDeTiendas(usuarioId) {
    const filas = await db.query(
      `SELECT DISTINCT e.pais_id FROM tiendas t JOIN empresas e ON e.id = t.empresa_id
       WHERE t.id IN (SELECT tienda_id FROM asesores WHERE usuario_id = ?
                      UNION SELECT tienda_id FROM supervisor_tiendas WHERE usuario_id = ?)`,
      [usuarioId, usuarioId], 'proyectos_alcance:paises_tiendas'
    );
    return filas.map(f => f.pais_id);
  }

  async excepciones(usuarioId) {
    return db.query('SELECT pais_id, accion FROM proy_usuario_paises WHERE usuario_id = ?', [usuarioId], 'proyectos_alcance:excepciones');
  }

  async todosLosPaises() {
    return (await db.query('SELECT id FROM paises ORDER BY id', [], 'proyectos_alcance:todos')).map(f => f.id);
  }

  // Para A7: una fila por persona y tienda (asesores y supervisores) con el país de esa tienda.
  personasConTienda() {
    return db.query(
      `SELECT x.usuario_id, u.nombre, u.rol_id, r.nombre AS rol, t.codigo AS tienda, e.pais_id
       FROM (SELECT usuario_id, tienda_id FROM asesores WHERE tienda_id IS NOT NULL UNION SELECT usuario_id, tienda_id FROM supervisor_tiendas) x
       JOIN usuarios u ON u.id = x.usuario_id AND u.activo = 1
       JOIN roles r ON r.id = u.rol_id
       JOIN tiendas t ON t.id = x.tienda_id
       JOIN empresas e ON e.id = t.empresa_id`,
      [], 'proyectos_alcance:personas'
    );
  }

  // Para A7: las excepciones de todas las personas (con su nombre y rol por si no tienen tienda).
  todasLasExcepciones() {
    return db.query(
      `SELECT x.usuario_id, x.pais_id, x.accion, u.nombre, u.rol_id, r.nombre AS rol
       FROM proy_usuario_paises x JOIN usuarios u ON u.id = x.usuario_id JOIN roles r ON r.id = u.rol_id`,
      [], 'proyectos_alcance:excepciones_todas'
    );
  }

  // La tienda desde la que alguien trabaja (la suya, o la primera que supervisa): para saber de dónde salió una empresa.
  async tiendaDe(usuarioId) {
    const filas = await db.query(
      `SELECT tienda_id FROM (SELECT tienda_id FROM asesores WHERE usuario_id = ?
                              UNION ALL SELECT tienda_id FROM supervisor_tiendas WHERE usuario_id = ?) x
       ORDER BY tienda_id LIMIT 1`,
      [usuarioId, usuarioId], 'proyectos_alcance:tienda'
    );
    return filas[0] ? filas[0].tienda_id : null;
  }

  // Deja las excepciones de la persona exactamente como el administrador las eligió (reemplaza las anteriores).
  async reemplazarExcepciones(tx, usuarioId, { agregar, quitar, creadoPor }) {
    await tx.query('DELETE FROM proy_usuario_paises WHERE usuario_id = ?', [usuarioId], 'proyectos_alcance:borrar');
    for (const paisId of agregar) await tx.query("INSERT INTO proy_usuario_paises (usuario_id, pais_id, accion, creado_por) VALUES (?, ?, 'agregar', ?)", [usuarioId, paisId, creadoPor], 'proyectos_alcance:agregar');
    for (const paisId of quitar) await tx.query("INSERT INTO proy_usuario_paises (usuario_id, pais_id, accion, creado_por) VALUES (?, ?, 'quitar', ?)", [usuarioId, paisId, creadoPor], 'proyectos_alcance:quitar');
  }
}

module.exports = new AlcanceRepository();
