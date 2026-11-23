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
    await t('INSERT INTO tiempos_lineas (version_id, clave, nombre, orden) SELECT ?, clave, nombre, orden FROM tiempos_lineas WHERE version_id = ?', [n, origenId], 'lineas');
    await t('INSERT INTO tiempos_etapas (version_id, clave, nombre, orden) SELECT ?, clave, nombre, orden FROM tiempos_etapas WHERE version_id = ?', [n, origenId], 'etapas');
    await t('INSERT INTO tiempos_productos (version_id, clave, linea_clave, grupo, nombre, orden, activo, permite_moldes, permite_lanyard) SELECT ?, clave, linea_clave, grupo, nombre, orden, activo, permite_moldes, permite_lanyard FROM tiempos_productos WHERE version_id = ?', [n, origenId], 'productos');
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
    await t('INSERT INTO tiempos_extras (version_id, clave, nombre, aviso, orden) SELECT ?, clave, nombre, aviso, orden FROM tiempos_extras WHERE version_id = ?', [n, origenId], 'extras');
    await t(
      `INSERT INTO tiempos_extra_rangos (extra_id, desde, hasta, dias, a_convenir)
       SELECT ne.id, er.desde, er.hasta, er.dias, er.a_convenir FROM tiempos_extra_rangos er
       JOIN tiempos_extras oe ON oe.id = er.extra_id AND oe.version_id = ?
       JOIN tiempos_extras ne ON ne.version_id = ? AND ne.clave = oe.clave`, [origenId, n], 'extra_rangos'
    );
    await t('INSERT INTO tiempos_parametros (version_id, clave, valor, ayuda) SELECT ?, clave, valor, ayuda FROM tiempos_parametros WHERE version_id = ?', [n, origenId], 'parametros');
    await t('INSERT INTO tiempos_avisos (version_id, producto_clave, texto, orden) SELECT ?, producto_clave, texto, orden FROM tiempos_avisos WHERE version_id = ?', [n, origenId], 'avisos');
    return n;
  }

  // Lecturas dentro de la transacción: el borrador recién creado todavía no lo ven otras conexiones.
  etapasDe(tx, versionId) { return tx.query('SELECT clave, nombre FROM tiempos_etapas WHERE version_id = ? ORDER BY orden', [versionId], 'tiempos:etapas_de'); }
  lineasDe(tx, versionId) { return tx.query('SELECT clave, nombre FROM tiempos_lineas WHERE version_id = ? ORDER BY orden', [versionId], 'tiempos:lineas_de'); }

  async productoDe(tx, versionId, clave) {
    const f = await tx.query('SELECT id, clave, linea_clave AS linea, grupo, nombre, orden, activo FROM tiempos_productos WHERE version_id = ? AND clave = ?', [versionId, clave], 'tiempos:producto_de');
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
      await tx.query('UPDATE tiempos_productos SET nombre = ?, grupo = ?, activo = ?, permite_moldes = ?, permite_lanyard = ? WHERE id = ?', [p.nombre, p.grupo, p.activo ? 1 : 0, p.permiteMoldes ? 1 : 0, p.permiteLanyard ? 1 : 0, id], 'tiempos:actualizar_producto');
      await tx.query('DELETE FROM tiempos_rangos WHERE producto_id = ?', [id], 'tiempos:borrar_rangos');
    } else {
      const r = await tx.query('INSERT INTO tiempos_productos (version_id, clave, linea_clave, grupo, nombre, orden, activo, permite_moldes, permite_lanyard) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)', [versionId, p.clave, p.linea, p.grupo, p.nombre, p.orden, p.permiteMoldes ? 1 : 0, p.permiteLanyard ? 1 : 0], 'tiempos:crear_producto');
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

  // Extras (tipos de UV con sus rangos) y reglas generales. Los extras existentes se actualizan; los que no vienen se quitan.
  async guardarExtras(tx, versionId, extras, parametros) {
    const actuales = await tx.query('SELECT id, clave FROM tiempos_extras WHERE version_id = ?', [versionId], 'tiempos:extras_actuales');
    for (const e of actuales) if (!extras.some(x => x.clave === e.clave)) await tx.query('DELETE FROM tiempos_extras WHERE id = ?', [e.id], 'tiempos:borrar_extra');
    for (const [i, e] of extras.entries()) {
      const previo = actuales.find(a => a.clave === e.clave);
      let id;
      if (previo) { id = previo.id; await tx.query('UPDATE tiempos_extras SET nombre = ?, aviso = ?, orden = ? WHERE id = ?', [e.nombre, e.aviso, i + 1, id], 'tiempos:actualizar_extra'); await tx.query('DELETE FROM tiempos_extra_rangos WHERE extra_id = ?', [id], 'tiempos:borrar_extra_rangos'); }
      else { const r = await tx.query('INSERT INTO tiempos_extras (version_id, clave, nombre, aviso, orden) VALUES (?, ?, ?, ?, ?)', [versionId, e.clave, e.nombre, e.aviso, i + 1], 'tiempos:crear_extra'); id = r.insertId; }
      for (const r of e.rangos) await tx.query('INSERT INTO tiempos_extra_rangos (extra_id, desde, hasta, dias, a_convenir) VALUES (?, ?, ?, ?, ?)', [id, r.desde, r.hasta, r.aConvenir ? null : r.dias, r.aConvenir ? 1 : 0], 'tiempos:crear_extra_rango');
    }
    for (const [clave, valor] of Object.entries(parametros)) await tx.query('UPDATE tiempos_parametros SET valor = ? WHERE version_id = ? AND clave = ?', [valor, versionId, clave], 'tiempos:actualizar_parametro');
  }

  async guardarAvisosGenerales(tx, versionId, textos) {
    await tx.query('DELETE FROM tiempos_avisos WHERE version_id = ? AND producto_clave IS NULL', [versionId], 'tiempos:borrar_avisos_generales');
    for (const [i, texto] of textos.entries()) await tx.query('INSERT INTO tiempos_avisos (version_id, producto_clave, texto, orden) VALUES (?, NULL, ?, ?)', [versionId, texto, i + 1], 'tiempos:crear_aviso_general');
  }

  // Etapas y líneas: se renombran, se agregan y se reordenan; nunca se borran las que están en uso (lo valida el servicio).
  async guardarCatalogo(tx, tabla, versionId, filas) {
    const t = tabla === 'lineas' ? 'tiempos_lineas' : 'tiempos_etapas';
    const actuales = await tx.query(`SELECT clave FROM ${t} WHERE version_id = ?`, [versionId], 'tiempos:catalogo_actual');
    for (const [i, f] of filas.entries()) {
      if (actuales.some(a => a.clave === f.clave)) await tx.query(`UPDATE ${t} SET nombre = ?, orden = ? WHERE version_id = ? AND clave = ?`, [f.nombre, i + 1, versionId, f.clave], 'tiempos:actualizar_catalogo');
      else await tx.query(`INSERT INTO ${t} (version_id, clave, nombre, orden) VALUES (?, ?, ?, ?)`, [versionId, f.clave, f.nombre, i + 1], 'tiempos:crear_catalogo');
    }
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
