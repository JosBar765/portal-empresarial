// src/modules/vales/repositories/catalogoRepository.js
const db = require('../../../config/database');

class CatalogoRepository {
  // `tiendas` no tiene `nombre`/`pais_id` propios — se derivan vía `empresas`
  // (nombre = "{EMPRESA}, {SUBDIVISIÓN}", o solo "{EMPRESA}" sin
  // subdivisión; país = el de la empresa).
  async listarTiendas() {
    return db.query(
      `SELECT t.id, t.codigo, e.pais_id, t.departamento_id, t.subdivision_id,
              CONCAT(e.nombre, IF(s.nombre IS NOT NULL, CONCAT(', ', s.nombre), '')) AS nombre
       FROM tiendas t
       JOIN empresas e ON e.id = t.empresa_id
       LEFT JOIN subdivisiones s ON s.id = t.subdivision_id
       WHERE t.activo = 1
       ORDER BY nombre`,
      [],
      'catalog:tiendas'
    );
  }

  async obtenerTiendaPorId(id) {
    const rows = await db.query(
      `SELECT t.id, t.codigo, e.pais_id, t.departamento_id, t.subdivision_id,
              CONCAT(e.nombre, IF(s.nombre IS NOT NULL, CONCAT(', ', s.nombre), '')) AS nombre
       FROM tiendas t
       JOIN empresas e ON e.id = t.empresa_id
       LEFT JOIN subdivisiones s ON s.id = t.subdivision_id
       WHERE t.id = ?`,
      [id],
      'catalog:tiendas'
    );
    return rows.find(t => t.id === Number(id)) || null;
  }

  async listarPaises() {
    return db.query('SELECT id, codigo, nombre, codigo_telefono FROM paises ORDER BY nombre', [], 'catalog:paises');
  }
}

module.exports = new CatalogoRepository();
