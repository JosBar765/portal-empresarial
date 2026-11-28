// src/modules/tiempos/services/cargaInicialService.js
// Carga inicial de la Tabla de tiempos (Ver. 5.0) la primera vez que arranca el servidor con el módulo ya migrado: si no hay
// ninguna versión, se crea la 5.0 ya publicada desde `datos/tablaV5.js`. Si ya existe alguna versión, no hace nada.
const db = require('../../../config/database');
const datos = require('../datos/tablaV5');
const borradorRepository = require('../repositories/borradorRepository');
const { tablaDesdeDatos } = require('../calculo/tablaDesdeDatos');

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
      const tabla = tablaDesdeDatos(datos);
      for (const [i, l] of tabla.lineas.entries()) await tx.query('INSERT INTO tiempos_lineas (version_id, clave, nombre, orden) VALUES (?, ?, ?, ?)', [versionId, l.clave, l.nombre, i + 1], 'tiempos:carga_linea');
      for (const [i, c] of tabla.categoriasLista.entries()) await tx.query('INSERT INTO tiempos_categorias (version_id, clave, linea_clave, nombre, orden) VALUES (?, ?, ?, ?, ?)', [versionId, c.clave, c.linea, c.nombre, i + 1], 'tiempos:carga_categoria');
      for (const [i, e] of tabla.etapasLista.entries()) await tx.query('INSERT INTO tiempos_etapas (version_id, clave, nombre, orden) VALUES (?, ?, ?, ?)', [versionId, e.clave, e.nombre, i + 1], 'tiempos:carga_etapa');
      for (const [i, p] of Object.values(tabla.productos).entries()) {
        const prod = await tx.query(
          'INSERT INTO tiempos_productos (version_id, clave, linea_clave, categoria_clave, nombre, orden) VALUES (?, ?, ?, ?, ?, ?)',
          [versionId, p.clave, p.linea, p.categoria, p.nombre, i + 1], 'tiempos:carga_producto'
        );
        for (const [j, r] of p.rangos.entries()) {
          const ins = await tx.query('INSERT INTO tiempos_rangos (producto_id, desde, hasta, a_convenir, orden) VALUES (?, ?, ?, ?, ?)', [prod.insertId, r.desde, r.hasta, r.aConvenir ? 1 : 0, j + 1], 'tiempos:carga_rango');
          if (!r.aConvenir) for (const etapa of p.etapas) await tx.query('INSERT INTO tiempos_rango_etapas (rango_id, etapa_clave, dias) VALUES (?, ?, ?)', [ins.insertId, etapa, r.dias[etapa]], 'tiempos:carga_dias');
        }
        for (const [j, texto] of p.avisos.entries()) await tx.query('INSERT INTO tiempos_avisos (version_id, producto_clave, texto, orden) VALUES (?, ?, ?, ?)', [versionId, p.clave, texto, j + 1], 'tiempos:carga_aviso_producto');
      }
      await borradorRepository.insertarExtras(tx, versionId, tabla.extras);
      for (const [clave, valor, texto, ayuda] of datos.PARAMETROS) await tx.query('INSERT INTO tiempos_parametros (version_id, clave, valor, texto, ayuda) VALUES (?, ?, ?, ?, ?)', [versionId, clave, valor, texto, ayuda], 'tiempos:carga_parametro');
      for (const [i, texto] of datos.AVISOS_GENERALES.entries()) await tx.query('INSERT INTO tiempos_avisos (version_id, producto_clave, texto, orden) VALUES (?, NULL, ?, ?)', [versionId, texto, i + 1], 'tiempos:carga_aviso');
      await tx.query("INSERT INTO tiempos_historial (usuario_id, version_id, entidad, clave, accion, despues) VALUES (NULL, ?, 'version', ?, 'carga_inicial', ?)", [versionId, datos.VERSION.numero, JSON.stringify({ productos: datos.PRODUCTOS.length })], 'tiempos:carga_historial');
    });
    console.log(`[Tiempos] Carga inicial: tabla de tiempos v${datos.VERSION.numero} (${datos.PRODUCTOS.length} productos).`);
    return true;
  }
}

module.exports = new CargaInicialService();
