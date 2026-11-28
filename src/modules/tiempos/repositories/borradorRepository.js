// src/modules/tiempos/repositories/borradorRepository.js
// SQL de la administración de la Tabla de tiempos: el borrador es una copia completa de la versión publicada que se edita aparte.
const db = require('../../../config/database');

const COLUMNAS_VERSION = "id, numero, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, nota, estado, creada_por AS creadaPor, publicada_por AS publicadaPor, DATE_FORMAT(creada_en, '%Y-%m-%d %H:%i') AS creadaEn, DATE_FORMAT(publicada_en, '%Y-%m-%d %H:%i') AS publicadaEn";

class BorradorRepository {
  async versionBorrador() {
    const filas = await db.query(`SELECT ${COLUMNAS_VERSION} FROM tiempos_versiones WHERE estado = 'borrador' ORDER BY id DESC LIMIT 1`, [], 'tiempos:version_borrador');
    return filas[0] || null;
  }

  async versionPorId(id) {
    const filas = await db.query(`SELECT ${COLUMNAS_VERSION} FROM tiempos_versiones WHERE id = ?`, [id], 'tiempos:version_por_id');
    return filas[0] || null;
  }

  async versiones() {
    return db.query(
      `SELECT v.id, v.numero, DATE_FORMAT(v.fecha, '%Y-%m-%d') AS fecha, v.nota, v.estado, DATE_FORMAT(v.creada_en, '%Y-%m-%d %H:%i') AS creadaEn,
              DATE_FORMAT(v.publicada_en, '%Y-%m-%d %H:%i') AS publicadaEn, u.nombre AS publicadaPorNombre, c.nombre AS creadaPorNombre
       FROM tiempos_versiones v LEFT JOIN usuarios u ON u.id = v.publicada_por LEFT JOIN usuarios c ON c.id = v.creada_por ORDER BY v.id DESC`, [], 'tiempos:versiones'
    );
  }

  async existeNumero(numero) {
    const filas = await db.query('SELECT 1 FROM tiempos_versiones WHERE numero = ? LIMIT 1', [numero], 'tiempos:existe_numero');
    return filas.length > 0;
  }

