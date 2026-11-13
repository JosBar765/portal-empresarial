// src/modules/proyectos/repositories/avisosRepository.js
// Avisos de Proyectos: la matriz que cambió el administrador, quiénes reciben cada aviso y lo que vigila `proyectosWatcher`.
// Todo el SQL vive aquí.
const db = require('../../../config/database');

const FINALES = ['vendida', 'perdida', 'descartada'];

class AvisosRepository {
  // --- Matriz (solo lo cambiado respecto a los valores por defecto) ---

  async cambios() {
    const [celdas, anticipaciones] = await Promise.all([
      db.query('SELECT evento, rol, activo FROM proy_avisos_config', [], 'proyectos_avisos:celdas'),
      db.query('SELECT evento, valor FROM proy_avisos_anticipacion', [], 'proyectos_avisos:anticipaciones')
    ]);
    return { celdas, anticipaciones };
  }

  guardarCelda(tx, { evento, rol, activo, usuarioId }) {
    return tx.query('INSERT INTO proy_avisos_config (evento, rol, activo, actualizado_por) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE activo = VALUES(activo), actualizado_por = VALUES(actualizado_por)',
      [evento, rol, activo ? 1 : 0, usuarioId], 'proyectos_avisos:guardar_celda');
  }

  guardarAnticipacion(tx, { evento, valor, usuarioId }) {
    return tx.query('INSERT INTO proy_avisos_anticipacion (evento, valor, actualizado_por) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor), actualizado_por = VALUES(actualizado_por)',
      [evento, valor, usuarioId], 'proyectos_avisos:guardar_anticipacion');
  }

  async borrarCambios(tx) {
    await tx.query('DELETE FROM proy_avisos_config', [], 'proyectos_avisos:borrar_celdas');
    await tx.query('DELETE FROM proy_avisos_anticipacion', [], 'proyectos_avisos:borrar_anticipaciones');
  }

  // --- Destinatarios ---

  // Los supervisores que cubren al menos una tienda del proyecto.
  async supervisoresDelProyecto(proyectoId) {
    const filas = await db.query(
      `SELECT DISTINCT st.usuario_id FROM supervisor_tiendas st JOIN proy_proyecto_tiendas pt ON pt.tienda_id = st.tienda_id JOIN usuarios u ON u.id = st.usuario_id AND u.activo = 1 WHERE pt.proyecto_id = ?`,
      [proyectoId], 'proyectos_avisos:supervisores'
    );
    return filas.map(f => f.usuario_id);
  }

  // Gerencia: quien tiene el permiso de ver todo o de dar el visto bueno.
  async gerentes() {
    const filas = await db.query(
      `SELECT DISTINCT u.id FROM usuarios u JOIN rol_permisos rp ON rp.rol_id = u.rol_id JOIN permisos p ON p.id = rp.permiso_id
       WHERE u.activo = 1 AND p.codigo IN ('proyectos.ver_gerencia', 'proyectos.dar_visto_bueno')`, [], 'proyectos_avisos:gerentes'
    );
    return filas.map(f => f.id);
  }

  // Cuántas empresas recibió cada asesor al activarse un proyecto.
  repartoPorAsesor(proyectoId) {
    return db.query('SELECT asesor_id, COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id IS NOT NULL GROUP BY asesor_id', [proyectoId], 'proyectos_avisos:reparto');
  }

  // --- Lo que vigila el watcher ---

  // Seguimientos de hoy que ya llegaron (o llegan dentro de `horas`) y todavía no vencen.
  seguimientosPorVencer({ inicioHoy, hasta }) {
    return db.query(
      `SELECT p.id, p.asesor_id, p.proxima_gestion_en, p.proyecto_id, y.nombre AS proyecto, c.nombre AS empresa FROM proy_participaciones p
         JOIN proy_proyectos y ON y.id = p.proyecto_id AND y.estado = 'activo' JOIN proy_clientes c ON c.id = p.cliente_id
       WHERE p.abierta = 1 AND p.asesor_id IS NOT NULL AND p.estado NOT IN (?) AND p.proxima_gestion_en >= ? AND p.proxima_gestion_en <= ?`,
      [FINALES, inicioHoy, hasta], 'proyectos_avisos:por_vencer'
    );
  }

  // Seguimientos cuya fecha ya pasó (antes de hoy).
  seguimientosVencidos({ inicioHoy }) {
    return db.query(
      `SELECT p.id, p.asesor_id, p.proxima_gestion_en, p.proyecto_id, y.nombre AS proyecto, c.nombre AS empresa FROM proy_participaciones p
         JOIN proy_proyectos y ON y.id = p.proyecto_id AND y.estado = 'activo' JOIN proy_clientes c ON c.id = p.cliente_id
       WHERE p.abierta = 1 AND p.asesor_id IS NOT NULL AND p.estado NOT IN (?) AND p.proxima_gestion_en < ?`,
      [FINALES, inicioHoy], 'proyectos_avisos:vencidos'
    );
  }

  proyectosActivos() {
    return db.query("SELECT id, nombre, fecha_fin, config_snapshot, aviso_vencido_en FROM proy_proyectos WHERE estado = 'activo' AND fecha_fin IS NOT NULL", [], 'proyectos_avisos:proyectos_activos');
  }

  async marcarVencidoAvisado(id, ahora) {
    const res = await db.query('UPDATE proy_proyectos SET aviso_vencido_en = ? WHERE id = ? AND aviso_vencido_en IS NULL', [ahora, id], 'proyectos_avisos:marcar_vencido');
    return res.affectedRows === 1;
  }

  // Sella «ya se avisó»: la primera vez devuelve true, las siguientes false. Sirve para no repetir un aviso en cada vuelta del vigilante.
  async sellar(clave) {
    const res = await db.query('INSERT IGNORE INTO idempotency_keys (idempotency_key, endpoint, resultado) VALUES (?, ?, ?)', [clave, 'proyectos.vigilante', '{}'], 'proyectos_avisos:sellar');
    return res.affectedRows === 1;
  }

  // Marca como leídos, para todos, los avisos de un tipo sobre un proyecto cuando la acción que pedían ya se resolvió.
  async marcarLeidos(tipo, proyectoId) {
    await db.query(
      "UPDATE notificaciones SET leida_en = NOW() WHERE modulo = 'proyectos' AND tipo = ? AND referencia_tipo = 'proyecto' AND referencia_id = ? AND leida_en IS NULL",
      [tipo, proyectoId], 'proyectos_avisos:marcar_leidos');
  }
}

module.exports = new AvisosRepository();
