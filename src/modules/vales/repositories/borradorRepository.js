// src/modules/vales/repositories/borradorRepository.js
// SQL de los borradores de vale y sus adjuntos. Siempre se filtra por dueño: un borrador es privado.
const db = require('../../../config/database');

const CLAVE_TOPE = 'max_borradores_por_usuario';
const TOPE_POR_DEFECTO = 15;

const DIAS_RESTANTES = 'GREATEST(0, CEIL(TIMESTAMPDIFF(SECOND, NOW(), vence_en) / 86400))';

const COLUMNAS_DETALLE = `
  id, cliente_empresa, cliente_nombre, cliente_telefono, cliente_correo, talleres_ids,
  DATE_FORMAT(fecha_entrega, '%Y-%m-%d') AS fecha_entrega, DATE_FORMAT(fecha_evento, '%Y-%m-%d') AS fecha_evento,
  urgente, producto, material, tecnica, acabado, cantidad, cotizacion, descripcion,
  DATE_FORMAT(creado_en, '%Y-%m-%d') AS creado_en, DATE_FORMAT(vence_en, '%Y-%m-%d') AS vence_en,
  ${DIAS_RESTANTES} AS dias_restantes`;

const CAMPOS_EDITABLES = [
  'cliente_empresa', 'cliente_nombre', 'cliente_telefono', 'cliente_correo', 'talleres_ids',
  'fecha_entrega', 'fecha_evento', 'urgente', 'producto', 'material', 'tecnica', 'acabado',
  'cantidad', 'cotizacion', 'descripcion'
];

class BorradorRepository {
  async obtenerTope() {
    const rows = await db.query('SELECT valor FROM parametros_sistema WHERE clave = ?', [CLAVE_TOPE], 'borrador:tope');
    const tope = rows[0] ? Number(rows[0].valor) : NaN;
    return Number.isInteger(tope) && tope > 0 ? tope : TOPE_POR_DEFECTO;
  }

  async contarPorUsuario(usuarioId) {
    const rows = await db.query('SELECT COUNT(*) AS n FROM vale_borradores WHERE usuario_id = ?', [usuarioId], 'borrador:contar');
    return Number(rows[0].n);
  }

  listarPorUsuario(usuarioId) {
    return db.query(
      `SELECT id, COALESCE(cliente_nombre, producto, 'Borrador sin título') AS titulo,
              DATE_FORMAT(creado_en, '%Y-%m-%d') AS creado_en, DATE_FORMAT(vence_en, '%Y-%m-%d') AS vence_en,
              ${DIAS_RESTANTES} AS dias_restantes
       FROM vale_borradores WHERE usuario_id = ? ORDER BY creado_en DESC, id DESC`,
      [usuarioId], 'borrador:listar'
    );
  }

  async obtenerDeUsuario(id, usuarioId) {
    const rows = await db.query(
      `SELECT ${COLUMNAS_DETALLE} FROM vale_borradores WHERE id = ? AND usuario_id = ?`,
      [id, usuarioId], 'borrador:obtener'
    );
    return rows[0] || null;
  }

  // `vence_en` se fija una sola vez, con el reloj de MySQL; editar el borrador no lo renueva.
  async insertar(usuarioId, datos, diasVigencia) {
    const result = await db.query(
      `INSERT INTO vale_borradores (usuario_id, ${CAMPOS_EDITABLES.join(', ')}, vence_en)
       VALUES (?, ${CAMPOS_EDITABLES.map(() => '?').join(', ')}, DATE_ADD(NOW(), INTERVAL ? DAY))`,
      [usuarioId, ...CAMPOS_EDITABLES.map(c => datos[c]), diasVigencia], 'borrador:insert'
    );
    return result.insertId;
  }

  actualizar(id, datos) {
    return db.query(
      `UPDATE vale_borradores SET ${CAMPOS_EDITABLES.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...CAMPOS_EDITABLES.map(c => datos[c]), id], 'borrador:update'
    );
  }

  async eliminar(id) {
    await db.query('DELETE FROM vale_borradores WHERE id = ?', [id], 'borrador:delete');
  }

  listarVencidos() {
    return db.query('SELECT id FROM vale_borradores WHERE vence_en <= NOW() ORDER BY vence_en', [], 'borrador:vencidos');
  }

  listarDocumentos(borradorId) {
    return db.query(
      'SELECT id, nombre_original, ruta, tipo, mime_type, tamano FROM vale_borrador_documentos WHERE borrador_id = ? ORDER BY id',
      [borradorId], 'borrador:documentos'
    );
  }

  async insertarDocumento({ borradorId, nombreOriginal, ruta, tipo, mimeType, tamano }) {
    const result = await db.query(
      'INSERT INTO vale_borrador_documentos (borrador_id, nombre_original, ruta, tipo, mime_type, tamano) VALUES (?, ?, ?, ?, ?, ?)',
      [borradorId, nombreOriginal, ruta, tipo, mimeType, tamano], 'borrador:documento_insert'
    );
    return result.insertId;
  }

  async eliminarDocumento(id) {
    await db.query('DELETE FROM vale_borrador_documentos WHERE id = ?', [id], 'borrador:documento_delete');
  }
}

module.exports = new BorradorRepository();
