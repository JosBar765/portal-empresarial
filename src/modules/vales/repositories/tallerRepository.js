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

  // Talleres activos de un supervisor: todos los generales (`tienda_id` nulo), los Diseño Local de sus tiendas
  // y los vinculados a ellas en `taller_tiendas`; los generales no dependen de esa tabla para que toda tienda los vea.
  async listarIdsPorSupervisor(supervisorId) {
    return db.query(
      `SELECT DISTINCT t.id
       FROM talleres t
       WHERE t.activo = 1 AND (
         t.tienda_id IS NULL
         OR EXISTS (
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
