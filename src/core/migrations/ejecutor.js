// src/core/migrations/ejecutor.js
// Aplica los scripts de database/migrations/ que aún no constan en schema_migrations.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const CARPETA_POR_DEFECTO = path.join(__dirname, '..', '..', '..', 'database', 'migrations');
const NOMBRE_LOCK = 'portal_migraciones';
const SEGUNDOS_ESPERA_LOCK = 60;

const SQL_TABLA_CONTROL = `
  CREATE TABLE IF NOT EXISTS \`schema_migrations\` (
    \`nombre\`      VARCHAR(255) NOT NULL PRIMARY KEY,
    \`checksum\`    CHAR(64) NOT NULL,
    \`aplicada_en\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`duracion_ms\` INT DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

// --- Funciones puras (sin base de datos) ---

// Quita el BOM y unifica saltos de línea: el checksum no depende de CRLF/LF.
function normalizar(contenido) {
  return contenido.replace(/^﻿/, '').replace(/\r\n/g, '\n');
}

function calcularChecksum(contenido) {
  return crypto.createHash('sha256').update(normalizar(contenido), 'utf8').digest('hex');
}

function listarScripts(carpeta) {
  if (!fs.existsSync(carpeta)) return [];
  return fs.readdirSync(carpeta).filter(f => f.endsWith('.sql')).sort();
}

// `registradas`: Map nombre -> checksum guardado. Devuelve los nombres de cada grupo.
function clasificar(scripts, registradas) {
  const pendientes = [];
  const omitidas = [];
  const modificadas = [];
  for (const { nombre, checksum } of scripts) {
    if (!registradas.has(nombre)) pendientes.push(nombre);
    else if (registradas.get(nombre) !== checksum) modificadas.push(nombre);
    else omitidas.push(nombre);
  }
  return { pendientes, omitidas, modificadas };
}

function leerScripts(carpeta) {
  return listarScripts(carpeta).map(nombre => {
    const sql = normalizar(fs.readFileSync(path.join(carpeta, nombre), 'utf8'));
    return { nombre, sql, checksum: calcularChecksum(sql) };
  });
}

// --- Base de datos ---

const descripcionError = e => `[${e.code || 'sin código'}] ${e.sqlMessage || e.message}`;

// Conexión propia (el pool de la app no se toca), con la misma zona horaria que el pool.
async function abrir(conexion) {
  const db = await mysql.createConnection({
    host: conexion.host,
    port: conexion.port,
    user: conexion.user,
    password: conexion.password,
    database: conexion.database,
    multipleStatements: true,
    dateStrings: true
  });
  await db.query("SET time_zone = '-06:00'");
  return db;
}

async function leerRegistradas(db) {
  const [existe] = await db.query(
    "SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'schema_migrations'"
  );
  if (!existe.length) return new Map();
  const [filas] = await db.query('SELECT nombre, checksum FROM schema_migrations');
  return new Map(filas.map(f => [f.nombre, f.checksum]));
}

// Solo lectura: no crea la tabla de control ni toma el lock.
async function estado({ conexion, carpeta = CARPETA_POR_DEFECTO }) {
  const db = await abrir(conexion);
  try {
    const registradas = await leerRegistradas(db);
    const { pendientes, omitidas, modificadas } = clasificar(leerScripts(carpeta), registradas);
    return { aplicadas: [...omitidas, ...modificadas].sort(), pendientes, modificadas };
  } finally {
    await db.end();
  }
}

async function ejecutar({ conexion, carpeta = CARPETA_POR_DEFECTO, log = console.log }) {
  const scripts = leerScripts(carpeta);
  const db = await abrir(conexion);
  let tieneLock = false;
  try {
    const [[lock]] = await db.query('SELECT GET_LOCK(?, ?) AS obtenido', [NOMBRE_LOCK, SEGUNDOS_ESPERA_LOCK]);
    if (lock.obtenido !== 1) {
      throw new Error(`No se pudo obtener el bloqueo de migraciones tras ${SEGUNDOS_ESPERA_LOCK} s: otra instancia está migrando.`);
    }
    tieneLock = true;

    await db.query(SQL_TABLA_CONTROL);
    // Se lee con el lock tomado: si otra instancia migró mientras esperábamos, ya consta aquí.
    const registradas = await leerRegistradas(db);
    const { pendientes, omitidas, modificadas } = clasificar(scripts, registradas);

    const advertencias = modificadas.map(nombre =>
      `${nombre} ya estaba aplicada y su contenido cambió; no se vuelve a ejecutar (una migración aplicada no se edita).`
    );
    advertencias.forEach(a => log(`[Migraciones] AVISO ${a}`));

    const aplicadas = [];
    for (const { nombre, sql, checksum } of scripts) {
      if (!pendientes.includes(nombre)) continue;
      const inicio = Date.now();
      try {
        await db.query('SET NAMES utf8mb4');
        await db.query(sql);
      } catch (error) {
        throw new Error(`Falló la migración ${nombre}: ${descripcionError(error)}`);
      }
      const duracion = Date.now() - inicio;
      // Se registra solo si el script terminó entero; uno a medias se repite (son idempotentes).
      await db.query('INSERT INTO schema_migrations (nombre, checksum, duracion_ms) VALUES (?, ?, ?)', [nombre, checksum, duracion]);
      aplicadas.push(nombre);
      log(`[Migraciones] Aplicada ${nombre} (${duracion} ms)`);
    }

    log(`[Migraciones] ${aplicadas.length} aplicada(s), ${omitidas.length + modificadas.length} ya registrada(s).`);
    return { aplicadas, omitidas: [...omitidas, ...modificadas], advertencias };
  } finally {
    try {
      if (tieneLock) await db.query('SELECT RELEASE_LOCK(?)', [NOMBRE_LOCK]);
    } catch { /* la conexión se cierra enseguida y MySQL libera el lock */ }
    await db.end();
  }
}

module.exports = { ejecutar, estado, normalizar, calcularChecksum, listarScripts, clasificar, CARPETA_POR_DEFECTO };
