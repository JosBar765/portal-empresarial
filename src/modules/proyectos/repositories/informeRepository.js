// src/modules/proyectos/repositories/informeRepository.js
// Las piezas del informe de un proyecto que no están ya en `seguimientoRepository` (cifras, por asesor y por tienda viven allí
// para que el seguimiento y el informe cuenten exactamente igual). Todo el SQL vive aquí. Lo anulado, rechazado o «por confirmar» no cuenta.
const db = require('../../../config/database');

class InformeRepository {
  // Con al menos una gestión cuyo resultado logró contacto.
  async contactadas(proyectoId) {
    const filas = await db.query(
      `SELECT COUNT(*) AS n FROM proy_participaciones p WHERE p.proyecto_id = ? AND p.asesor_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM proy_gestiones g JOIN proy_resultados_gestion r ON r.id = g.resultado_id WHERE g.participacion_id = p.id AND g.anulada_en IS NULL AND r.contacto_logrado = 1)`,
      [proyectoId], 'proyectos_informe:contactadas'
    );
    return Number(filas[0].n);
  }

  async conteoPorEstado(proyectoId) {
    const filas = await db.query('SELECT estado, COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id IS NOT NULL GROUP BY estado', [proyectoId], 'proyectos_informe:conteo_estado');
    return Object.fromEntries(filas.map(f => [f.estado, Number(f.n)]));
  }

  async perdidasPorMotivo(proyectoId) {
    const filas = await db.query(
      `SELECT COALESCE(m.nombre, 'Sin motivo') AS motivo, COUNT(*) AS n FROM proy_participaciones p LEFT JOIN proy_motivos_perdida m ON m.id = p.motivo_perdida_id
       WHERE p.proyecto_id = ? AND p.asesor_id IS NOT NULL AND p.estado = 'perdida' GROUP BY m.nombre ORDER BY n DESC, motivo`,
      [proyectoId], 'proyectos_informe:perdidas'
    );
    return filas.map(f => ({ motivo: f.motivo, n: Number(f.n) }));
  }

  // Totales por moneda, nunca mezclados.
  async montos(proyectoId) {
    const [cotizado, vendido] = await Promise.all([
      db.query(
        `SELECT c.moneda, SUM(c.monto) AS total FROM proy_cotizaciones c JOIN proy_participaciones p ON p.id = c.participacion_id
         WHERE p.proyecto_id = ? AND p.asesor_id IS NOT NULL AND c.anulada_en IS NULL GROUP BY c.moneda ORDER BY c.moneda`, [proyectoId], 'proyectos_informe:cotizado'),
      db.query(
        `SELECT v.moneda, SUM(v.monto) AS total FROM proy_ventas v JOIN proy_participaciones p ON p.id = v.participacion_id
         WHERE p.proyecto_id = ? AND p.asesor_id IS NOT NULL AND v.anulada_en IS NULL AND v.estado = 'confirmada' GROUP BY v.moneda ORDER BY v.moneda`, [proyectoId], 'proyectos_informe:vendido')
    ]);
    const pasar = (filas) => filas.map(f => ({ moneda: f.moneda, monto: Number(f.total) }));
    return { cotizado: pasar(cotizado), vendido: pasar(vendido) };
  }

  // Cotizado y vendido por tienda y moneda (para el desglose por tienda).
  async montosPorTienda(proyectoId) {
    const [cotizado, vendido] = await Promise.all([
      db.query(
        `SELECT p.tienda_id, c.moneda, SUM(c.monto) AS total FROM proy_cotizaciones c JOIN proy_participaciones p ON p.id = c.participacion_id
         WHERE p.proyecto_id = ? AND p.asesor_id IS NOT NULL AND c.anulada_en IS NULL GROUP BY p.tienda_id, c.moneda`, [proyectoId], 'proyectos_informe:cotizado_tienda'),
      db.query(
        `SELECT p.tienda_id, v.moneda, SUM(v.monto) AS total FROM proy_ventas v JOIN proy_participaciones p ON p.id = v.participacion_id
         WHERE p.proyecto_id = ? AND p.asesor_id IS NOT NULL AND v.anulada_en IS NULL AND v.estado = 'confirmada' GROUP BY p.tienda_id, v.moneda`, [proyectoId], 'proyectos_informe:vendido_tienda')
    ]);
    return { cotizado, vendido };
  }

