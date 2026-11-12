// src/modules/proyectos/repositories/metasRepository.js
// Metas de ventas por asesor y la reserva de empresas sin asesor (rondas). Todo el SQL vive aquí.
const db = require('../../../config/database');

class MetasRepository {
  // Los asesores con empresas en el proyecto, con su tienda.
  // Los participantes activos del proyecto, tengan o no empresas hoy: reasignar no cambia cuántos asesores se reparten la meta.
  asesores(proyectoId, ejecutor = db) {
    return ejecutor.query(
      `SELECT pp.usuario_id AS asesor_id, u.nombre, pp.tienda_id, t.codigo AS tienda, e.nombre AS empresa
       FROM proy_participantes pp JOIN usuarios u ON u.id = pp.usuario_id JOIN tiendas t ON t.id = pp.tienda_id JOIN empresas e ON e.id = t.empresa_id
       WHERE pp.proyecto_id = ? AND pp.estado = 'activo' ORDER BY u.nombre, pp.usuario_id`,
      [proyectoId], 'proyectos_metas:asesores'
    );
  }

  // Lo vendido (confirmado y vigente) por asesor y moneda. Lo anulado, rechazado o «por confirmar» no cuenta.
  vendido(proyectoId, ejecutor = db) {
    return ejecutor.query(
      `SELECT p.asesor_id, v.moneda, SUM(v.monto) AS total
       FROM proy_ventas v JOIN proy_participaciones p ON p.id = v.participacion_id
       WHERE p.proyecto_id = ? AND p.asesor_id IS NOT NULL AND v.anulada_en IS NULL AND v.estado = 'confirmada' GROUP BY p.asesor_id, v.moneda`,
      [proyectoId], 'proyectos_metas:vendido'
    );
  }

  async ajustadas(proyectoId, ejecutor = db) {
    const filas = await ejecutor.query('SELECT asesor_id, monto FROM proy_metas_asesor WHERE proyecto_id = ?', [proyectoId], 'proyectos_metas:ajustadas');
    return new Map(filas.map(f => [f.asesor_id, Number(f.monto)]));
  }

  async fijar(tx, proyectoId, asesorId, monto, usuarioId) {
    await tx.query(
      `INSERT INTO proy_metas_asesor (proyecto_id, asesor_id, monto, actualizado_por) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE monto = VALUES(monto), actualizado_por = VALUES(actualizado_por)`,
      [proyectoId, asesorId, monto, usuarioId], 'proyectos_metas:fijar'
    );
  }

  quitar(tx, proyectoId, asesorId) {
    return tx.query('DELETE FROM proy_metas_asesor WHERE proyecto_id = ? AND asesor_id = ?', [proyectoId, asesorId], 'proyectos_metas:quitar');
  }

  // --- Reserva (rondas) ---

  // Las empresas sin asesor del proyecto, en orden de id; con `bloquear` quedan bloqueadas dentro de la transacción.
  reserva(proyectoId, ejecutor = db, bloquear = false) {
    return ejecutor.query(
      `SELECT p.id, p.cliente_id, c.pais_id, c.tienda_origen_id
       FROM proy_participaciones p JOIN proy_clientes c ON c.id = p.cliente_id
       WHERE p.proyecto_id = ? AND p.asesor_id IS NULL AND p.abierta = 1 ORDER BY p.id${bloquear ? ' FOR UPDATE' : ''}`,
      [proyectoId], 'proyectos_metas:reserva'
    );
  }

  async entregar(tx, id, asesorId, tiendaId, porUsuarioId) {
    const res = await tx.query(
      'UPDATE proy_participaciones SET asesor_id = ?, tienda_id = ?, asignada_en = NOW(), asignada_por = ? WHERE id = ? AND asesor_id IS NULL AND abierta = 1',
      [asesorId, tiendaId, porUsuarioId, id], 'proyectos_metas:entregar'
    );
    return res.affectedRows;
  }
}

module.exports = new MetasRepository();
