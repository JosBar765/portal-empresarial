// src/modules/incidencias/repositories/operacionRepository.js
// Claves de operación (idempotencia): un reintento de la misma petición —un doble clic, una señal que se cae— devuelve el
// resultado de la primera vez y no crea nada dos veces.
const db = require('../../../config/database');

const objeto = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

class OperacionRepository {
  // El resultado guardado de una operación ya hecha con esa llave, o null si aún no existe.
  async resultadoDe(llave) {
    const filas = await db.query('SELECT resultado FROM idempotency_keys WHERE idempotency_key = ?', [llave], 'incidencias_operacion:clave');
    return filas[0] ? (objeto(filas[0].resultado) || {}) : null;
  }

  // Se guarda dentro de la misma transacción de la operación: dos intentos a la vez con la misma llave dejan un solo ganador.
  async registrar(tx, llave, endpoint, resultado) {
    await tx.query('INSERT INTO idempotency_keys (idempotency_key, endpoint, resultado) VALUES (?, ?, ?)', [llave, endpoint, JSON.stringify(resultado)], 'incidencias_operacion:clave_nueva');
  }
}

module.exports = new OperacionRepository();
