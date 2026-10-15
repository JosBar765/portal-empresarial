// src/modules/vales/repositories/propuestaRepository.js
const db = require('../../../config/database');

class PropuestaRepository {
  async crear(valeId, disenadorId, url, nota = null) {
    const result = await db.query(
      'INSERT INTO vale_propuestas (vale_id, disenador_id, url, nota) VALUES (?, ?, ?, ?)',
      [valeId, disenadorId, url || null, nota || null],
      'propuesta:insert'
    );
    return result.insertId;
  }

  // Enlaces de una propuesta (propuestaId) o de la fusión del vale (propuestaId null).
  async crearEnlaces(valeId, propuestaId, enlaces) {
    for (let i = 0; i < enlaces.length; i++) {
      await db.query(
        'INSERT INTO vale_propuesta_enlaces (vale_id, propuesta_id, nombre, url, orden) VALUES (?, ?, ?, ?, ?)',
        [valeId, propuestaId, enlaces[i].nombre || null, enlaces[i].url, i],
        'propuesta:insert_enlace'
      );
    }
  }

  async borrarEnlacesDeFusion(valeId) {
    await db.query('DELETE FROM vale_propuesta_enlaces WHERE vale_id = ? AND propuesta_id IS NULL', [valeId], 'propuesta:delete_enlaces_fusion');
  }

  async listarEnlacesPorPropuestas(propuestaIds) {
    if (!propuestaIds.length) return [];
    return db.query(
      'SELECT id, propuesta_id, nombre, url, orden FROM vale_propuesta_enlaces WHERE propuesta_id IN (?) ORDER BY propuesta_id, orden, id',
      [propuestaIds],
      'propuesta:list_enlaces'
    );
  }

  async listarEnlacesDeFusion(valeId) {
    return db.query(
      'SELECT id, propuesta_id, nombre, url, orden FROM vale_propuesta_enlaces WHERE vale_id = ? AND propuesta_id IS NULL ORDER BY orden, id',
      [valeId],
      'propuesta:list_enlaces_fusion'
    );
  }

  // Vales que tienen enlaces o notas en la fusión (`fusion`) o en alguna propuesta de taller (`propuestas`), en un solo viaje: dos Set
  // de ids. Para mostrar «Ver propuesta» aunque no haya archivo.
  async listarValesConExtra() {
    const fusion = await db.query('SELECT DISTINCT vale_id FROM vale_propuesta_enlaces WHERE propuesta_id IS NULL', [], 'propuesta:vales_con_enlaces_fusion');
    const propuestas = await db.query(
      `SELECT DISTINCT vale_id FROM vale_propuesta_enlaces WHERE propuesta_id IS NOT NULL
       UNION SELECT DISTINCT vale_id FROM vale_propuestas WHERE nota IS NOT NULL`,
      [],
      'propuesta:vales_con_extra'
    );
    return { fusion: new Set(fusion.map(f => f.vale_id)), propuestas: new Set(propuestas.map(f => f.vale_id)) };
  }

  async listarPorVale(valeId) {
    return db.query('SELECT * FROM vale_propuestas WHERE vale_id = ? ORDER BY id ASC', [valeId], 'propuesta:list_by_vale');
  }

  async obtenerUltimaPorVale(valeId) {
    const rows = await db.query('SELECT * FROM vale_propuestas WHERE vale_id = ? ORDER BY id DESC LIMIT 1', [valeId], 'propuesta:latest_by_vale');
    return rows[0] || null;
  }

  // Última propuesta con archivo de cada vale (en un solo viaje): Map(valeId -> url). Para los reportes.
  async listarUltimasPorVales(valeIds) {
    if (!valeIds.length) return new Map();
    const filas = await db.query(
      'SELECT vale_id, url FROM vale_propuestas WHERE vale_id IN (?) AND url IS NOT NULL ORDER BY id ASC',
      [valeIds],
      'propuesta:latest_by_vales'
    );
    return new Map(filas.map(f => [f.vale_id, f.url]));
  }

  // La última propuesta de UN taller específico (identificado por el diseñador que la
  // subió) — necesario porque con varios talleres puede haber varias propuestas vivas
  // para el mismo vale al mismo tiempo, una por taller.
  async obtenerUltimaPorValeYDisenador(valeId, disenadorId) {
    const rows = await db.query(
      `SELECT p.*, (SELECT COUNT(*) FROM vale_propuesta_enlaces e WHERE e.propuesta_id = p.id) AS n_enlaces
       FROM vale_propuestas p WHERE p.vale_id = ? AND p.disenador_id = ? ORDER BY p.id DESC LIMIT 1`,
      [valeId, disenadorId],
      'propuesta:latest_by_vale_disenador'
    );
    return rows[0] || null;
  }
}

module.exports = new PropuestaRepository();
