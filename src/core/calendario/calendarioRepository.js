// src/core/calendario/calendarioRepository.js
// Lectura de todo lo que necesita el calendario laboral (horario, feriados, parámetro y talleres).
const db = require('../../config/database');

class CalendarioRepository {
  listarHorarios() {
    return db.query(
      `SELECT dia_semana, laboral, recibe_vales, TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin
       FROM horarios_laborales`,
      [], 'calendario:horarios'
    );
  }

  listarFeriados() {
    return db.query(
      `SELECT pais_id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, nombre, se_repite_cada_anio FROM feriados`,
      [], 'calendario:feriados'
    );
  }

  async obtenerHorasVencimiento() {
    const rows = await db.query("SELECT valor FROM parametros_sistema WHERE clave = 'horas_vencimiento_vale'", [], 'calendario:parametro');
    return rows[0] ? Number(rows[0].valor) : null;
  }

  // País de un taller con tienda: departamento de la tienda, si no la subdivisión y, en último caso, la empresa.
  listarTalleres() {
    return db.query(
      `SELECT t.id, t.nombre, t.tienda_id, TIME_FORMAT(t.hora_maxima_recepcion, '%H:%i') AS hora_maxima,
              COALESCE(d.pais_id, s.pais_id, e.pais_id) AS pais_id
       FROM talleres t
       LEFT JOIN tiendas ti ON ti.id = t.tienda_id
       LEFT JOIN departamentos d ON d.id = ti.departamento_id
       LEFT JOIN subdivisiones s ON s.id = ti.subdivision_id
       LEFT JOIN empresas e ON e.id = ti.empresa_id`,
      [], 'calendario:talleres'
    );
  }

  async obtenerPaisGuatemalaId() {
    const rows = await db.query("SELECT id FROM paises WHERE nombre = 'Guatemala' LIMIT 1", [], 'calendario:pais_guatemala');
    return rows[0] ? rows[0].id : null;
  }
}

module.exports = new CalendarioRepository();
