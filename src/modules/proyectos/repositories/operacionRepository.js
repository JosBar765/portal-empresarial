// src/modules/proyectos/repositories/operacionRepository.js
// Lo que comparten las operaciones de Proyectos que se pueden reintentar: la clave de la operación (idempotencia) y los bloqueos de
// fila en el orden fijo proyecto → participaciones. Todo el SQL de esas operaciones vive aquí, no en los servicios.
const db = require('../../../config/database');

const objeto = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

class OperacionRepository {
  // El resultado guardado de una operación ya hecha con esa llave, o null si aún no existe.
  async resultadoDe(llave) {
    const filas = await db.query('SELECT resultado FROM idempotency_keys WHERE idempotency_key = ?', [llave], 'proyectos_operacion:clave');
    return filas[0] ? (objeto(filas[0].resultado) || {}) : null;
  }

  // Se guarda dentro de la misma transacción de la operación: dos intentos a la vez con la misma llave dejan un solo ganador.
  async registrar(tx, llave, endpoint, resultado) {
    await tx.query('INSERT INTO idempotency_keys (idempotency_key, endpoint, resultado) VALUES (?, ?, ?)', [llave, endpoint, JSON.stringify(resultado)], 'proyectos_operacion:clave_nueva');
  }

  async bloquearProyecto(tx, proyectoId) {
    await tx.query('SELECT id FROM proy_proyectos WHERE id = ? FOR UPDATE', [proyectoId], 'proyectos_operacion:bloquear_proyecto');
  }

  async bloquearParticipaciones(tx, proyectoId) {
    await tx.query('SELECT id FROM proy_participaciones WHERE proyecto_id = ? ORDER BY id FOR UPDATE', [proyectoId], 'proyectos_operacion:bloquear_participaciones');
  }
}

module.exports = new OperacionRepository();
