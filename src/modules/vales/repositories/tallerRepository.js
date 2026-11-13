// src/modules/vales/repositories/tallerRepository.js
const db = require('../../../config/database');

// País de una tienda: departamento, si no subdivisión y, en último caso, empresa (igual que el calendario).
const JOINS_PAIS_DE_TIENDA = (ti) => `LEFT JOIN departamentos d ON d.id = ${ti}.departamento_id
       LEFT JOIN subdivisiones s ON s.id = ${ti}.subdivision_id
       LEFT JOIN empresas e ON e.id = ${ti}.empresa_id
       LEFT JOIN paises p ON p.id = COALESCE(d.pais_id, s.pais_id, e.pais_id)`;

class TallerRepository {
  // Cada Diseño Local trae las tiendas que atiende (`taller_local_tiendas`) y el país de su sede (`pais_id`, `pais_nombre`,
  // `pais_comparte_diseno_local`); los generales, un arreglo vacío y país nulo (los ven todas).
  async listarActivos() {
    const filas = await db.query(
      `SELECT t.id, t.nombre, t.encargado_id, t.tienda_id, t.limite_diario,
              (SELECT GROUP_CONCAT(lt.tienda_id) FROM taller_local_tiendas lt WHERE lt.taller_id = t.id) AS tiendas_atendidas,
              p.id AS pais_id, p.nombre AS pais_nombre, p.comparte_diseno_local AS pais_comparte_diseno_local
       FROM talleres t
       LEFT JOIN tiendas ti ON ti.id = t.tienda_id
       ${JOINS_PAIS_DE_TIENDA('ti')}
       WHERE t.activo = 1 ORDER BY t.nombre`,
      [], 'taller:list'
    );
    return filas.map(({ tiendas_atendidas, pais_comparte_diseno_local, ...taller }) => ({
      ...taller, pais_comparte_diseno_local: pais_comparte_diseno_local === null ? null : Number(pais_comparte_diseno_local),
      tiendas_atendidas_ids: tiendas_atendidas ? tiendas_atendidas.split(',').map(Number) : []
    }));
  }

  // Contexto con el que un asesor elige Diseño Local: su tienda, su país y si ese país comparte. Sin tienda (null/0), nada es elegible salvo los generales.
  async contextoDeTienda(tiendaId) {
    if (tiendaId === null || tiendaId === undefined) return null;
    const sinPais = { tiendaId: Number(tiendaId) || 0, paisId: null, paisNombre: null, comparteDisenoLocal: false };
    if (!sinPais.tiendaId) return sinPais;
    const filas = await db.query(
      `SELECT p.id AS pais_id, p.nombre AS pais_nombre, p.comparte_diseno_local
       FROM tiendas ti
       ${JOINS_PAIS_DE_TIENDA('ti')}
       WHERE ti.id = ?`,
      [sinPais.tiendaId], 'taller:contexto_tienda'
    );
    const fila = filas[0];
    return fila && fila.pais_id ? { tiendaId: sinPais.tiendaId, paisId: fila.pais_id, paisNombre: fila.pais_nombre, comparteDisenoLocal: Number(fila.comparte_diseno_local) === 1 } : sinPais;
  }

  // Todos los talleres, incluidos los inactivos: para mostrar el NOMBRE de un
  // taller en vales que ya pasaron por él (un taller solo se puede desactivar
  // sin vales en proceso, pero sus vales terminados siguen existiendo).
  async listarTodos() {
    return db.query('SELECT id, nombre, encargado_id, tienda_id, activo, limite_diario FROM talleres ORDER BY nombre', [], 'taller:list_all');
  }

  // Talleres activos de un supervisor: todos los generales (`tienda_id` nulo, sin depender de `taller_tiendas` para que toda tienda los vea)
  // y los Diseño Local que atienden sus tiendas (`taller_local_tiendas`), incluidas las de los asesores que se le asignaron en `asesor_supervisores`.
  async listarIdsPorSupervisor(supervisorId) {
    return db.query(
      `SELECT DISTINCT t.id
       FROM talleres t
       WHERE t.activo = 1 AND (
         t.tienda_id IS NULL
         OR EXISTS (
           SELECT 1 FROM taller_local_tiendas lt
           JOIN (SELECT st0.tienda_id FROM supervisor_tiendas st0 WHERE st0.usuario_id = ?
         UNION SELECT a0.tienda_id FROM asesor_supervisores x0 JOIN asesores a0 ON a0.usuario_id = x0.asesor_id WHERE x0.supervisor_id = ? AND a0.tienda_id IS NOT NULL) st ON st.tienda_id = lt.tienda_id
           WHERE lt.taller_id = t.id
         )
       )`,
      [supervisorId, supervisorId],
      'taller:list_ids_by_supervisor'
    );
  }

  async obtenerPorId(id) {
    // `tienda_codigo`: código de la sede de un Diseño Local; nombra sus archivos en Storage.
    const rows = await db.query(
      `SELECT t.id, t.nombre, t.encargado_id, t.tienda_id, t.activo, t.limite_diario, ti.codigo AS tienda_codigo
       FROM talleres t LEFT JOIN tiendas ti ON ti.id = t.tienda_id WHERE t.id = ?`,
      [id], 'taller:find_by_id'
    );
    return rows[0] || null;
  }
}

module.exports = new TallerRepository();
