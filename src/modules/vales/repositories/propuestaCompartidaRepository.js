// src/modules/vales/repositories/propuestaCompartidaRepository.js
// Propuestas aprobadas compartidas entre talleres con `talleres.comparte_propuestas = 1`.
const db = require('../../../config/database');

class PropuestaCompartidaRepository {
  // Filas activas del vale cuyo taller comparte propuestas.
  async listarFilasQueComparten(valeId) {
    return db.query(
      `SELECT vt.id, vt.taller_id, vt.disenador_id, et.nombre AS estado, t.nombre AS taller_nombre
       FROM vale_talleres vt
       JOIN talleres t ON t.id = vt.taller_id
       JOIN estados_taller et ON et.id = vt.estado_id
       WHERE vt.vale_id = ? AND vt.activo = 1 AND t.comparte_propuestas = 1
       ORDER BY vt.id`,
      [valeId],
      'propuesta_compartida:filas'
    );
  }

  // Map(tallerOrigenId -> propuestaId visto) del usuario en el vale.
  async listarVistos(usuarioId, valeId) {
    const filas = await db.query(
      'SELECT taller_origen_id, propuesta_id FROM vale_propuestas_otros_vistos WHERE usuario_id = ? AND vale_id = ?',
      [usuarioId, valeId],
      'propuesta_compartida:vistos'
    );
    return new Map(filas.map(f => [f.taller_origen_id, f.propuesta_id]));
  }

  async registrarVisto(usuarioId, valeId, tallerOrigenId, propuestaId) {
    await db.query(
      `INSERT INTO vale_propuestas_otros_vistos (usuario_id, vale_id, taller_origen_id, propuesta_id) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE propuesta_id = VALUES(propuesta_id), visto_en = NOW()`,
      [usuarioId, valeId, tallerOrigenId, propuestaId],
      'propuesta_compartida:upsert_visto'
    );
  }

  // Ids (de `valeIds`) con al menos otra fila activa cuyo taller comparte, siendo `tallerId` uno que comparte y está activo en el vale.
  async listarValesConHermano(tallerId, valeIds) {
    if (!valeIds.length) return new Set();
    const filas = await db.query(
      `SELECT DISTINCT mine.vale_id
       FROM vale_talleres mine
       JOIN talleres tm ON tm.id = mine.taller_id AND tm.comparte_propuestas = 1
       JOIN vale_talleres sib ON sib.vale_id = mine.vale_id AND sib.activo = 1 AND sib.taller_id <> mine.taller_id
       JOIN talleres ts ON ts.id = sib.taller_id AND ts.comparte_propuestas = 1
       WHERE mine.vale_id IN (?) AND mine.activo = 1 AND mine.taller_id = ?`,
      [valeIds, tallerId],
      'propuesta_compartida:vales_con_hermano'
    );
    return new Set(filas.map(f => f.vale_id));
  }

  // Ids (de `valeIds`) con una propuesta aprobada de un taller hermano que el usuario aún no ha visto. Una sola consulta.
  // Con `disenadorId` solo cuenta la fila asignada a ese diseñador.
  async listarValesConPropuestaNueva(usuarioId, tallerId, disenadorId, valeIds) {
    if (!valeIds.length) return new Set();
    const filas = await db.query(
      `SELECT DISTINCT mine.vale_id
       FROM vale_talleres mine
       JOIN talleres tm ON tm.id = mine.taller_id AND tm.comparte_propuestas = 1
       JOIN vale_talleres sib ON sib.vale_id = mine.vale_id AND sib.activo = 1 AND sib.taller_id <> mine.taller_id
       JOIN talleres ts ON ts.id = sib.taller_id AND ts.comparte_propuestas = 1
       JOIN estados_taller es ON es.id = sib.estado_id AND es.nombre = 'APROBADO'
       JOIN vale_propuestas lp ON lp.id = (
         SELECT MAX(p.id) FROM vale_propuestas p WHERE p.vale_id = sib.vale_id AND p.disenador_id = sib.disenador_id
       )
       LEFT JOIN vale_propuestas_otros_vistos v
         ON v.usuario_id = ? AND v.vale_id = sib.vale_id AND v.taller_origen_id = sib.taller_id
       WHERE mine.vale_id IN (?) AND mine.activo = 1 AND mine.taller_id = ?
         AND (? IS NULL OR mine.disenador_id = ?)
         AND (v.propuesta_id IS NULL OR v.propuesta_id <> lp.id)`,
      [usuarioId, valeIds, tallerId, disenadorId, disenadorId],
      'propuesta_compartida:vales_con_nueva'
    );
    return new Set(filas.map(f => f.vale_id));
  }
}

module.exports = new PropuestaCompartidaRepository();
