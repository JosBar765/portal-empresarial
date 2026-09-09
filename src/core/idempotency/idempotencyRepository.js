// src/core/idempotency/idempotencyRepository.js
// Tabla genérica y reutilizable: guarda el resultado ya calculado de una
// operación identificada por su idempotency key, para que un reintento del
// mismo request (ej. tras un corte de red) devuelva el mismo resultado sin
// repetir la subida a Storage ni la escritura en la base de datos.
const db = require('../../config/database');

class IdempotencyRepository {
  async buscar(idempotencyKey) {
    const rows = await db.query(
      'SELECT * FROM idempotency_keys WHERE idempotency_key = ?',
      [idempotencyKey],
      'idempotency:find_by_key'
    );
    if (!rows[0]) return null;
    const fila = rows[0];
    return { ...fila, resultado: typeof fila.resultado === 'string' ? JSON.parse(fila.resultado) : fila.resultado };
  }

  async registrar(idempotencyKey, endpoint, resultado) {
    await db.query(
      'INSERT INTO idempotency_keys (idempotency_key, endpoint, resultado) VALUES (?, ?, ?)',
      [idempotencyKey, endpoint, JSON.stringify(resultado)],
      'idempotency:insert'
    );
  }
}

module.exports = new IdempotencyRepository();
