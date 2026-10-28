// Prueba los scripts SQL en una MySQL desechable: instalación nueva y actualización estilo producción.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const mysql = require('mysql2/promise');
const migrador = require('../../src/core/migrations/ejecutor');

const RAIZ = path.join(__dirname, '..', '..');
const DIR_BD = path.join(RAIZ, 'database');
const BASE = ['schema.sql', 'seed.sql', 'users.sql'];

const conexion = {
  host: process.env.CI_DB_HOST,
  port: Number(process.env.CI_DB_PORT || 3306),
  user: process.env.CI_DB_USER,
  password: process.env.CI_DB_PASSWORD || '',
  database: process.env.CI_DB_NAME,
  multipleStatements: true
};

function descripcionError(error) {
  return `${error.code || 'ERROR'}: ${error.sqlMessage || error.message}`;
}

// Sin permisos de CREATE DATABASE: se vacía la base borrando todas sus tablas y vistas.
async function reiniciarBase(db) {
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  const [objetos] = await db.query(
    'SELECT table_name AS nombre, table_type AS tipo FROM information_schema.tables WHERE table_schema = DATABASE()'
  );
  for (const { nombre, tipo } of objetos) {
    await db.query(`DROP ${tipo === 'VIEW' ? 'VIEW' : 'TABLE'} \`${nombre}\``);
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function ejecutar(db, etiqueta, sql) {
  const inicio = Date.now();
  try {
    await db.query('SET NAMES utf8mb4');
    await db.query(sql);
    console.log(`  OK    ${etiqueta} (${Date.now() - inicio} ms)`);
  } catch (error) {
    console.error(`  FALLO ${etiqueta}\n        ${descripcionError(error)}`);
    throw new Error(`Falló ${etiqueta}`);
  }
}

const leerArbol = archivo => fs.readFileSync(path.join(DIR_BD, archivo), 'utf8');

// El estado de producción es lo que hay en origin/main; si el archivo no existe allí se usa el del PR.
function leerDeMain(archivo) {
  try {
    return execFileSync('git', ['show', `origin/main:database/${archivo}`], {
      cwd: RAIZ, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch {
    console.log(`  AVISO ${archivo} no existe en origin/main: se usa la versión del PR.`);
    return leerArbol(archivo);
  }
}

function listarMigraciones() {
  const dir = path.join(DIR_BD, 'migrations');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
}

// Aplica las migraciones con el ejecutor real, dos veces: la segunda no debe aplicar nada
// y schema_migrations debe tener una fila por script.
async function aplicarConEjecutor(db) {
  const total = listarMigraciones().length;
  for (const vuelta of [1, 2]) {
    const etiqueta = `ejecutor de migraciones (pasada ${vuelta})`;
    let resultado;
    try {
      resultado = await migrador.ejecutar({ conexion, log: () => {} });
    } catch (error) {
      console.error(`  FALLO ${etiqueta}\n        ${error.message}`);
      throw error;
    }
    const esperadas = vuelta === 1 ? total : 0;
    if (resultado.aplicadas.length !== esperadas) {
      console.error(`  FALLO ${etiqueta}\n        aplicó ${resultado.aplicadas.length} script(s) y se esperaban ${esperadas}`);
      throw new Error(`Falló ${etiqueta}`);
    }
    console.log(`  OK    ${etiqueta}: ${resultado.aplicadas.length} aplicada(s)`);
  }
  const [[{ filas }]] = await db.query('SELECT COUNT(*) AS filas FROM schema_migrations');
  if (filas !== total) {
    console.error(`  FALLO schema_migrations tiene ${filas} fila(s) y hay ${total} script(s)`);
    throw new Error('Falló schema_migrations');
  }
  console.log(`  OK    schema_migrations: ${filas} fila(s), una por script`);
}

// El ejecutor no repite lo registrado: cada script se vuelve a correr a mano para comprobar que es idempotente.
async function reejecutarDirecto(db) {
  for (const archivo of listarMigraciones()) {
    await ejecutar(db, `migrations/${archivo} (re-ejecución directa)`, leerArbol(path.join('migrations', archivo)));
  }
}

async function escenarioA(db) {
  console.log('Escenario A: instalación nueva (archivos del PR + ejecutor de migraciones)');
  await reiniciarBase(db);
  for (const archivo of BASE) await ejecutar(db, archivo, leerArbol(archivo));
  await aplicarConEjecutor(db);
  await reejecutarDirecto(db);
}

async function escenarioB(db) {
  console.log('Escenario B: actualización estilo producción (base de origin/main + ejecutor de migraciones del PR)');
  await reiniciarBase(db);
  for (const archivo of BASE) await ejecutar(db, `${archivo} (origin/main)`, leerDeMain(archivo));
  await aplicarConEjecutor(db);
  await reejecutarDirecto(db);
}

(async () => {
  for (const variable of ['CI_DB_HOST', 'CI_DB_USER', 'CI_DB_NAME']) {
    if (!process.env[variable]) {
      console.error(`Falta la variable ${variable} (también CI_DB_PORT y CI_DB_PASSWORD).`);
      process.exit(1);
    }
  }
  const db = await mysql.createConnection(conexion);
  let correcto = true;
  const inicio = Date.now();
  try {
    await escenarioA(db);
    await escenarioB(db);
  } catch {
    correcto = false;
  } finally {
    await db.end();
  }
  if (!correcto) {
    console.error('Migraciones: FALLÓ (ver el archivo y el error arriba).');
    process.exit(1);
  }
  console.log(`Migraciones: escenarios A y B correctos (${Math.round((Date.now() - inicio) / 1000)} s).`);
})().catch(error => {
  console.error(`Migraciones: no se pudo conectar o preparar la base: ${descripcionError(error)}`);
  process.exit(1);
});
