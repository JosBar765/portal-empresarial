// src/modules/viaticos/repositories/movimientoRepository.js
// Historial permanente de movimientos: sin llaves foráneas, sus renglones sobreviven a la baja y al vencimiento de la solicitud.
const db = require('../../../config/database');
const { filasACamel } = require('../utilidades');

class MovimientoRepository {
  // `ejecutor` es la transacción del cambio de negocio: el movimiento y el cambio se confirman o se deshacen juntos.
  async registrar({ solicitudId, correlativo, tipo, usuarioId, usuarioNombre, accion }, ejecutor = db) {
    await ejecutor.query(
      'INSERT INTO viaticos_movimientos (solicitud_id, correlativo, tipo, usuario_id, usuario_nombre, accion) VALUES (?, ?, ?, ?, ?, ?)',
      [solicitudId, correlativo, tipo, usuarioId, usuarioNombre, accion], 'viaticos:registrarMovimiento'
    );
  }

  async listarPorSolicitud(solicitudId, ejecutor = db) {
    return filasACamel(await ejecutor.query(
      'SELECT id, tipo, usuario_nombre, accion, creado_en FROM viaticos_movimientos WHERE solicitud_id = ? ORDER BY id ASC',
      [solicitudId], 'viaticos:movimientosDeSolicitud'
    ));
  }

  // Nombre de quien actúa cuando el servicio solo conoce su id.
  async nombreDeUsuario(usuarioId, ejecutor = db) {
    const filas = await ejecutor.query('SELECT nombre FROM usuarios WHERE id = ?', [usuarioId], 'viaticos:nombreDeUsuario');
    return filas[0] ? filas[0].nombre : null;
  }
}

module.exports = new MovimientoRepository();
