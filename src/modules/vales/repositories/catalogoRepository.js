// src/modules/vales/repositories/catalogoRepository.js
const db = require('../../../config/database');

class CatalogoRepository {
  // analisis_correcciones_12.md #10: `localidades` -> `tiendas`, con
  // departamento_id/subdivision_id además del código/nombre/país de siempre.
  async listarTiendas() {
    return db.query('SELECT id, codigo, nombre, pais_id, departamento_id, subdivision_id FROM tiendas WHERE activo = 1 ORDER BY nombre', [], 'catalog:tiendas');
  }

  async obtenerTiendaPorId(id) {
    const rows = await db.query('SELECT id, codigo, nombre, pais_id, departamento_id, subdivision_id FROM tiendas WHERE id = ?', [id], 'catalog:tiendas');
    return rows.find(t => t.id === Number(id)) || null;
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