  // Gestiones por tipo de canal: presencial (visita) frente a remoto (llamada, WhatsApp, correo).
  async canales(proyectoId) {
    const filas = await db.query(
      `SELECT ca.presencial, COUNT(*) AS n FROM proy_gestiones g JOIN proy_canales ca ON ca.id = g.canal_id JOIN proy_participaciones p ON p.id = g.participacion_id
       WHERE p.proyecto_id = ? AND p.asesor_id IS NOT NULL AND g.anulada_en IS NULL GROUP BY ca.presencial`, [proyectoId], 'proyectos_informe:canales'
    );
    const presencial = Number((filas.find(f => Number(f.presencial) === 1) || {}).n || 0);
    const remoto = Number((filas.find(f => Number(f.presencial) === 0) || {}).n || 0);
    return { presencial, remoto };
  }

  async muestrasPorArea(proyectoId) {
    const filas = await db.query(
      `SELECT COALESCE(a.nombre, 'Sin área') AS area, SUM(e.cantidad) AS n FROM proy_entregas_muestra e JOIN proy_participaciones p ON p.id = e.participacion_id LEFT JOIN proy_areas_contacto a ON a.id = e.area_id
       WHERE p.proyecto_id = ? GROUP BY a.nombre ORDER BY n DESC, area`, [proyectoId], 'proyectos_informe:muestras'
    );
    return filas.map(f => ({ area: f.area, cantidad: Number(f.n) }));
  }

  async primeraGestion(proyectoId) {
    const filas = await db.query('SELECT MIN(g.creado_en) AS primera FROM proy_gestiones g JOIN proy_participaciones p ON p.id = g.participacion_id WHERE p.proyecto_id = ? AND g.anulada_en IS NULL', [proyectoId], 'proyectos_informe:primera_gestion');
    return filas[0].primera || null;
  }

  // Quedan sin gestionar: abiertas y todavía «pendiente».
  async sinGestionar(proyectoId) {
    const filas = await db.query("SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id IS NOT NULL AND abierta = 1 AND estado = 'pendiente'", [proyectoId], 'proyectos_informe:sin_gestionar');
    return Number(filas[0].n);
  }

  // Los datos del proyecto para el encabezado y el visto bueno.
  async proyecto(id) {
    const filas = await db.query(
      `SELECT y.id, y.codigo, y.nombre, y.estado, y.anio, y.mes, y.fecha_inicio, y.fecha_fin, y.activado_en, y.cerrado_en, y.conclusiones, y.resumen_cierre, y.config_snapshot,
              y.existencia_muestras, y.articulo_id, a.nombre AS articulo, n.nombre AS nicho, y.visto_bueno_estado, y.visto_bueno_en, y.visto_bueno_comentario,
              y.cerrado_por AS cerrado_por_id, uc.nombre AS cerrado_por, uv.nombre AS visto_bueno_por, ua.nombre AS activado_por,
              (SELECT COUNT(*) FROM proy_proyecto_tiendas pt WHERE pt.proyecto_id = y.id) AS tiendas,
              (SELECT GROUP_CONCAT(DISTINCT pa.nombre ORDER BY pa.nombre SEPARATOR ', ') FROM proy_proyecto_tiendas pt JOIN tiendas t ON t.id = pt.tienda_id JOIN empresas e ON e.id = t.empresa_id JOIN paises pa ON pa.id = e.pais_id WHERE pt.proyecto_id = y.id) AS paises
       FROM proy_proyectos y JOIN proy_nichos n ON n.id = y.nicho_id LEFT JOIN proy_articulos a ON a.id = y.articulo_id
         LEFT JOIN usuarios uc ON uc.id = y.cerrado_por LEFT JOIN usuarios uv ON uv.id = y.visto_bueno_por LEFT JOIN usuarios ua ON ua.id = y.activado_por
       WHERE y.id = ?`, [id], 'proyectos_informe:proyecto'
    );
    return filas[0] || null;
  }

  historial(proyectoId) {
    return db.query(
      `SELECT h.accion, h.creado_en, u.nombre AS usuario FROM proy_historial h LEFT JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.proyecto_id = ? AND h.accion IN ('activar', 'aprobar', 'cerrar', 'visto_bueno', 'devolver', 'reenviar') ORDER BY h.id DESC`, [proyectoId], 'proyectos_informe:historial'
    );
  }
}

module.exports = new InformeRepository();
