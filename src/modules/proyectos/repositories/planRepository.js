// src/modules/proyectos/repositories/planRepository.js
// Plan del año (`proy_plan_nichos`, de la migración de trabajo del asesor) y lo que la activación automática necesita saber de un mes.
// En esta fase el plan es único para toda la región: solo se usan las filas con `pais_id` NULL. Todo el SQL vive aquí.
const db = require('../../../config/database');

class PlanRepository {
  // Los meses planificados de un año, con los nombres para mostrar.
  listarAnio(anio) {
    return db.query(
      `SELECT pl.id, pl.anio, pl.mes, pl.nicho_id, n.nombre AS nicho, pl.articulo_id, a.nombre AS articulo, pl.plantilla_id, t.nombre AS plantilla
       FROM proy_plan_nichos pl JOIN proy_nichos n ON n.id = pl.nicho_id LEFT JOIN proy_articulos a ON a.id = pl.articulo_id LEFT JOIN proy_plantillas t ON t.id = pl.plantilla_id
       WHERE pl.anio = ? AND pl.pais_id IS NULL ORDER BY pl.mes`,
      [anio], 'proyectos_plan:anio'
    );
  }

  async obtener(anio, mes, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT pl.id, pl.anio, pl.mes, pl.nicho_id, n.nombre AS nicho, pl.articulo_id, a.nombre AS articulo, pl.plantilla_id, t.nombre AS plantilla
       FROM proy_plan_nichos pl JOIN proy_nichos n ON n.id = pl.nicho_id LEFT JOIN proy_articulos a ON a.id = pl.articulo_id LEFT JOIN proy_plantillas t ON t.id = pl.plantilla_id
       WHERE pl.anio = ? AND pl.mes = ? AND pl.pais_id IS NULL`,
      [anio, mes], 'proyectos_plan:mes'
    );
    return filas[0] || null;
  }

  // Los proyectos de un año que ocupan un mes (los cancelados no cuentan: el mes queda libre otra vez).
  proyectosDelAnio(anio, ejecutor = db) {
    return ejecutor.query(
      `SELECT id, anio, mes, estado, nicho_id, nombre FROM proy_proyectos WHERE anio = ? AND estado <> 'cancelado' ORDER BY id`,
      [anio], 'proyectos_plan:proyectos'
    );
  }

  // Crea o cambia el plan del mes. El índice único no frena duplicados con `pais_id` NULL, así que se busca y se bloquea la fila.
  async guardar(tx, { anio, mes, nichoId, articuloId, plantillaId }) {
    const filas = await tx.query('SELECT id FROM proy_plan_nichos WHERE anio = ? AND mes = ? AND pais_id IS NULL FOR UPDATE', [anio, mes], 'proyectos_plan:bloquear');
    if (filas.length) {
      await tx.query('UPDATE proy_plan_nichos SET nicho_id = ?, articulo_id = ?, plantilla_id = ? WHERE id = ?', [nichoId, articuloId, plantillaId, filas[0].id], 'proyectos_plan:actualizar');
    } else {
      await tx.query('INSERT INTO proy_plan_nichos (anio, mes, pais_id, nicho_id, articulo_id, plantilla_id) VALUES (?, ?, NULL, ?, ?, ?)', [anio, mes, nichoId, articuloId, plantillaId], 'proyectos_plan:insertar');
    }
  }

  eliminar(tx, anio, mes) {
    return tx.query('DELETE FROM proy_plan_nichos WHERE anio = ? AND mes = ? AND pais_id IS NULL', [anio, mes], 'proyectos_plan:eliminar');
  }

  // Quien encendió la activación automática por última vez: es quien figura como creador de los proyectos automáticos.
  async quienEncendio() {
    const filas = await db.query(
      `SELECT h.usuario_id FROM proy_config_historial h JOIN usuarios u ON u.id = h.usuario_id AND u.activo = 1
       WHERE h.entidad = 'parametro' AND h.clave = 'activacion_auto.activa' ORDER BY h.id DESC LIMIT 20`, [], 'proyectos_plan:quien_encendio'
    );
    return filas.length ? filas[0].usuario_id : null;
  }

  // Los administradores del módulo: quien tiene `proyectos.administrar`.
  async administradores() {
    const filas = await db.query(
      `SELECT DISTINCT u.id, u.nombre FROM usuarios u JOIN rol_permisos rp ON rp.rol_id = u.rol_id JOIN permisos p ON p.id = rp.permiso_id
       WHERE u.activo = 1 AND p.codigo = 'proyectos.administrar' ORDER BY u.id`, [], 'proyectos_plan:administradores'
    );
    return filas;
  }

  async usuarioActivo(id) {
    const filas = await db.query('SELECT id, nombre FROM usuarios WHERE id = ? AND activo = 1', [id], 'proyectos_plan:usuario');
    return filas[0] || null;
  }

  // Borra un borrador que se creó y no se pudo activar: el proyecto automático nunca queda a medias. Las tablas hijas caen en cascada.
  async eliminarBorrador(id) {
    return db.query("DELETE FROM proy_proyectos WHERE id = ? AND estado = 'borrador'", [id], 'proyectos_plan:eliminar_borrador');
  }

  async plantillaPredeterminada() {
    const filas = await db.query('SELECT id FROM proy_plantillas WHERE activa = 1 ORDER BY predeterminada DESC, id LIMIT 1', [], 'proyectos_plan:plantilla');
    return filas[0] ? filas[0].id : null;
  }
}

module.exports = new PlanRepository();
