// src/modules/proyectos/repositories/gerenciaRepository.js
// Consultas del panel gerencial: agregados de todos los proyectos del año (solo lectura). Todo el SQL vive aquí.
// `paisId` (opcional) limita a las participaciones de tiendas de ese país. Lo anulado y lo «por confirmar» no cuenta.
const db = require('../../../config/database');

const PAIS = (paisId) => (paisId ? ' AND e.pais_id = ?' : '');
const DESDE_PART = `FROM proy_participaciones p JOIN proy_proyectos y ON y.id = p.proyecto_id JOIN tiendas t ON t.id = p.tienda_id JOIN empresas e ON e.id = t.empresa_id`;
const INTERESADA = "p.estado IN ('interesada', 'cotizada', 'vendida')";

class GerenciaRepository {
  async vendidoPorMoneda(anio, paisId) {
    const filas = await db.query(
      `SELECT v.moneda, SUM(v.monto) AS total FROM proy_ventas v JOIN proy_participaciones p ON p.id = v.participacion_id JOIN proy_proyectos y ON y.id = p.proyecto_id
         JOIN tiendas t ON t.id = p.tienda_id JOIN empresas e ON e.id = t.empresa_id
       WHERE y.anio = ? AND y.estado IN ('activo', 'cerrado') AND v.anulada_en IS NULL AND v.estado = 'confirmada'${PAIS(paisId)} GROUP BY v.moneda ORDER BY total DESC`,
      paisId ? [anio, paisId] : [anio], 'proyectos_gerencia:vendido'
    );
    return filas.map(f => ({ moneda: f.moneda, monto: Number(f.total) }));
  }

  async efectividadTotal(anio, paisId) {
    const filas = await db.query(
      `SELECT COUNT(*) AS asignadas, SUM(${INTERESADA}) AS interesadas ${DESDE_PART} WHERE y.anio = ? AND y.estado IN ('activo', 'cerrado') AND p.asesor_id IS NOT NULL${PAIS(paisId)}`,
      paisId ? [anio, paisId] : [anio], 'proyectos_gerencia:efectividad'
    );
    return { asignadas: Number(filas[0].asignadas), interesadas: Number(filas[0].interesadas || 0) };
  }

  // Vendido por mes (de un año) en una moneda; los meses sin ventas vuelven en cero.
  async vendidoPorMes(anio, moneda, paisId) {
    const filas = await db.query(
      `SELECT y.mes, SUM(v.monto) AS total FROM proy_ventas v JOIN proy_participaciones p ON p.id = v.participacion_id JOIN proy_proyectos y ON y.id = p.proyecto_id
         JOIN tiendas t ON t.id = p.tienda_id JOIN empresas e ON e.id = t.empresa_id
       WHERE y.anio = ? AND y.estado IN ('activo', 'cerrado') AND v.moneda = ? AND v.anulada_en IS NULL AND v.estado = 'confirmada'${PAIS(paisId)} GROUP BY y.mes`,
      paisId ? [anio, moneda, paisId] : [anio, moneda], 'proyectos_gerencia:por_mes'
    );
    return Array.from({ length: 12 }, (_, i) => Number((filas.find(f => Number(f.mes) === i + 1) || {}).total || 0));
  }

  async efectividadPorPais(anio) {
    const filas = await db.query(
      `SELECT pa.id AS pais_id, pa.nombre AS pais, COUNT(*) AS asignadas, SUM(${INTERESADA}) AS interesadas ${DESDE_PART} JOIN paises pa ON pa.id = e.pais_id
       WHERE y.anio = ? AND y.estado IN ('activo', 'cerrado') AND p.asesor_id IS NOT NULL GROUP BY pa.id, pa.nombre ORDER BY pa.nombre`, [anio], 'proyectos_gerencia:por_pais'
    );
    return filas.map(f => ({ paisId: f.pais_id, pais: f.pais, asignadas: Number(f.asignadas), interesadas: Number(f.interesadas || 0) }));
  }

  // Comparación de nichos: proyectos, cotizado y vendido (por moneda), asignadas e interesadas.
  async nichos(anio, paisId) {
    const [base, cotizado, vendido] = await Promise.all([
      db.query(
        `SELECT n.id, n.nombre, COUNT(DISTINCT y.id) AS proyectos, COUNT(*) AS asignadas, SUM(${INTERESADA}) AS interesadas
         ${DESDE_PART} JOIN proy_nichos n ON n.id = y.nicho_id WHERE y.anio = ? AND y.estado IN ('activo', 'cerrado') AND p.asesor_id IS NOT NULL${PAIS(paisId)} GROUP BY n.id, n.nombre ORDER BY n.nombre`,
        paisId ? [anio, paisId] : [anio], 'proyectos_gerencia:nichos'),
      db.query(
        `SELECT y.nicho_id, c.moneda, SUM(c.monto) AS total FROM proy_cotizaciones c JOIN proy_participaciones p ON p.id = c.participacion_id JOIN proy_proyectos y ON y.id = p.proyecto_id
           JOIN tiendas t ON t.id = p.tienda_id JOIN empresas e ON e.id = t.empresa_id WHERE y.anio = ? AND y.estado IN ('activo', 'cerrado') AND c.anulada_en IS NULL${PAIS(paisId)} GROUP BY y.nicho_id, c.moneda`,
        paisId ? [anio, paisId] : [anio], 'proyectos_gerencia:nichos_cotizado'),
      db.query(
        `SELECT y.nicho_id, v.moneda, SUM(v.monto) AS total FROM proy_ventas v JOIN proy_participaciones p ON p.id = v.participacion_id JOIN proy_proyectos y ON y.id = p.proyecto_id
           JOIN tiendas t ON t.id = p.tienda_id JOIN empresas e ON e.id = t.empresa_id WHERE y.anio = ? AND y.estado IN ('activo', 'cerrado') AND v.anulada_en IS NULL AND v.estado = 'confirmada'${PAIS(paisId)} GROUP BY y.nicho_id, v.moneda`,
        paisId ? [anio, paisId] : [anio], 'proyectos_gerencia:nichos_vendido')
    ]);
    const pasar = (filas, id) => filas.filter(f => f.nicho_id === id).map(f => ({ moneda: f.moneda, monto: Number(f.total) })).sort((a, b) => a.moneda.localeCompare(b.moneda));
    return base.map(f => ({ nichoId: f.id, nicho: f.nombre, proyectos: Number(f.proyectos), asignadas: Number(f.asignadas), interesadas: Number(f.interesadas || 0), cotizado: pasar(cotizado, f.id), vendido: pasar(vendido, f.id) }));
  }

  // Cierres que esperan el visto bueno, con sus cifras congeladas.
  cierresPorVistoBueno() {
    return db.query(
      `SELECT y.id, y.nombre, y.anio, y.mes, y.cerrado_en, y.resumen_cierre, u.nombre AS cerrado_por FROM proy_proyectos y LEFT JOIN usuarios u ON u.id = y.cerrado_por
       WHERE y.estado = 'cerrado' AND y.visto_bueno_estado = 'pendiente' ORDER BY y.cerrado_en`, [], 'proyectos_gerencia:cierres_pendientes'
    );
  }

  async activacionesPendientes() {
    const filas = await db.query("SELECT COUNT(*) AS n FROM proy_proyectos WHERE estado = 'pendiente_aprobacion'", [], 'proyectos_gerencia:activaciones');
    return Number(filas[0].n);
  }
}

module.exports = new GerenciaRepository();
