// src/modules/prompts/repositories/productoRepository.js
const db = require('../../../config/database');

class ProductoRepository {
  // Resumen para la lista del administrador; el esquema es el de la versión vigente (o el borrador si aún no hay).
  async listarConResumen() {
    return db.query(
      `SELECT p.id, p.codigo, p.nombre, p.estado, p.actualizado_en,
              pub.numero AS numero_vigente,
              (bor.id IS NOT NULL) AS tiene_borrador,
              COALESCE(pub.esquema, bor.esquema) AS esquema
       FROM prompt_productos p
       LEFT JOIN prompt_producto_versiones pub ON pub.producto_id = p.id AND pub.estado = 'publicada'
       LEFT JOIN prompt_producto_versiones bor ON bor.producto_id = p.id AND bor.estado = 'borrador'
       ORDER BY p.nombre`,
      [], 'prompts:listarProductos'
    );
  }

  // Productos que el asesor puede usar: activos con versión publicada.
  async listarActivosConPublicada() {
    return db.query(
      `SELECT p.id, p.codigo, p.nombre, p.descripcion, v.id AS version_id, v.numero, v.esquema
       FROM prompt_productos p
       JOIN prompt_producto_versiones v ON v.producto_id = p.id AND v.estado = 'publicada'
       WHERE p.estado = 'activo'
       ORDER BY p.nombre`,
      [], 'prompts:listarActivos'
    );
  }

  async obtenerPorId(id, ejecutor = db) {
    const filas = await ejecutor.query(
      'SELECT id, codigo, nombre, descripcion, estado, creado_en, actualizado_en FROM prompt_productos WHERE id = ?',
      [id], 'prompts:obtenerProducto'
    );
    return filas[0] || null;
  }

  // Bloquea la fila del producto: serializa publicar y crear borrador del mismo producto.
  async obtenerBloqueado(id, tx) {
    const filas = await tx.query(
      'SELECT id, codigo, nombre, descripcion, estado FROM prompt_productos WHERE id = ? FOR UPDATE',
      [id], 'prompts:bloquearProducto'
    );
    return filas[0] || null;
  }

  async existeCodigo(codigo, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id FROM prompt_productos WHERE codigo = ?', [codigo], 'prompts:existeCodigo');
    return filas.length > 0;
  }

  async crear({ codigo, nombre, descripcion, creadoPor }, ejecutor = db) {
    const resultado = await ejecutor.query(
      "INSERT INTO prompt_productos (codigo, nombre, descripcion, estado, creado_por) VALUES (?, ?, ?, 'borrador', ?)",
      [codigo, nombre, descripcion, creadoPor], 'prompts:crearProducto'
    );
    return resultado.insertId;
  }

  // Solo borra inactivos: la condición repite la regla del servicio como resguardo.
  async eliminar(id, ejecutor = db) {
    const resultado = await ejecutor.query(
      "DELETE FROM prompt_productos WHERE id = ? AND estado = 'inactivo'",
      [id], 'prompts:eliminarProducto'
    );
    return resultado.affectedRows > 0;
  }

  async actualizarEstado(id, estado, ejecutor = db) {
    await ejecutor.query('UPDATE prompt_productos SET estado = ? WHERE id = ?', [estado, id], 'prompts:estadoProducto');
  }
}

module.exports = new ProductoRepository();
