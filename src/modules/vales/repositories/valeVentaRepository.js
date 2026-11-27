// Ventas por orden de venta (`vale_ventas`) y su bitácora (`vale_venta_eventos`).
const db = require('../../../config/database');

// El número viaja como texto; las columnas "activas" liberan la OV y el vale al rechazar o borrar.
const SELECT_VENTA = `SELECT vv.id, vv.vale_id, CAST(vv.numero_ov AS CHAR) AS numero_ov, vv.estado, vv.registrada_en,
  v.asesor_id, v.correlativo
  FROM vale_ventas vv JOIN vales v ON v.id = vv.vale_id`;

class ValeVentaRepository {
  async obtenerActivaPorVale(valeId) {
    const filas = await db.query(`${SELECT_VENTA} WHERE vv.vale_activo = ?`, [valeId], 'vale_venta:activa_por_vale');
    return filas[0] || null;
  }

  async obtenerUltimaPorVale(valeId) {
    const filas = await db.query(`${SELECT_VENTA} WHERE vv.vale_id = ? ORDER BY vv.id DESC LIMIT 1`, [valeId], 'vale_venta:ultima_por_vale');
    return filas[0] || null;
  }

  async obtenerActivaPorNumero(numero) {
    const filas = await db.query(`${SELECT_VENTA} WHERE vv.numero_activo = ?`, [numero], 'vale_venta:activa_por_numero');
    return filas[0] || null;
  }

  async listarPorConfirmar() {
    return db.query(`${SELECT_VENTA} WHERE vv.estado = 'POR_CONFIRMAR'`, [], 'vale_venta:por_confirmar');
  }

  async listarActivasPorVales(valeIds) {
    if (!valeIds.length) return [];
    return db.query(`${SELECT_VENTA} WHERE vv.vale_activo IN (?)`, [valeIds], 'vale_venta:activas_por_vales');
  }

  async registrarEvento({ valeId, evento, numero, numeroAnterior = null, usuarioId, fecha }, conexion = db) {
    await conexion.query(
      'INSERT INTO vale_venta_eventos (vale_id, evento, numero_ov, numero_anterior, usuario_id, creado_en) VALUES (?, ?, ?, ?, ?, ?)',
      [valeId, evento, numero, numeroAnterior, usuarioId, fecha], 'vale_venta:evento'
    );
  }

  // Evento y línea del historial en la misma transacción que el cambio; el estado del vale no se toca.
  async _anotar(tx, datos) {
    await this.registrarEvento(datos, tx);
    await tx.query(
      'INSERT INTO vale_historial (vale_id, usuario_id, taller_id, estado_anterior, estado_nuevo, accion, disenador_id) VALUES (?, ?, NULL, ?, ?, ?, NULL)',
      [datos.valeId, datos.usuarioId, datos.estadoVale, datos.estadoVale, datos.accion], 'historial:insert'
    );
  }

  async registrar(datos) {
    return db.transaccion(async (tx) => {
      await tx.query(
        `INSERT INTO vale_ventas (vale_id, vale_activo, numero_ov, numero_activo, estado, registrada_por, registrada_en)
         VALUES (?, ?, ?, ?, 'POR_CONFIRMAR', ?, ?)`,
        [datos.valeId, datos.valeId, datos.numero, datos.numero, datos.usuarioId, datos.fecha], 'vale_venta:insert'
      );
      await this._anotar(tx, { ...datos, evento: 'REGISTRADA' });
    });
  }

  // Las tres siguientes son condicionales: devuelven false si la venta ya no estaba como se vio.
  async corregir(datos) {
    return db.transaccion(async (tx) => {
      const res = await tx.query(
        "UPDATE vale_ventas SET numero_ov = ?, numero_activo = ? WHERE id = ? AND estado = 'POR_CONFIRMAR' AND numero_ov = ?",
        [datos.numero, datos.numero, datos.ventaId, datos.numeroAnterior], 'vale_venta:corregir'
      );
      if (res.affectedRows !== 1) return false;
      await this._anotar(tx, { ...datos, evento: 'CORREGIDA' });
      return true;
    });
  }

  // `estado`: CONFIRMADA conserva ocupados la OV y el vale; RECHAZADA y BORRADA los liberan.
  async cerrar(datos) {
    return db.transaccion(async (tx) => {
      const liberar = datos.estado === 'CONFIRMADA' ? '' : ', numero_activo = NULL, vale_activo = NULL';
      const res = await tx.query(
        `UPDATE vale_ventas SET estado = ?, resuelta_por = ?, resuelta_en = ?${liberar}
         WHERE id = ? AND estado = 'POR_CONFIRMAR' AND numero_ov = ?`,
        [datos.estado, datos.usuarioId, datos.fecha, datos.ventaId, datos.numero], 'vale_venta:cerrar'
      );
      if (res.affectedRows !== 1) return false;
      await this._anotar(tx, { ...datos, evento: datos.estado });
      return true;
    });
  }
}

module.exports = new ValeVentaRepository();
