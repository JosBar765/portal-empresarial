// Conexiones del refresco: ORIGEN solo lectura con snapshot, DESTINO en UTC y sin comprobar claves foráneas.
const mysql = require('mysql2/promise');

const TIMEOUT_MS = 10000;

// JSON como texto UTF-8 crudo (mysql2 lo decodifica como binario y rompe los acentos); el resto lo decide mysql2.
function typeCast(field, next) {
  if (field.type !== 'JSON') return next();
  const buf = field.buffer();
  return buf === null ? null : buf.toString('utf8');
}

function conectar(c, extra = {}) {
  return mysql.createConnection({
    host: c.host,
    port: c.port,
    user: c.user,
    password: c.password,
    database: c.db,
    connectTimeout: TIMEOUT_MS,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    charset: 'utf8mb4',
    // MariaDB avisa el tipo JSON en sus metadatos extendidos y mysql2 lo convertiría en objeto, que el INSERT rompe.
    jsonStrings: true,
    typeCast,
    ...extra
  });
}

// Activa solo lectura en la sesión y comprueba que el servidor la aplica (MariaDB antiguo: tx_read_only).
async function activarSoloLectura(conn) {
  await conn.query('SET SESSION TRANSACTION READ ONLY');
  let rows;
  try {
    [rows] = await conn.query('SELECT @@session.transaction_read_only AS v');
  } catch {
    [rows] = await conn.query('SELECT @@session.tx_read_only AS v');
  }
  if (Number(rows[0].v) !== 1) throw new Error('La sesión de ORIGEN no quedó en solo lectura (transaction_read_only <> 1).');
}

// `proteger(conn)` opcional: se aplica antes de la primera sentencia (el respaldo lo usa para su lista blanca).
async function conectarOrigen(c, proteger = null) {
  const conn = await conectar(c);
  if (proteger) proteger(conn);
  await activarSoloLectura(conn);
  await conn.query("SET time_zone = '+00:00'");
  // Hostinger (MariaDB con RocksDB) exige REPEATABLE READ explícito para el snapshot; su sesión puede venir en READ COMMITTED.
  await conn.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  try {
    await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  } catch (error) {
    console.warn(`[Refresco] AVISO: el servidor no acepta START TRANSACTION WITH CONSISTENT SNAPSHOT (${error.message}). Se usa una transacción de solo lectura normal.`);
    await conn.query('START TRANSACTION');
  }
  return conn;
}

async function conectarDestino(c) {
  const conn = await conectar(c);
  await conn.query('SET NAMES utf8mb4');
  await conn.query("SET time_zone = '+00:00'");
  await conn.query("SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO,NO_ENGINE_SUBSTITUTION'");
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query('SET UNIQUE_CHECKS = 0');
  return conn;
}

const ident = nombre => `\`${String(nombre).replace(/`/g, '``')}\``;

async function cerrar(...conexiones) {
  for (const c of conexiones) {
    if (c) await c.end().catch(() => c.destroy());
  }
}

module.exports = { conectar, activarSoloLectura, conectarOrigen, conectarDestino, ident, cerrar };
