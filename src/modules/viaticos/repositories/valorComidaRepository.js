// src/modules/viaticos/repositories/valorComidaRepository.js
const db = require('../../../config/database');
const { filasACamel } = require('../utilidades');

class ValorComidaRepository {
  async listarMonedas(ejecutor = db) {
    return filasACamel(await ejecutor.query('SELECT id, codigo, nombre, simbolo, activo FROM viaticos_monedas ORDER BY codigo', [], 'viaticos:matrizMonedas'));
  }

  async listarTiposComida(ejecutor = db) {
    return filasACamel(await ejecutor.query('SELECT id, nombre, orden FROM viaticos_tipos_comida ORDER BY orden', [], 'viaticos:matrizTipos'));
  }

  async listarValores(ejecutor = db) {
    return filasACamel(await ejecutor.query('SELECT moneda_id, tipo_comida_id, valor FROM viaticos_valores_comida', [], 'viaticos:matrizValores'));
  }

  // Deja en la tabla exactamente las celdas recibidas: upsert de cada una y baja de las demás.
  async reemplazar(celdas, tx) {
    for (const { monedaId, tipoComidaId, valor } of celdas) {
      await tx.query(
        `INSERT INTO viaticos_valores_comida (moneda_id, tipo_comida_id, valor) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        [monedaId, tipoComidaId, valor], 'viaticos:upsertValorComida'
      );
    }
    if (celdas.length === 0) {
      await tx.query('DELETE FROM viaticos_valores_comida', [], 'viaticos:vaciarValoresComida');
      return;
    }
    await tx.query(
      'DELETE FROM viaticos_valores_comida WHERE (moneda_id, tipo_comida_id) NOT IN (?)',
      [celdas.map(c => [c.monedaId, c.tipoComidaId])], 'viaticos:quitarValoresComida'
    );
  }
}

module.exports = new ValorComidaRepository();
