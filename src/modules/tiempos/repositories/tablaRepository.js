// src/modules/tiempos/repositories/tablaRepository.js
// SQL de la Tabla de tiempos: arma la `tabla` (la forma que usa el motor) a partir de una versión de la base.
// Se puede leer con una transacción (`con = tx`) para ver un borrador que todavía no se confirma.
const db = require('../../../config/database');

class TablaRepository {
  async versionPublicada() {
    const filas = await db.query(
      "SELECT id, numero, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, nota, estado FROM tiempos_versiones WHERE estado = 'publicada' ORDER BY id DESC LIMIT 1",
      [], 'tiempos:version_publicada'
    );
    return filas[0] || null;
  }

  async cargarTabla(version, con = db) {
    const v = version.id;
    const q = (sql, tag) => con.query(sql, [v], `tiempos:${tag}`);
    const [lineas, categorias, etapas, productos, rangos, dias, extras, opciones, extraRangos, alcance, parametros, avisos] = await Promise.all([
      q('SELECT clave, nombre, orden, activo FROM tiempos_lineas WHERE version_id = ? ORDER BY orden', 'lineas'),
      q('SELECT clave, linea_clave, nombre, orden, activo FROM tiempos_categorias WHERE version_id = ? ORDER BY orden', 'categorias'),
      q('SELECT clave, nombre, orden, activo FROM tiempos_etapas WHERE version_id = ? ORDER BY orden', 'etapas'),
      q('SELECT id, clave, linea_clave, categoria_clave, nombre, orden, activo FROM tiempos_productos WHERE version_id = ? ORDER BY orden', 'productos'),
      q(`SELECT r.id, r.producto_id, r.desde, r.hasta, r.a_convenir FROM tiempos_rangos r
         JOIN tiempos_productos p ON p.id = r.producto_id WHERE p.version_id = ? ORDER BY r.producto_id, r.desde`, 'rangos'),
      q(`SELECT re.rango_id, re.etapa_clave, re.dias FROM tiempos_rango_etapas re
         JOIN tiempos_rangos r ON r.id = re.rango_id JOIN tiempos_productos p ON p.id = r.producto_id WHERE p.version_id = ?`, 'dias'),
      q(`SELECT id, clave, tipo, nombre, etiqueta, ayuda, aviso, dias_fijos, unidades_incluidas, unidades_cada, unidades_dias, unidades_max, todos, activo, orden
         FROM tiempos_extras WHERE version_id = ? ORDER BY orden`, 'extras'),
      q(`SELECT o.id, o.extra_id, o.clave, o.nombre, o.aviso FROM tiempos_extra_opciones o
         JOIN tiempos_extras e ON e.id = o.extra_id WHERE e.version_id = ? ORDER BY o.extra_id, o.orden`, 'extra_opciones'),
      q(`SELECT er.opcion_id, er.desde, er.hasta, er.dias, er.a_convenir FROM tiempos_extra_rangos er
         JOIN tiempos_extra_opciones o ON o.id = er.opcion_id JOIN tiempos_extras e ON e.id = o.extra_id WHERE e.version_id = ? ORDER BY er.opcion_id, er.desde`, 'extra_rangos'),
      q(`SELECT a.extra_id, a.tipo, a.clave FROM tiempos_extra_alcance a
         JOIN tiempos_extras e ON e.id = a.extra_id WHERE e.version_id = ?`, 'extra_alcance'),
      q('SELECT clave, valor, texto, ayuda FROM tiempos_parametros WHERE version_id = ?', 'parametros'),
      q('SELECT producto_clave, texto FROM tiempos_avisos WHERE version_id = ? ORDER BY orden, id', 'avisos')
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
    const categoriaDe = new Map(categorias.map(c => [c.clave, c]));
    const ordenLinea = new Map(lineas.map((l, i) => [l.clave, i]));
    const ordenCategoria = new Map(categorias.map((c, i) => [c.clave, i]));
    const posCategoria = (clave) => (ordenCategoria.has(clave) ? ordenCategoria.get(clave) : 9999);

    const tabla = {
      version: { id: version.id, numero: version.numero, fecha: version.fecha, nota: version.nota },
      lineas: lineas.map(l => ({ clave: l.clave, nombre: l.nombre, activo: Boolean(l.activo) })),
      categoriasLista: categorias.map(c => ({ clave: c.clave, linea: c.linea_clave, nombre: c.nombre, activo: Boolean(c.activo) })),
      etapasLista: etapas.map(e => ({ clave: e.clave, nombre: e.nombre, activo: Boolean(e.activo) })),
      etapas: Object.fromEntries(etapas.map(e => [e.clave, { clave: e.clave, nombre: e.nombre }])),
      productos: {},
      extras: [],
      parametros: Object.fromEntries(parametros.map(p => [p.clave, p.texto !== null ? p.texto : p.valor])),
      avisosGenerales: avisos.filter(a => a.producto_clave === null).map(a => a.texto)
    };
    // Productos en el orden en que se ven: línea, categoría (sin categoría al final) y su propio orden.
    const ordenados = [...productos].sort((a, b) => ((ordenLinea.get(a.linea_clave) ?? 99) - (ordenLinea.get(b.linea_clave) ?? 99))
      || (posCategoria(a.categoria_clave) - posCategoria(b.categoria_clave)) || (a.orden - b.orden));
    for (const p of ordenados) {
      const rangosDelProducto = rangosPorProducto.get(p.id) || [];
      const usadas = new Set();
      for (const r of rangosDelProducto) Object.keys(r.dias).forEach(e => usadas.add(e));
      const cat = p.categoria_clave ? categoriaDe.get(p.categoria_clave) : null;
      tabla.productos[p.clave] = {
        clave: p.clave, nombre: p.nombre, linea: p.linea_clave, categoria: cat ? cat.clave : null, grupo: cat ? cat.nombre : null, activo: Boolean(p.activo),
        etapas: etapas.map(e => e.clave).filter(e => usadas.has(e)), rangos: rangosDelProducto, avisos: avisosDe(p.clave)
      };
    }
    for (const e of extras) {
      const propias = alcance.filter(a => a.extra_id === e.id);
      tabla.extras.push({
        clave: e.clave, tipo: e.tipo, nombre: e.nombre, etiqueta: e.etiqueta, ayuda: e.ayuda, aviso: e.aviso, activo: Boolean(e.activo),
        diasFijos: e.tipo === 'si_no' ? e.dias_fijos : null,
        unidades: e.tipo === 'por_unidades' ? { incluidas: e.unidades_incluidas, cada: e.unidades_cada, dias: e.unidades_dias, max: e.unidades_max } : null,
        opciones: opciones.filter(o => o.extra_id === e.id).map(o => ({
          clave: o.clave, nombre: o.nombre, aviso: o.aviso,
          rangos: extraRangos.filter(r => r.opcion_id === o.id).map(r => ({ desde: r.desde, hasta: r.hasta, aConvenir: Boolean(r.a_convenir), dias: r.dias }))
        })),
        alcance: {
          todos: Boolean(e.todos),
          lineas: propias.filter(a => a.tipo === 'linea').map(a => a.clave),
          categorias: propias.filter(a => a.tipo === 'categoria').map(a => a.clave),
          productos: propias.filter(a => a.tipo === 'producto').map(a => a.clave)
        }
      });
    }
    return tabla;
  }

  // Feriados de Guatemala (los que ya usa el portal para el calendario laboral): [{ fecha, nombre, seRepite }].
  async feriadosGuatemala() {
    return db.query(
      `SELECT DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha, f.nombre, f.se_repite_cada_anio AS seRepite FROM feriados f
       JOIN paises p ON p.id = f.pais_id AND p.nombre = 'Guatemala'`, [], 'tiempos:feriados'
    );
  }
}

module.exports = new TablaRepository();
