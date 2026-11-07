// src/modules/proyectos/repositories/configRepository.js
// Parámetros del módulo (parametros_sistema), configuración por país e historial de cambios.
const db = require('../../../config/database');
const { PREFIJO } = require('../parametros');

const COLUMNAS_PAIS = `p.id AS pais_id, p.codigo, p.nombre, c.moneda_codigo, c.prefijo_telefono, c.formato_telefono,
  c.referencia_obligatoria, c.confirmacion_ventas`;

class ConfigRepository {
  listarParametros() {
    return db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', [`${PREFIJO}%`], 'proyectos_config:parametros');
  }

  guardarParametro(tx, clave, valor) {
    return tx.query(
      'INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
      [clave, valor], 'proyectos_config:guardar_parametro'
    );
  }

  borrarParametro(tx, clave) {
    return tx.query('DELETE FROM parametros_sistema WHERE clave = ?', [clave], 'proyectos_config:borrar_parametro');
  }

  registrarHistorial(tx, { usuarioId, entidad, clave, accion, antes, despues }) {
    return tx.query(
      'INSERT INTO proy_config_historial (usuario_id, entidad, clave, accion, antes, despues) VALUES (?, ?, ?, ?, ?, ?)',
      [usuarioId, entidad, clave, accion, antes === null ? null : JSON.stringify(antes), despues === null ? null : JSON.stringify(despues)],
      'proyectos_config:historial'
    );
  }

  // Condiciones fijas según el área; nada del texto de la petición entra en el SQL.
  filtrosHistorial({ area, usuarioId, desde, hasta }) {
    const condiciones = [];
    const params = [];
    if (area === 'parametros') condiciones.push("h.entidad = 'parametro' AND h.clave NOT LIKE 'reglas.%'");
    else if (area === 'reglas') condiciones.push("h.entidad = 'parametro' AND h.clave LIKE 'reglas.%'");
    else if (area === 'catalogos') condiciones.push("h.entidad LIKE 'catalogo:%'");
    else if (area === 'paises') condiciones.push("h.entidad = 'pais'");
    if (usuarioId) { condiciones.push('h.usuario_id = ?'); params.push(usuarioId); }
    if (desde) { condiciones.push('DATE(h.creado_en) >= ?'); params.push(desde); }
    if (hasta) { condiciones.push('DATE(h.creado_en) <= ?'); params.push(hasta); }
    return { donde: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', params };
  }

  listarHistorial(filtros, limite, desplazamiento) {
    const { donde, params } = this.filtrosHistorial(filtros);
    return db.query(
      `SELECT h.id, h.creado_en, h.usuario_id, u.nombre AS usuario, h.entidad, h.clave, h.accion, h.antes, h.despues
       FROM proy_config_historial h JOIN usuarios u ON u.id = h.usuario_id ${donde} ORDER BY h.id DESC LIMIT ? OFFSET ?`,
      [...params, limite, desplazamiento], 'proyectos_config:historial_listar'
    );
  }

  async contarHistorial(filtros) {
    const { donde, params } = this.filtrosHistorial(filtros);
    const filas = await db.query(`SELECT COUNT(*) AS n FROM proy_config_historial h ${donde}`, params, 'proyectos_config:historial_contar');
    return Number(filas[0].n);
  }

  async obtenerHistorial(id) {
    const filas = await db.query(
      `SELECT h.id, h.creado_en, h.usuario_id, u.nombre AS usuario, h.entidad, h.clave, h.accion, h.antes, h.despues
       FROM proy_config_historial h JOIN usuarios u ON u.id = h.usuario_id WHERE h.id = ?`, [id], 'proyectos_config:historial_obtener'
    );
    return filas[0] || null;
  }

  listarPersonasConCambios() {
    return db.query(
      `SELECT DISTINCT u.id, u.nombre FROM proy_config_historial h JOIN usuarios u ON u.id = h.usuario_id ORDER BY u.nombre`,
      [], 'proyectos_config:historial_personas'
    );
  }

  listarPaises() {
    return db.query(
      `SELECT ${COLUMNAS_PAIS} FROM paises p LEFT JOIN proy_pais_config c ON c.pais_id = p.id ORDER BY p.nombre`,
      [], 'proyectos_config:paises'
    );
  }

  async obtenerPais(paisId) {
    const filas = await db.query(
      `SELECT ${COLUMNAS_PAIS} FROM paises p LEFT JOIN proy_pais_config c ON c.pais_id = p.id WHERE p.id = ?`,
      [paisId], 'proyectos_config:pais'
    );
    return filas[0] || null;
  }

  async monedaActiva(codigo) {
    const filas = await db.query('SELECT codigo FROM proy_monedas WHERE codigo = ? AND activa = 1', [codigo], 'proyectos_config:moneda');
    return filas.length > 0;
  }

  guardarPais(tx, paisId, datos) {
    return tx.query(
      `INSERT INTO proy_pais_config (pais_id, moneda_codigo, prefijo_telefono, formato_telefono, referencia_obligatoria, confirmacion_ventas)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE moneda_codigo = VALUES(moneda_codigo), prefijo_telefono = VALUES(prefijo_telefono),
         formato_telefono = VALUES(formato_telefono), referencia_obligatoria = VALUES(referencia_obligatoria),
         confirmacion_ventas = VALUES(confirmacion_ventas)`,
      [paisId, datos.monedaCodigo, datos.prefijoTelefono, datos.formatoTelefono, datos.referenciaObligatoria ? 1 : 0,
        datos.confirmacionVentas === null ? null : (datos.confirmacionVentas ? 1 : 0)],
      'proyectos_config:guardar_pais'
    );
  }
}

module.exports = new ConfigRepository();
