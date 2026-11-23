// src/modules/tiempos/repositories/tablaRepository.js
// SQL de la Tabla de tiempos: arma la `tabla` (la forma que usa el motor) a partir de una versión de la base.
const db = require('../../../config/database');

class TablaRepository {
  async versionPublicada() {
    const filas = await db.query(
      "SELECT id, numero, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, nota, estado FROM tiempos_versiones WHERE estado = 'publicada' ORDER BY id DESC LIMIT 1",
      [], 'tiempos:version_publicada'
    );
    return filas[0] || null;
  }

  async cargarTabla(version) {
    const v = version.id;
    const [lineas, etapas, productos, rangos, dias, extras, extraRangos, parametros, avisos] = await Promise.all([
      db.query('SELECT clave, nombre, orden FROM tiempos_lineas WHERE version_id = ? ORDER BY orden', [v], 'tiempos:lineas'),
      db.query('SELECT clave, nombre, orden FROM tiempos_etapas WHERE version_id = ? ORDER BY orden', [v], 'tiempos:etapas'),
      db.query('SELECT id, clave, linea_clave, grupo, nombre, orden, activo, permite_moldes, permite_lanyard FROM tiempos_productos WHERE version_id = ? ORDER BY orden', [v], 'tiempos:productos'),
      db.query(
        `SELECT r.id, r.producto_id, r.desde, r.hasta, r.a_convenir FROM tiempos_rangos r
         JOIN tiempos_productos p ON p.id = r.producto_id WHERE p.version_id = ? ORDER BY r.producto_id, r.desde`, [v], 'tiempos:rangos'
      ),
      db.query(
        `SELECT re.rango_id, re.etapa_clave, re.dias FROM tiempos_rango_etapas re
         JOIN tiempos_rangos r ON r.id = re.rango_id JOIN tiempos_productos p ON p.id = r.producto_id WHERE p.version_id = ?`, [v], 'tiempos:dias'
      ),
      db.query('SELECT id, clave, nombre, aviso, orden FROM tiempos_extras WHERE version_id = ? ORDER BY orden', [v], 'tiempos:extras'),
      db.query(
        `SELECT er.extra_id, er.desde, er.hasta, er.dias, er.a_convenir FROM tiempos_extra_rangos er
         JOIN tiempos_extras e ON e.id = er.extra_id WHERE e.version_id = ? ORDER BY er.extra_id, er.desde`, [v], 'tiempos:extra_rangos'
      ),
      db.query('SELECT clave, valor, ayuda FROM tiempos_parametros WHERE version_id = ?', [v], 'tiempos:parametros'),
      db.query('SELECT producto_clave, texto FROM tiempos_avisos WHERE version_id = ? ORDER BY orden, id', [v], 'tiempos:avisos')
    ]);

    const diasPorRango = new Map();
    for (const d of dias) {
      if (!diasPorRango.has(d.rango_id)) diasPorRango.set(d.rango_id, {});
      diasPorRango.get(d.rango_id)[d.etapa_clave] = d.dias;
    }
    const rangosPorProducto = new Map();
    for (const r of rangos) {
      if (!rangosPorProducto.has(r.producto_id)) rangosPorProducto.set(r.producto_id, []);
      rangosPorProducto.get(r.producto_id).push({ desde: r.desde, hasta: r.hasta, aConvenir: Boolean(r.a_convenir), dias: diasPorRango.get(r.id) || {} });
    }
    const avisosDe = (clave) => avisos.filter(a => a.producto_clave === clave).map(a => a.texto);
    const etapasPorClave = Object.fromEntries(etapas.map(e => [e.clave, { clave: e.clave, nombre: e.nombre }]));

    const tabla = {
      version: { id: version.id, numero: version.numero, fecha: version.fecha, nota: version.nota },
      lineas: lineas.map(l => ({ clave: l.clave, nombre: l.nombre })),
      etapas: etapasPorClave,
      productos: {},
      extras: {},
      parametros: Object.fromEntries(parametros.map(p => [p.clave, p.valor])),
      avisosGenerales: avisosDe(null).length ? avisos.filter(a => a.producto_clave === null).map(a => a.texto) : []
    };
    for (const p of productos) {
      const rangosDelProducto = rangosPorProducto.get(p.id) || [];
      const etapasDelProducto = [];
      for (const r of rangosDelProducto) Object.keys(r.dias).forEach(e => { if (!etapasDelProducto.includes(e)) etapasDelProducto.push(e); });
      const ordenadas = etapas.map(e => e.clave).filter(e => etapasDelProducto.includes(e));
      tabla.productos[p.clave] = {
        clave: p.clave, nombre: p.nombre, linea: p.linea_clave, grupo: p.grupo, activo: Boolean(p.activo),
        permiteMoldes: Boolean(p.permite_moldes), permiteLanyard: Boolean(p.permite_lanyard),
        etapas: ordenadas, rangos: rangosDelProducto, avisos: avisosDe(p.clave)
      };
    }
    for (const e of extras) {
      tabla.extras[e.clave] = {
        clave: e.clave, nombre: e.nombre, aviso: e.aviso,
        rangos: extraRangos.filter(r => r.extra_id === e.id).map(r => ({ desde: r.desde, hasta: r.hasta, aConvenir: Boolean(r.a_convenir), dias: r.dias }))
      };
    }
    return tabla;
  }

  // Feriados de Guatemala (los que ya usa el portal para el calendario laboral): [{ fecha, seRepite }].
  async feriadosGuatemala() {
    return db.query(
      `SELECT DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha, f.se_repite_cada_anio AS seRepite FROM feriados f
       JOIN paises p ON p.id = f.pais_id AND p.nombre = 'Guatemala'`, [], 'tiempos:feriados'
    );
  }
}

module.exports = new TablaRepository();
