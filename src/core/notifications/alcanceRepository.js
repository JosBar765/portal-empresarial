// Selección guardada de tiendas y asesores por usuario y módulo.
const db = require('../../config/database');

class AlcanceRepository {
  leer(usuarioId, modulo) {
    return db.query('SELECT clase, ref_id FROM notificacion_filtros WHERE usuario_id = ? AND modulo = ?', [usuarioId, modulo], 'alcance:leer');
  }

  async activo(usuarioId, modulo) {
    const rows = await db.query(
      "SELECT COUNT(*) AS n FROM notificacion_filtros WHERE usuario_id = ? AND modulo = ? AND clase <> 'guardado'",
      [usuarioId, modulo],
      'alcance:activo'
    );
    return Number((rows[0] || {}).n || 0) > 0;
  }

  borrar(usuarioId, modulo) {
    return db.query('DELETE FROM notificacion_filtros WHERE usuario_id = ? AND modulo = ?', [usuarioId, modulo], 'alcance:borrar');
  }

  usuariosConFiltro(modulo) {
    return db.query("SELECT DISTINCT usuario_id FROM notificacion_filtros WHERE modulo = ? AND clase <> 'guardado'", [modulo], 'alcance:usuarios');
  }

  // La fila `guardado` distingue «elegí todas» de «nunca elegí». `paises` y `grupos`: completos, con sus tiendas futuras.
  reemplazar(usuarioId, modulo, { tiendas = [], paises = [], grupos = [], asesores = [] }) {
    const filas = [
      ['guardado', 0], ...tiendas.map(id => ['tienda', id]), ...paises.map(id => ['pais', id]),
      ...grupos.map(id => ['grupo', id]), ...asesores.map(id => ['asesor', id])
    ];
    return db.transaccion(async (tx) => {
      await tx.query('DELETE FROM notificacion_filtros WHERE usuario_id = ? AND modulo = ?', [usuarioId, modulo], 'alcance:borrar');
      await tx.query(
        'INSERT INTO notificacion_filtros (usuario_id, modulo, clase, ref_id) VALUES ?',
        [filas.map(([clase, id]) => [usuarioId, modulo, clase, id])],
        'alcance:insert'
      );
    });
  }
}

module.exports = new AlcanceRepository();
