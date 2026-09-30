// src/modules/vales/repositories/tallerRepository.js
const db = require('../../../config/database');

class TallerRepository {
  async listarActivos() {
    return db.query('SELECT id, nombre, encargado_id, tienda_id, limite_diario FROM talleres WHERE activo = 1 ORDER BY nombre', [], 'taller:list');
  }

  // Todos los talleres, incluidos los inactivos: para mostrar el NOMBRE de un
  // taller en vales que ya pasaron por él (un taller solo se puede desactivar
  // sin vales en proceso, pero sus vales terminados siguen existiendo).
  async listarTodos() {
    return db.query('SELECT id, nombre, encargado_id, tienda_id, activo, limite_diario FROM talleres ORDER BY nombre', [], 'taller:list_all');
  }

  // Talleres de las tiendas que cubre un supervisor: los que atienden alguna
  // de esas tiendas (`taller_tiendas`) o que son propios de una de ellas
  // (`talleres.tienda_id`, los Diseño Local). Una tienda sin talleres no
  // aporta ninguno.
  async listarIdsPorSupervisor(supervisorId) {
    return db.query(
      `SELECT t.id
       FROM talleres t
       WHERE (
         EXISTS (
           SELECT 1 FROM taller_tiendas tt
           JOIN supervisor_tiendas st ON st.tienda_id = tt.tienda_id
           WHERE tt.taller_id = t.id AND st.usuario_id = ?
         )
         OR EXISTS (
           SELECT 1 FROM supervisor_tiendas st
           WHERE st.tienda_id = t.tienda_id AND st.usuario_id = ?
         )
       )`,
      [supervisorId, supervisorId],
      'taller:list_ids_by_supervisor'
    );
  }

  async obtenerPorId(id) {
    const rows = await db.query('SELECT id, nombre, encargado_id, tienda_id, activo, limite_diario FROM talleres WHERE id = ?', [id], 'taller:find_by_id');
    return rows[0] || null;
  }
}

module.exports = new TallerRepository();
