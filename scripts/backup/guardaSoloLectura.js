// Lista blanca de sentencias para la conexión a producción del respaldo: solo lectura demostrable en código.
// Cualquier sentencia fuera de la lista lanza ANTES de salir hacia la base.

const PERMITIDAS = [
  [/^SELECT\b/i, 'SELECT'],
  [/^SHOW\b/i, 'SHOW'],
  [/^SET\s+SESSION\s+TRANSACTION\s+READ\s+ONLY$/i, 'SET SESSION'],
  [/^SET\s+SESSION\s+TRANSACTION\s+ISOLATION\s+LEVEL\s+(READ\s+COMMITTED|REPEATABLE\s+READ)$/i, 'SET SESSION'],
  [/^SET\s+NAMES\s+\w+$/i, 'SET SESSION'],
  [/^SET\s+time_zone\s*=\s*''$/i, 'SET SESSION'],
  [/^START\s+TRANSACTION(\s+WITH\s+CONSISTENT\s+SNAPSHOT|\s+READ\s+ONLY)?$/i, 'START TRANSACTION'],
  [/^COMMIT$/i, 'COMMIT'],
  [/^ROLLBACK$/i, 'ROLLBACK']
];

// Dentro de un SELECT: escrituras a archivo/variables, bloqueos y funciones con efectos.
const PROHIBIDO_EN_SELECT = /\b(INTO|FOR\s+UPDATE|LOCK\s+IN\s+SHARE\s+MODE|GET_LOCK|RELEASE_LOCK|RELEASE_ALL_LOCKS|IS_FREE_LOCK|IS_USED_LOCK|LOAD_FILE|SLEEP|BENCHMARK)\b/i;

// Quita comentarios, literales y identificadores entre comillas para analizar solo las palabras de la sentencia.
function esqueleto(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/`(?:[^`]|``)*`/g, '``')
    .replace(/'(?:[^'\\]|\\.|'')*'/g, "''")
    .replace(/"(?:[^"\\]|\\.|"")*"/g, '""')
    .trim()
    .replace(/;\s*$/, '')
    .trim();
}

// Devuelve el tipo de la sentencia permitida o lanza.
function clasificar(sql) {
  if (typeof sql !== 'string' || !sql.trim()) throw new Error('Respaldo solo lectura: sentencia vacía o no textual rechazada.');
  const limpio = esqueleto(sql);
  if (limpio.includes(';')) throw new Error(`Respaldo solo lectura: se rechazan varias sentencias juntas: ${limpio.slice(0, 60)}`);
  const permitida = PERMITIDAS.find(([patron]) => patron.test(limpio));
  if (!permitida) throw new Error(`Respaldo solo lectura: sentencia NO permitida en producción: ${limpio.slice(0, 60)}`);
  if (/^SET\s+time_zone/i.test(limpio) && !/^\s*SET\s+time_zone\s*=\s*'[+\-\d:]+'\s*;?\s*$/i.test(sql)) {
    throw new Error('Respaldo solo lectura: time_zone con valor no permitido.');
  }
  if (permitida[1] === 'SELECT' && PROHIBIDO_EN_SELECT.test(limpio)) {
    throw new Error(`Respaldo solo lectura: SELECT con efectos rechazado: ${limpio.slice(0, 60)}`);
  }
  return permitida[1];
}

const textoDe = arg => (typeof arg === 'string' ? arg : arg && arg.sql);

// Envuelve query/execute/prepare de la conexión subyacente (la usan también conn.query y el stream).
function protegerConexion(conn, conteo = {}) {
  const raw = conn.connection || conn;
  for (const metodo of ['query', 'execute', 'prepare']) {
    const original = raw[metodo];
    if (typeof original !== 'function') continue;
    raw[metodo] = function (...args) {
      const tipo = clasificar(textoDe(args[0]));
      conteo[tipo] = (conteo[tipo] || 0) + 1;
      return original.apply(this, args);
    };
  }
  return conn;
}

module.exports = { clasificar, protegerConexion };
