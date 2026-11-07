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
}

module.exports = new AlcanceRepository();
