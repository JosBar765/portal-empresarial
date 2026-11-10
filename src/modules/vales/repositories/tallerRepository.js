// src/modules/vales/repositories/tallerRepository.js
const db = require('../../../config/database');

class TallerRepository {
  // Cada Diseño Local trae las tiendas que atiende (`taller_local_tiendas`); los generales, un arreglo vacío (los ven todas).
  async listarActivos() {
    const filas = await db.query(
      `SELECT t.id, t.nombre, t.encargado_id, t.tienda_id, t.limite_diario,
              (SELECT GROUP_CONCAT(lt.tienda_id) FROM taller_local_tiendas lt WHERE lt.taller_id = t.id) AS tiendas_atendidas
       FROM talleres t WHERE t.activo = 1 ORDER BY t.nombre`,
      [], 'taller:list'
    );
    return filas.map(({ tiendas_atendidas, ...taller }) => ({ ...taller, tiendas_atendidas_ids: tiendas_atendidas ? tiendas_atendidas.split(',').map(Number) : [] }));
  }

  // Todos los talleres, incluidos los inactivos: para mostrar el NOMBRE de un
  // taller en vales que ya pasaron por él (un taller solo se puede desactivar
  // sin vales en proceso, pero sus vales terminados siguen existiendo).
  async listarTodos() {
    return db.query('SELECT id, nombre, encargado_id, tienda_id, activo, limite_diario FROM talleres ORDER BY nombre', [], 'taller:list_all');
  }

  // Talleres activos de un supervisor: todos los generales (`tienda_id` nulo, sin depender de `taller_tiendas` para que toda tienda los vea)
  // y los Diseño Local que atienden sus tiendas (`taller_local_tiendas`).
  async listarIdsPorSupervisor(supervisorId) {
    return db.query(
      `SELECT DISTINCT t.id
       FROM talleres t
       WHERE t.activo = 1 AND (
         t.tienda_id IS NULL
         OR EXISTS (
           SELECT 1 FROM taller_local_tiendas lt
           JOIN supervisor_tiendas st ON st.tienda_id = lt.tienda_id
           WHERE lt.taller_id = t.id AND st.usuario_id = ?
         )
       )`,
      [supervisorId],
      'taller:list_ids_by_supervisor'
    );
  }

  async obtenerPorId(id) {
    const rows = await db.query('SELECT id, nombre, encargado_id, tienda_id, activo, limite_diario FROM talleres WHERE id = ?', [id], 'taller:find_by_id');
    return rows[0] || null;
  }
}

module.exports = new TallerRepository();
