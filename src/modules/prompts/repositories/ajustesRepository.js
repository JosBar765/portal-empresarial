// src/modules/prompts/repositories/ajustesRepository.js
const db = require('../../../config/database');

class AjustesRepository {
  async listar() {
    return db.query(
      'SELECT clave, valor, descripcion, actualizado_en FROM prompt_ajustes ORDER BY clave',
      [], 'prompts:listarAjustes'
    );
  }

  async obtenerPorClave(clave) {
    const filas = await db.query(
      'SELECT clave, valor, descripcion, actualizado_en FROM prompt_ajustes WHERE clave = ?',
      [clave], 'prompts:obtenerAjuste'
    );
    return filas[0] || null;
  }

  async guardarValor(clave, valor) {
    await db.query('UPDATE prompt_ajustes SET valor = ? WHERE clave = ?', [JSON.stringify(valor), clave], 'prompts:guardarAjuste');
  }
}

module.exports = new AjustesRepository();