  // Copia completa de una versión en una nueva (borrador). Devuelve el id nuevo.
  async clonarVersion(tx, origenId, { numero, fecha, nota, usuarioId }) {
    const v = await tx.query("INSERT INTO tiempos_versiones (numero, fecha, nota, estado, creada_por) VALUES (?, ?, ?, 'borrador', ?)", [numero, fecha, nota || null, usuarioId], 'tiempos:clonar_version');
    const n = v.insertId;
    const t = (sql, params, tag) => tx.query(sql, params, `tiempos:clonar_${tag}`);
    await t('INSERT INTO tiempos_lineas (version_id, clave, nombre, orden, activo) SELECT ?, clave, nombre, orden, activo FROM tiempos_lineas WHERE version_id = ?', [n, origenId], 'lineas');
    await t('INSERT INTO tiempos_categorias (version_id, clave, linea_clave, nombre, orden, activo) SELECT ?, clave, linea_clave, nombre, orden, activo FROM tiempos_categorias WHERE version_id = ?', [n, origenId], 'categorias');
    await t('INSERT INTO tiempos_etapas (version_id, clave, nombre, orden, activo) SELECT ?, clave, nombre, orden, activo FROM tiempos_etapas WHERE version_id = ?', [n, origenId], 'etapas');
    await t('INSERT INTO tiempos_productos (version_id, clave, linea_clave, categoria_clave, nombre, orden, activo) SELECT ?, clave, linea_clave, categoria_clave, nombre, orden, activo FROM tiempos_productos WHERE version_id = ?', [n, origenId], 'productos');
    await t(
      `INSERT INTO tiempos_rangos (producto_id, desde, hasta, a_convenir, orden)
       SELECT np.id, r.desde, r.hasta, r.a_convenir, r.orden FROM tiempos_rangos r
       JOIN tiempos_productos op ON op.id = r.producto_id AND op.version_id = ?
       JOIN tiempos_productos np ON np.version_id = ? AND np.clave = op.clave`, [origenId, n], 'rangos'
    );
    await t(
      `INSERT INTO tiempos_rango_etapas (rango_id, etapa_clave, dias)
       SELECT nr.id, re.etapa_clave, re.dias FROM tiempos_rango_etapas re
       JOIN tiempos_rangos orr ON orr.id = re.rango_id
       JOIN tiempos_productos op ON op.id = orr.producto_id AND op.version_id = ?
       JOIN tiempos_productos np ON np.version_id = ? AND np.clave = op.clave
       JOIN tiempos_rangos nr ON nr.producto_id = np.id AND nr.desde = orr.desde`, [origenId, n], 'dias'
    );
    await t(`INSERT INTO tiempos_extras (version_id, clave, tipo, nombre, etiqueta, ayuda, aviso, dias_fijos, unidades_incluidas, unidades_cada, unidades_dias, unidades_max, todos, activo, orden)
       SELECT ?, clave, tipo, nombre, etiqueta, ayuda, aviso, dias_fijos, unidades_incluidas, unidades_cada, unidades_dias, unidades_max, todos, activo, orden FROM tiempos_extras WHERE version_id = ?`, [n, origenId], 'extras');
    await t(
      `INSERT INTO tiempos_extra_opciones (extra_id, clave, nombre, aviso, orden)
       SELECT ne.id, o.clave, o.nombre, o.aviso, o.orden FROM tiempos_extra_opciones o
       JOIN tiempos_extras oe ON oe.id = o.extra_id AND oe.version_id = ?
       JOIN tiempos_extras ne ON ne.version_id = ? AND ne.clave = oe.clave`, [origenId, n], 'extra_opciones'
    );
    await t(
      `INSERT INTO tiempos_extra_rangos (opcion_id, desde, hasta, dias, a_convenir)
       SELECT no.id, er.desde, er.hasta, er.dias, er.a_convenir FROM tiempos_extra_rangos er
       JOIN tiempos_extra_opciones oo ON oo.id = er.opcion_id
       JOIN tiempos_extras oe ON oe.id = oo.extra_id AND oe.version_id = ?
       JOIN tiempos_extras ne ON ne.version_id = ? AND ne.clave = oe.clave
       JOIN tiempos_extra_opciones no ON no.extra_id = ne.id AND no.clave = oo.clave`, [origenId, n], 'extra_rangos'
    );
    await t(
      `INSERT INTO tiempos_extra_alcance (extra_id, tipo, clave)
       SELECT ne.id, a.tipo, a.clave FROM tiempos_extra_alcance a
       JOIN tiempos_extras oe ON oe.id = a.extra_id AND oe.version_id = ?
       JOIN tiempos_extras ne ON ne.version_id = ? AND ne.clave = oe.clave`, [origenId, n], 'extra_alcance'
    );
    await t('INSERT INTO tiempos_parametros (version_id, clave, valor, texto, ayuda) SELECT ?, clave, valor, texto, ayuda FROM tiempos_parametros WHERE version_id = ?', [n, origenId], 'parametros');
    await t('INSERT INTO tiempos_avisos (version_id, producto_clave, texto, orden) SELECT ?, producto_clave, texto, orden FROM tiempos_avisos WHERE version_id = ?', [n, origenId], 'avisos');
    return n;
  }

  // Lecturas dentro de la transacción: el borrador recién creado todavía no lo ven otras conexiones.
  etapasDe(tx, versionId) { return tx.query('SELECT clave, nombre, activo FROM tiempos_etapas WHERE version_id = ? ORDER BY orden', [versionId], 'tiempos:etapas_de'); }
  lineasDe(tx, versionId) { return tx.query('SELECT clave, nombre, activo FROM tiempos_lineas WHERE version_id = ? ORDER BY orden', [versionId], 'tiempos:lineas_de'); }
  categoriasDe(tx, versionId) { return tx.query('SELECT clave, linea_clave AS linea, nombre, activo FROM tiempos_categorias WHERE version_id = ? ORDER BY orden', [versionId], 'tiempos:categorias_de'); }

  async productoDe(tx, versionId, clave) {
    const f = await tx.query('SELECT id, clave, linea_clave AS linea, categoria_clave AS categoria, nombre, orden, activo FROM tiempos_productos WHERE version_id = ? AND clave = ?', [versionId, clave], 'tiempos:producto_de');
    return f[0] || null;
  }

