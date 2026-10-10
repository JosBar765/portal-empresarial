// src/modules/admin/repositories/horarioRepository.js
const db = require('../../../config/database');

const COLUMNAS_FERIADO = 'id, pais_id, DATE_FORMAT(fecha, \'%Y-%m-%d\') AS fecha, nombre, se_repite_cada_anio';

class HorarioRepository {
  listarHorarios() {
    return db.query(
      `SELECT dia_semana, laboral, TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(hora_fin, '%H:%i') AS hora_fin
       FROM horarios_laborales ORDER BY dia_semana`,
      [], 'horario:listar'
    );
  }

  // Los 7 días se escriben juntos: si uno falla, ninguno cambia.
  guardarHorarios(dias) {
    return db.transaccion(async (tx) => {
      for (const d of dias) {
        await tx.query(
          `INSERT INTO horarios_laborales (dia_semana, laboral, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE laboral = VALUES(laboral), hora_inicio = VALUES(hora_inicio), hora_fin = VALUES(hora_fin)`,
          [d.diaSemana, d.laboral ? 1 : 0, d.horaInicio, d.horaFin], 'horario:guardar'
        );
      }
    });
  }

  async existePais(paisId) {
    const rows = await db.query('SELECT id FROM paises WHERE id = ?', [paisId], 'feriado:pais');
    return rows.length > 0;
  }

  listarFeriados(paisId) {
    const where = paisId ? 'WHERE pais_id = ?' : '';
    return db.query(
      `SELECT ${COLUMNAS_FERIADO} FROM feriados ${where} ORDER BY MONTH(fecha), DAY(fecha), fecha`,
      paisId ? [paisId] : [], 'feriado:listar'
    );
  }

  async obtenerFeriado(id) {
    const rows = await db.query(`SELECT ${COLUMNAS_FERIADO} FROM feriados WHERE id = ?`, [id], 'feriado:obtener');
    return rows[0] || null;
  }

  // Feriados del país que chocan con la fecha: la misma fecha, o el mismo día y mes si alguno se repite cada año.
  buscarChoques(paisId, fecha, seRepite, excluirId) {
    return db.query(
      `SELECT id, nombre, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, se_repite_cada_anio FROM feriados
       WHERE pais_id = ? AND id <> ?
         AND (fecha = ? OR ((se_repite_cada_anio = 1 OR ? = 1) AND DATE_FORMAT(fecha, '%m-%d') = DATE_FORMAT(?, '%m-%d')))`,
      [paisId, excluirId || 0, fecha, seRepite ? 1 : 0, fecha], 'feriado:choques'
    );
  }

  async insertarFeriado({ paisId, fecha, nombre, seRepite }) {
    const result = await db.query(
      'INSERT INTO feriados (pais_id, fecha, nombre, se_repite_cada_anio) VALUES (?, ?, ?, ?)',
      [paisId, fecha, nombre, seRepite ? 1 : 0], 'feriado:insert'
    );
    return result.insertId;
  }

  actualizarFeriado(id, { fecha, nombre, seRepite }) {
    return db.query(
      'UPDATE feriados SET fecha = ?, nombre = ?, se_repite_cada_anio = ? WHERE id = ?',
      [fecha, nombre, seRepite ? 1 : 0, id], 'feriado:update'
    );
  }

  async eliminarFeriado(id) {
    const result = await db.query('DELETE FROM feriados WHERE id = ?', [id], 'feriado:delete');
    return result.affectedRows > 0;
  }
}

module.exports = new HorarioRepository();
