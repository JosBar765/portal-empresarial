// Marca de entorno en la base (parametros_sistema.entorno = 'staging'): lectura, escritura y reglas cruzadas.
// Las funciones reciben `consultar(sql, params)` -> filas, para probarlas sin base.
const { CLAVE, VALOR_STAGING, leerMarcaDeBase } = require('../../../src/core/entorno/verificarMarca');

const DESCRIPCION = 'Marca de entorno: solo una base con esta marca puede ser destino del refresco de staging';

const consultaDe = conn => async (sql, params = []) => (await conn.query(sql, params))[0];

const leerMarca = consultar => leerMarcaDeBase(consultar);

async function tablaExiste(consultar, db) {
  const filas = await consultar(
    "SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'parametros_sistema'",
    [db]
  );
  return Number(filas[0].n) > 0;
}

async function escribirMarca(consultar) {
  await consultar(
    'INSERT INTO parametros_sistema (clave, valor, descripcion) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
    [CLAVE, VALOR_STAGING, DESCRIPCION]
  );
}

async function resumenBase(consultar, db) {
  const [r] = await consultar(
    "SELECT COUNT(*) AS tablas, COALESCE(SUM(TABLE_ROWS), 0) AS filas, COALESCE(SUM(DATA_LENGTH + INDEX_LENGTH), 0) AS bytes FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
    [db]
  );
  return { tablas: Number(r.tablas), filas: Number(r.filas), bytes: Number(r.bytes) };
}

const textoResumen = r => `${r.tablas} tabla(s), ~${r.filas} fila(s), ~${(r.bytes / 1048576).toFixed(1)} MB`;

// Reglas cruzadas. Cada marca es la leída (string o null). Lanza si el refresco no debe continuar.
function exigirMarcas({ marcaDestino, marcaOrigen, soloLimpieza }) {
  if (marcaDestino !== VALOR_STAGING) {
    const hallado = marcaDestino === null ? 'no tiene la marca de entorno' : `tiene la marca «${marcaDestino}», no «${VALOR_STAGING}»`;
    throw new Error(`El DESTINO ${hallado}. Si de verdad es la base de staging, márcala una vez con «npm run staging:marcar». No se tocó nada.`);
  }
  if (!soloLimpieza && marcaOrigen === VALOR_STAGING) {
    throw new Error('El ORIGEN lleva la marca entorno = staging: es un staging, no producción. ORIGEN y DESTINO parecen intercambiados. No se tocó nada.');
  }
}

module.exports = { consultaDe, leerMarca, tablaExiste, escribirMarca, resumenBase, textoResumen, exigirMarcas };
