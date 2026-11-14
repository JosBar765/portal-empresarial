// src/modules/viaticos/repositories/borradorRepository.js
// SQL de los borradores de solicitud. Siempre se filtra por dueño: un borrador es privado.
// Las escrituras reciben el ejecutor de la transacción del caso de uso (por defecto, el pool).
const db = require('../../../config/database');

// Días que faltan para vencer, con el reloj de MySQL (el mismo que fija `vence_en`).
const DIAS_RESTANTES = 'GREATEST(0, CEIL(TIMESTAMPDIFF(SECOND, NOW(), vence_en) / 86400))';
const FECHAS = "DATE_FORMAT(creado_en, '%Y-%m-%d') AS creado_en, DATE_FORMAT(vence_en, '%Y-%m-%d') AS vence_en";

class BorradorRepository {
  // Serializa los guardados del mismo usuario para que dos a la vez no superen el tope.
  async bloquearUsuario(usuarioId, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [usuarioId], 'viaticos:borradorBloquearUsuario');
    return filas.length > 0;
  }

  async contarVigentes(usuarioId, ejecutor = db) {
    const filas = await ejecutor.query(
      'SELECT COUNT(*) AS n FROM viaticos_borradores WHERE usuario_id = ? AND vence_en > NOW()',
      [usuarioId], 'viaticos:borradorContar'
    );
    return Number(filas[0].n);
  }

  // Solo lo que pinta la lista: país y fechas se extraen del JSON sin traer todo el formulario.
  listarVigentes(usuarioId) {
    return db.query(
      `SELECT id, modalidad, JSON_EXTRACT(datos, '$.paisId') AS pais_id, JSON_EXTRACT(datos, '$.fechaSalida') AS fecha_salida,
              JSON_EXTRACT(datos, '$.fechaRegreso') AS fecha_regreso, ${FECHAS}, ${DIAS_RESTANTES} AS dias_restantes
       FROM viaticos_borradores WHERE usuario_id = ? AND vence_en > NOW() ORDER BY creado_en DESC, id DESC`,
      [usuarioId], 'viaticos:borradorListar'
    );
  }

  async obtenerVigente(id, usuarioId) {
    const filas = await db.query(
      `SELECT id, modalidad, datos, ${FECHAS}, ${DIAS_RESTANTES} AS dias_restantes
       FROM viaticos_borradores WHERE id = ? AND usuario_id = ? AND vence_en > NOW()`,
      [id, usuarioId], 'viaticos:borradorObtener'
    );
    return filas[0] || null;
  }

  // `vence_en` se fija una sola vez, con el reloj de MySQL; editar el borrador no lo renueva.
  async insertar(usuarioId, modalidad, datosJson, diasVigencia, ejecutor = db) {
    const resultado = await ejecutor.query(
      'INSERT INTO viaticos_borradores (usuario_id, modalidad, datos, vence_en) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))',
      [usuarioId, modalidad, datosJson, diasVigencia], 'viaticos:borradorInsertar'
    );
    return resultado.insertId;
  }

  async actualizar(id, usuarioId, modalidad, datosJson) {
    await db.query(
      'UPDATE viaticos_borradores SET modalidad = ?, datos = ? WHERE id = ? AND usuario_id = ? AND vence_en > NOW()',
      [modalidad, datosJson, id, usuarioId], 'viaticos:borradorActualizar'
    );
  }

  // Devuelve cuántas filas borró: 0 si no existe o no es del usuario.
  async eliminar(id, usuarioId, ejecutor = db) {
    const resultado = await ejecutor.query('DELETE FROM viaticos_borradores WHERE id = ? AND usuario_id = ?', [id, usuarioId], 'viaticos:borradorEliminar');
    return resultado.affectedRows;
  }

  async eliminarVencidos() {
    const resultado = await db.query('DELETE FROM viaticos_borradores WHERE vence_en <= NOW()', [], 'viaticos:borradorVencidos');
    return resultado.affectedRows;
  }
}

module.exports = new BorradorRepository();