  async nombreRepetido(tx, versionId, nombre, exceptoClave) {
    const f = await tx.query('SELECT 1 FROM tiempos_productos WHERE version_id = ? AND LOWER(nombre) = LOWER(?) AND clave <> ? LIMIT 1', [versionId, nombre, exceptoClave || ''], 'tiempos:nombre_repetido');
    return f.length > 0;
  }

  async claveLibre(tx, versionId, base) {
    let clave = base; let i = 2;
    while ((await tx.query('SELECT 1 FROM tiempos_productos WHERE version_id = ? AND clave = ?', [versionId, clave], 'tiempos:clave_libre')).length) clave = `${base}-${i++}`;
    return clave;
  }

  async siguienteOrden(tx, versionId) {
    const [{ m }] = await tx.query('SELECT COALESCE(MAX(orden), 0) AS m FROM tiempos_productos WHERE version_id = ?', [versionId], 'tiempos:siguiente_orden');
    return Number(m) + 1;
  }

  // Reemplaza por completo el producto (datos, rangos con sus días y avisos). `p.id` null = producto nuevo.
  async guardarProducto(tx, versionId, p) {
    let id = p.id;
    if (id) {
      await tx.query('UPDATE tiempos_productos SET nombre = ?, categoria_clave = ?, activo = ? WHERE id = ?', [p.nombre, p.categoria, p.activo ? 1 : 0, id], 'tiempos:actualizar_producto');
      await tx.query('DELETE FROM tiempos_rangos WHERE producto_id = ?', [id], 'tiempos:borrar_rangos');
    } else {
      const r = await tx.query('INSERT INTO tiempos_productos (version_id, clave, linea_clave, categoria_clave, nombre, orden, activo) VALUES (?, ?, ?, ?, ?, ?, ?)', [versionId, p.clave, p.linea, p.categoria, p.nombre, p.orden, p.activo ? 1 : 0], 'tiempos:crear_producto');
      id = r.insertId;
    }
    for (const [i, r] of p.rangos.entries()) {
      const ins = await tx.query('INSERT INTO tiempos_rangos (producto_id, desde, hasta, a_convenir, orden) VALUES (?, ?, ?, ?, ?)', [id, r.desde, r.hasta, r.aConvenir ? 1 : 0, i + 1], 'tiempos:crear_rango');
      if (!r.aConvenir) for (const e of p.etapas) await tx.query('INSERT INTO tiempos_rango_etapas (rango_id, etapa_clave, dias) VALUES (?, ?, ?)', [ins.insertId, e, r.dias[e]], 'tiempos:crear_dias');
    }
    await tx.query('DELETE FROM tiempos_avisos WHERE version_id = ? AND producto_clave = ?', [versionId, p.clave], 'tiempos:borrar_avisos_producto');
    for (const [i, texto] of p.avisos.entries()) await tx.query('INSERT INTO tiempos_avisos (version_id, producto_clave, texto, orden) VALUES (?, ?, ?, ?)', [versionId, p.clave, texto, i + 1], 'tiempos:crear_aviso_producto');
    return id;
  }

