// src/modules/viaticos/repositories/referenciaRepository.js
// Consultas de solo lectura sobre tablas de referencia que otros servicios del módulo validan.
const db = require('../../../config/database');
const { filasACamel } = require('../utilidades');

class ReferenciaRepository {
  async listarPaises() {
    return filasACamel(await db.query('SELECT id, codigo, nombre FROM paises ORDER BY nombre', [], 'viaticos:listarPaises'));
  }

  async paisExiste(id, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id FROM paises WHERE id = ?', [id], 'viaticos:paisExiste');
    return filas.length > 0;
  }

  // Cuántos de los ids existen: sirve para validar una lista completa de una vez.
  async contarPaises(ids, ejecutor = db) {
    if (ids.length === 0) return 0;
    const filas = await ejecutor.query('SELECT COUNT(*) AS total FROM paises WHERE id IN (?)', [ids], 'viaticos:contarPaises');
    return Number(filas[0].total);
  }

  async tipoPlacaPorId(id, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id, pais_id FROM viaticos_tipos_placa WHERE id = ?', [id], 'viaticos:tipoPlaca');
    return filas[0] ? filasACamel(filas)[0] : null;
  }

  async tipoLicenciaExiste(id, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id FROM viaticos_tipos_licencia WHERE id = ?', [id], 'viaticos:tipoLicenciaExiste');
    return filas.length > 0;
  }

  async combustibleExiste(id, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id FROM viaticos_combustibles WHERE id = ?', [id], 'viaticos:combustibleExiste');
    return filas.length > 0;
  }

  async usuarioExiste(id, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id FROM usuarios WHERE id = ?', [id], 'viaticos:usuarioExiste');
    return filas.length > 0;
  }

  async ubicacionesPorIds(ids, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id, nombre FROM viaticos_ubicaciones WHERE id IN (?)', [ids], 'viaticos:ubicacionesPorIds');
    return filasACamel(filas);
  }
}

module.exports = new ReferenciaRepository();
