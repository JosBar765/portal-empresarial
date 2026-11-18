// src/modules/viaticos/repositories/ajusteRepository.js
const db = require('../../../config/database');

class AjusteRepository {
  async listar() {
    return db.query('SELECT clave, valor, descripcion FROM viaticos_ajustes ORDER BY clave', [], 'viaticos:listarAjustes');
  }

  async obtener(clave) {
    const filas = await db.query('SELECT clave, valor, descripcion FROM viaticos_ajustes WHERE clave = ?', [clave], 'viaticos:obtenerAjuste');
    return filas[0] || null;
  }

  async guardar(clave, valorJson) {
    await db.query('UPDATE viaticos_ajustes SET valor = ? WHERE clave = ?', [valorJson, clave], 'viaticos:guardarAjuste');
  }
}

module.exports = new AjusteRepository();