  // Inserta los extras de una versión tal como llegan (en ese orden): datos, opciones con sus rangos y dónde se ofrecen.
  async insertarExtras(tx, versionId, extras) {
    for (const [i, e] of extras.entries()) {
      const u = e.unidades || {};
      const r = await tx.query(
        `INSERT INTO tiempos_extras (version_id, clave, tipo, nombre, etiqueta, ayuda, aviso, dias_fijos, unidades_incluidas, unidades_cada, unidades_dias, unidades_max, todos, activo, orden)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [versionId, e.clave, e.tipo, e.nombre, e.etiqueta, e.ayuda || null, e.aviso || null, e.tipo === 'si_no' ? e.diasFijos : null,
          e.tipo === 'por_unidades' ? u.incluidas : null, e.tipo === 'por_unidades' ? u.cada : null, e.tipo === 'por_unidades' ? u.dias : null, e.tipo === 'por_unidades' ? u.max : null,
          e.alcance.todos ? 1 : 0, e.activo === false ? 0 : 1, i + 1], 'tiempos:crear_extra'
      );
      if (e.tipo === 'por_cantidad') {
        for (const [j, o] of e.opciones.entries()) {
          const ro = await tx.query('INSERT INTO tiempos_extra_opciones (extra_id, clave, nombre, aviso, orden) VALUES (?, ?, ?, ?, ?)', [r.insertId, o.clave, o.nombre, o.aviso || null, j + 1], 'tiempos:crear_extra_opcion');
          for (const x of o.rangos) await tx.query('INSERT INTO tiempos_extra_rangos (opcion_id, desde, hasta, dias, a_convenir) VALUES (?, ?, ?, ?, ?)', [ro.insertId, x.desde, x.hasta, x.aConvenir ? null : x.dias, x.aConvenir ? 1 : 0], 'tiempos:crear_extra_rango');
        }
      }
      if (!e.alcance.todos) {
        for (const [tipo, lista] of [['linea', e.alcance.lineas], ['categoria', e.alcance.categorias], ['producto', e.alcance.productos]]) {
          for (const clave of new Set(lista || [])) await tx.query('INSERT INTO tiempos_extra_alcance (extra_id, tipo, clave) VALUES (?, ?, ?)', [r.insertId, tipo, clave], 'tiempos:crear_extra_alcance');
        }
      }
    }
  }

  // Reemplaza todos los extras del borrador por la lista que llega (los datos de cada uno ya vienen validados).
  async guardarExtras(tx, versionId, extras) {
    await tx.query('DELETE FROM tiempos_extras WHERE version_id = ?', [versionId], 'tiempos:borrar_extras');
    await this.insertarExtras(tx, versionId, extras);
  }

  // Reglas: número o texto según la regla; si no existe en la versión, se crea.
  async guardarReglas(tx, versionId, reglas) {
    for (const [clave, valor] of Object.entries(reglas)) {
      const esTexto = typeof valor === 'string';
      await tx.query('INSERT INTO tiempos_parametros (version_id, clave, valor, texto) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor), texto = VALUES(texto)',
        [versionId, clave, esTexto ? null : valor, esTexto ? valor : null], 'tiempos:guardar_regla');
    }
  }

  extrasClavesPublicadas() {
    return db.query("SELECT DISTINCT e.clave FROM tiempos_extras e JOIN tiempos_versiones v ON v.id = e.version_id WHERE v.estado <> 'borrador'", [], 'tiempos:extras_publicados');
  }

  async guardarAvisosGenerales(tx, versionId, textos) {
    await tx.query('DELETE FROM tiempos_avisos WHERE version_id = ? AND producto_clave IS NULL', [versionId], 'tiempos:borrar_avisos_generales');
    for (const [i, texto] of textos.entries()) await tx.query('INSERT INTO tiempos_avisos (version_id, producto_clave, texto, orden) VALUES (?, NULL, ?, ?)', [versionId, texto, i + 1], 'tiempos:crear_aviso_general');
  }

  // Líneas, categorías y etapas: se renombran, se agregan, se reordenan y se ocultan; nunca se borran.
  async guardarCatalogo(tx, tabla, versionId, filas) {
    const t = { lineas: 'tiempos_lineas', etapas: 'tiempos_etapas', categorias: 'tiempos_categorias' }[tabla];
    const actuales = await tx.query(`SELECT clave FROM ${t} WHERE version_id = ?`, [versionId], 'tiempos:catalogo_actual');
    for (const [i, f] of filas.entries()) {
      const activo = f.activo === false ? 0 : 1;
      if (actuales.some(a => a.clave === f.clave)) await tx.query(`UPDATE ${t} SET nombre = ?, orden = ?, activo = ? WHERE version_id = ? AND clave = ?`, [f.nombre, i + 1, activo, versionId, f.clave], 'tiempos:actualizar_catalogo');
      else if (tabla === 'categorias') await tx.query(`INSERT INTO ${t} (version_id, clave, linea_clave, nombre, orden, activo) VALUES (?, ?, ?, ?, ?, ?)`, [versionId, f.clave, f.linea, f.nombre, i + 1, activo], 'tiempos:crear_catalogo');
      else await tx.query(`INSERT INTO ${t} (version_id, clave, nombre, orden, activo) VALUES (?, ?, ?, ?, ?)`, [versionId, f.clave, f.nombre, i + 1, activo], 'tiempos:crear_catalogo');
    }
  }

  // Cuántos productos VISIBLES usan cada etapa, línea y categoría (lo que está en uso no se puede ocultar).
  async usoVisible(con, versionId) {
    const [etapas, lineas, categorias] = await Promise.all([
      con.query(`SELECT re.etapa_clave AS clave, COUNT(DISTINCT p.id) AS n FROM tiempos_rango_etapas re JOIN tiempos_rangos r ON r.id = re.rango_id
                 JOIN tiempos_productos p ON p.id = r.producto_id WHERE p.version_id = ? AND p.activo = 1 GROUP BY re.etapa_clave`, [versionId], 'tiempos:uso_etapas_visibles'),
      con.query('SELECT linea_clave AS clave, COUNT(*) AS n FROM tiempos_productos WHERE version_id = ? AND activo = 1 GROUP BY linea_clave', [versionId], 'tiempos:uso_lineas_visibles'),
      con.query('SELECT categoria_clave AS clave, COUNT(*) AS n FROM tiempos_productos WHERE version_id = ? AND activo = 1 AND categoria_clave IS NOT NULL GROUP BY categoria_clave', [versionId], 'tiempos:uso_categorias_visibles')
    ]);
    const mapa = (filas) => Object.fromEntries(filas.map(x => [x.clave, Number(x.n)]));
    return { etapas: mapa(etapas), lineas: mapa(lineas), categorias: mapa(categorias) };
  }

  async usoDeEtapas(versionId) {
    return db.query(
      `SELECT re.etapa_clave AS clave, COUNT(DISTINCT p.id) AS productos FROM tiempos_rango_etapas re
       JOIN tiempos_rangos r ON r.id = re.rango_id JOIN tiempos_productos p ON p.id = r.producto_id WHERE p.version_id = ? GROUP BY re.etapa_clave`, [versionId], 'tiempos:uso_etapas'
    );
  }

  async usoDeLineas(versionId) {
    return db.query('SELECT linea_clave AS clave, COUNT(*) AS productos FROM tiempos_productos WHERE version_id = ? GROUP BY linea_clave', [versionId], 'tiempos:uso_lineas');
  }

  async usoDeCategorias(versionId) {
    return db.query('SELECT categoria_clave AS clave, COUNT(*) AS productos FROM tiempos_productos WHERE version_id = ? AND categoria_clave IS NOT NULL GROUP BY categoria_clave', [versionId], 'tiempos:uso_categorias');
  }

  async publicar(tx, borradorId, { numero, fecha, nota, usuarioId }) {
    await tx.query("UPDATE tiempos_versiones SET estado = 'reemplazada' WHERE estado = 'publicada'", [], 'tiempos:reemplazar_publicada');
    await tx.query("UPDATE tiempos_versiones SET estado = 'publicada', numero = ?, fecha = ?, nota = ?, publicada_por = ?, publicada_en = NOW() WHERE id = ?", [numero, fecha, nota || null, usuarioId, borradorId], 'tiempos:publicar');
  }

  async descartar(tx, borradorId) { await tx.query("DELETE FROM tiempos_versiones WHERE id = ? AND estado = 'borrador'", [borradorId], 'tiempos:descartar'); }

  async registrarHistorial(tx, { usuarioId, versionId, entidad, clave, accion, antes, despues }) {
    await tx.query('INSERT INTO tiempos_historial (usuario_id, version_id, entidad, clave, accion, antes, despues) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [usuarioId, versionId, entidad, clave, accion, antes === undefined ? null : JSON.stringify(antes), despues === undefined ? null : JSON.stringify(despues)], 'tiempos:historial');
  }

  async cambiosRecientes(limite = 30) {
    return db.query(
      `SELECT h.id, h.entidad, h.clave, h.accion, h.antes, h.despues, DATE_FORMAT(h.creado_en, '%Y-%m-%d %H:%i') AS cuando, u.nombre AS usuario
       FROM tiempos_historial h LEFT JOIN usuarios u ON u.id = h.usuario_id ORDER BY h.id DESC LIMIT ?`, [limite], 'tiempos:cambios_recientes'
    );
  }
}

module.exports = new BorradorRepository();
