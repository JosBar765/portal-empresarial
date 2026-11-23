// src/modules/tiempos/services/cargaInicialService.js
// Carga inicial de la Tabla de tiempos (Ver. 5.0) la primera vez que arranca el servidor con el módulo ya migrado: si no hay
// ninguna versión, se crea la 5.0 ya publicada desde `datos/tablaV5.js`. Si ya existe alguna versión, no hace nada.
const db = require('../../../config/database');
const datos = require('../datos/tablaV5');

class CargaInicialService {
  async hayVersiones() {
    const [{ n }] = await db.query('SELECT COUNT(*) AS n FROM tiempos_versiones', [], 'tiempos:hay_versiones');
    return Number(n) > 0;
  }

  // Devuelve true si cargó la versión inicial.
  async cargar() {
    if (await this.hayVersiones()) return false;
    await db.transaccion(async (tx) => {
      const v = await tx.query(
        "INSERT INTO tiempos_versiones (numero, fecha, nota, estado, publicada_en) VALUES (?, ?, ?, 'publicada', NOW())",
        [datos.VERSION.numero, datos.VERSION.fecha, datos.VERSION.nota], 'tiempos:carga_version'
      );
      const versionId = v.insertId;
      for (const [i, [clave, nombre]] of datos.LINEAS.entries()) await tx.query('INSERT INTO tiempos_lineas (version_id, clave, nombre, orden) VALUES (?, ?, ?, ?)', [versionId, clave, nombre, i + 1], 'tiempos:carga_linea');
      for (const [i, [clave, nombre]] of datos.ETAPAS.entries()) await tx.query('INSERT INTO tiempos_etapas (version_id, clave, nombre, orden) VALUES (?, ?, ?, ?)', [versionId, clave, nombre, i + 1], 'tiempos:carga_etapa');
      for (const [i, p] of datos.PRODUCTOS.entries()) {
        const prod = await tx.query(
          'INSERT INTO tiempos_productos (version_id, clave, linea_clave, grupo, nombre, orden, permite_moldes, permite_lanyard) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [versionId, p.clave, p.linea, p.grupo, p.nombre, i + 1, p.moldes ? 1 : 0, p.lanyard ? 1 : 0], 'tiempos:carga_producto'
        );
        for (const [j, [desde, hasta, dias]] of p.rangos.entries()) {
          const aConvenir = hasta === null;
          const r = await tx.query('INSERT INTO tiempos_rangos (producto_id, desde, hasta, a_convenir, orden) VALUES (?, ?, ?, ?, ?)', [prod.insertId, desde, hasta, aConvenir ? 1 : 0, j + 1], 'tiempos:carga_rango');
          if (!aConvenir) for (const [k, etapa] of p.etapas.entries()) await tx.query('INSERT INTO tiempos_rango_etapas (rango_id, etapa_clave, dias) VALUES (?, ?, ?)', [r.insertId, etapa, dias[k]], 'tiempos:carga_dias');
        }
        if (p.aviso) await tx.query('INSERT INTO tiempos_avisos (version_id, producto_clave, texto, orden) VALUES (?, ?, ?, ?)', [versionId, p.clave, p.aviso, 1], 'tiempos:carga_aviso_producto');
      }
      for (const [i, u] of datos.UV.entries()) {
        const e = await tx.query('INSERT INTO tiempos_extras (version_id, clave, nombre, aviso, orden) VALUES (?, ?, ?, ?, ?)', [versionId, u.clave, u.nombre, u.aviso || null, i + 1], 'tiempos:carga_extra');
        for (const [desde, hasta, dias] of u.rangos) await tx.query('INSERT INTO tiempos_extra_rangos (extra_id, desde, hasta, dias, a_convenir) VALUES (?, ?, ?, ?, ?)', [e.insertId, desde, hasta, hasta === null ? null : dias, hasta === null ? 1 : 0], 'tiempos:carga_extra_rango');
      }
      for (const [clave, valor, ayuda] of datos.PARAMETROS) await tx.query('INSERT INTO tiempos_parametros (version_id, clave, valor, ayuda) VALUES (?, ?, ?, ?)', [versionId, clave, valor, ayuda], 'tiempos:carga_parametro');
      for (const [i, texto] of datos.AVISOS_GENERALES.entries()) await tx.query('INSERT INTO tiempos_avisos (version_id, producto_clave, texto, orden) VALUES (?, NULL, ?, ?)', [versionId, texto, i + 1], 'tiempos:carga_aviso');
      await tx.query("INSERT INTO tiempos_historial (usuario_id, version_id, entidad, clave, accion, despues) VALUES (NULL, ?, 'version', ?, 'carga_inicial', ?)", [versionId, datos.VERSION.numero, JSON.stringify({ productos: datos.PRODUCTOS.length })], 'tiempos:carga_historial');
    });
    console.log(`[Tiempos] Carga inicial: tabla de tiempos v${datos.VERSION.numero} (${datos.PRODUCTOS.length} productos).`);
    return true;
  }
}

module.exports = new CargaInicialService();
