// src/modules/viaticos/repositories/rechazoRepository.js
// SQL del plazo de las solicitudes rechazadas. Todo se mide con el reloj de MySQL (NOW()), el mismo que fija `rechazada_en`.
const db = require('../../../config/database');
const { ESTADOS } = require('../constantes');
const { filasACamel, filaACamel } = require('../utilidades');

// Cada consulta recibe el plazo en segundos como primer parámetro de `VENCE`.
const VENCE = 'DATE_ADD(s.rechazada_en, INTERVAL ? SECOND)';
const ESTA_RECHAZADA = 's.rechazada_en IS NOT NULL AND s.estado_id = (SELECT id FROM viaticos_estados WHERE nombre = ?)';

class RechazoRepository {
  // Tiempo que le queda a cada solicitud rechazada de la lista dada; las demás no aparecen.
  async vencimientos(ids, segundos, ejecutor = db) {
    if (ids.length === 0) return [];
    return filasACamel(await ejecutor.query(
      `SELECT s.id, DATE_FORMAT(${VENCE}, '%Y-%m-%d %H:%i:%s') AS vence_en,
              GREATEST(0, TIMESTAMPDIFF(MINUTE, NOW(), ${VENCE})) AS minutos_restantes
       FROM viaticos_solicitudes s WHERE s.id IN (?) AND ${ESTA_RECHAZADA}`,
      [segundos, segundos, ids, ESTADOS.RECHAZADA], 'viaticos:vencimientosRechazadas'
    ));
  }

  // Ya pasó la fracción del plazo del aviso, aún no vence y no se ha avisado. `segundosAviso` es esa fracción en segundos.
  async listarPorAvisar(segundosAviso, segundos, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `SELECT s.id, s.correlativo, s.solicitante_id, GREATEST(0, TIMESTAMPDIFF(MINUTE, NOW(), ${VENCE})) AS minutos_restantes
       FROM viaticos_solicitudes s
       WHERE ${ESTA_RECHAZADA} AND s.vencimiento_aviso_en IS NULL
         AND DATE_ADD(s.rechazada_en, INTERVAL ? SECOND) <= NOW() AND ${VENCE} > NOW()
       ORDER BY s.rechazada_en, s.id`,
      [segundos, ESTADOS.RECHAZADA, segundosAviso, segundos], 'viaticos:rechazadasPorAvisar'
    ));
  }

  // Un solo aviso por rechazo: solo marca si sigue sin avisar (devuelve cuántas filas cambió).
  async marcarAviso(id, ejecutor = db) {
    const resultado = await ejecutor.query(
      'UPDATE viaticos_solicitudes SET vencimiento_aviso_en = NOW() WHERE id = ? AND vencimiento_aviso_en IS NULL', [id], 'viaticos:marcarAvisoVencimiento'
    );
    return resultado.affectedRows;
  }

  async listarVencidas(segundos, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      `SELECT s.id, s.correlativo FROM viaticos_solicitudes s
       WHERE ${ESTA_RECHAZADA} AND ${VENCE} <= NOW() ORDER BY s.rechazada_en, s.id`,
      [ESTADOS.RECHAZADA, segundos], 'viaticos:rechazadasVencidas'
    ));
  }

  // Bloquea la solicitud solo si SIGUE rechazada y vencida (pudo modificarse o borrarse desde que se listó); null si ya no aplica.
  // El id del estado llega aparte: una subconsulta en la lectura bloqueante no debe tocar la fila compartida del catálogo.
  async bloquearVencida(id, estadoRechazadaId, segundos, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT s.id, s.correlativo, s.solicitante_id, s.pdf_ruta FROM viaticos_solicitudes s
       WHERE s.id = ? AND s.estado_id = ? AND s.rechazada_en IS NOT NULL AND ${VENCE} <= NOW() FOR UPDATE`,
      [id, estadoRechazadaId, segundos], 'viaticos:bloquearVencida'
    );
    return filas[0] ? filaACamel(filas[0]) : null;
  }

  // Motivo del último rechazo registrado en el historial.
  async motivoDelRechazo(id, ejecutor = db) {
    const filas = await ejecutor.query(
      'SELECT motivo FROM viaticos_historial WHERE solicitud_id = ? AND motivo IS NOT NULL ORDER BY id DESC LIMIT 1',
      [id], 'viaticos:motivoDelRechazo'
    );
    return filas[0] ? filas[0].motivo : null;
  }
}

module.exports = new RechazoRepository();
