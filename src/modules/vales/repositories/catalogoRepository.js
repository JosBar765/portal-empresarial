// src/modules/vales/repositories/catalogoRepository.js
const db = require('../../../config/database');

class CatalogoRepository {
  async listarLocalidades() {
    return db.query('SELECT id, codigo, nombre, pais_id FROM localidades WHERE activo = 1 ORDER BY nombre', [], 'catalog:localidades');
  }

  async obtenerLocalidadPorId(id) {
    const rows = await db.query('SELECT id, codigo, nombre, pais_id FROM localidades WHERE id = ?', [id], 'catalog:localidades');
    return rows.find(l => l.id === Number(id)) || null;
  }

  async listarProductos() {
    return db.query('SELECT id, codigo, nombre FROM vale_productos WHERE activo = 1 ORDER BY nombre', [], 'catalog:productos');
  }

  async listarMateriales() {
    return db.query('SELECT id, nombre FROM vale_materiales WHERE activo = 1 ORDER BY nombre', [], 'catalog:materiales');
  }

  async listarTecnicas() {
    return db.query('SELECT id, nombre FROM vale_tecnicas WHERE activo = 1 ORDER BY nombre', [], 'catalog:tecnicas');
  }

  async listarAcabados() {
    return db.query('SELECT id, nombre FROM vale_acabados WHERE activo = 1 ORDER BY nombre', [], 'catalog:acabados');
  }

  async listarPaises() {
    return db.query('SELECT id, codigo, nombre, codigo_telefono FROM paises ORDER BY nombre', [], 'catalog:paises');
  }
}

module.exports = new CatalogoRepository();
