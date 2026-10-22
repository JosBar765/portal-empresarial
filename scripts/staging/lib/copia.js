// Motor de copia: DDL exacto de ORIGEN y filas en streaming por lotes, sin mysqldump.
const { ident } = require('./conexiones');

const FILAS_POR_LOTE = 500;
const BYTES_POR_LOTE = 4 * 1024 * 1024;

async function listarObjetos(conn, db, tipo) {
  const [rows] = await conn.query(
    'SELECT TABLE_NAME AS nombre FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ? ORDER BY TABLE_NAME',
    [db, tipo]
  );
  return rows.map(r => r.nombre);
}

const listarTablas = (conn, db) => listarObjetos(conn, db, 'BASE TABLE');
const listarVistas = (conn, db) => listarObjetos(conn, db, 'VIEW');

// Borra toda tabla y vista de DESTINO: un schema_migrations sobrante engañaría al ejecutor.
async function vaciarDestino(conn, db) {
  const vistas = await listarVistas(conn, db);
  const tablas = await listarTablas(conn, db);
  for (const v of vistas) await conn.query(`DROP VIEW ${ident(v)}`);
  for (const t of tablas) await conn.query(`DROP TABLE ${ident(t)}`);
  return { vistas: vistas.length, tablas: tablas.length };
}

// Columnas reales (sin las generadas, que el motor recalcula).
async function columnasCopiables(conn, db, tabla) {
  const [rows] = await conn.query(
    'SELECT COLUMN_NAME AS nombre, EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
    [db, tabla]
  );
  return rows.filter(r => !/(VIRTUAL|STORED) GENERATED/i.test(r.extra || '')).map(r => r.nombre);
}

function pesoFila(fila) {
  let n = 8;
  for (const v of fila) {
    if (v === null) n += 4;
    else if (Buffer.isBuffer(v)) n += v.length * 2 + 3;
    else if (typeof v === 'string') n += v.length * 1.3 + 2;
    else n += 24;
  }
  return n;
}

async function copiarTabla(origen, destino, dbOrigen, tabla) {
  const [[fila]] = await origen.query(`SHOW CREATE TABLE ${ident(tabla)}`);
  await destino.query(fila['Create Table']);

  const columnas = await columnasCopiables(origen, dbOrigen, tabla);
  const insertar = `INSERT INTO ${ident(tabla)} (${columnas.map(ident).join(', ')}) VALUES ?`;
  const stream = origen.connection
    .query({ sql: `SELECT ${columnas.map(ident).join(', ')} FROM ${ident(tabla)}`, rowsAsArray: true })
    .stream();

  let lote = [];
  let bytes = 0;
  let total = 0;
  const volcar = async () => {
    if (!lote.length) return;
    await destino.query(insertar, [lote]);
    total += lote.length;
    lote = [];
    bytes = 0;
  };

  await destino.query('START TRANSACTION');
  try {
    for await (const registro of stream) {
      lote.push(registro);
      bytes += pesoFila(registro);
      if (lote.length >= FILAS_POR_LOTE || bytes >= BYTES_POR_LOTE) await volcar();
    }
    await volcar();
    await destino.query('COMMIT');
  } catch (error) {
    stream.destroy();
    await destino.query('ROLLBACK').catch(() => {});
    throw error;
  }
  return total;
}

// Las vistas citan `base_origen`.`tabla` y un DEFINER que quizá no exista en DESTINO.
async function copiarVista(origen, destino, vista, dbOrigen) {
  const [[fila]] = await origen.query(`SHOW CREATE VIEW ${ident(vista)}`);
  const ddl = fila['Create View']
    .replace(/DEFINER\s*=\s*`[^`]*`@`[^`]*`\s*/i, '')
    .split(`${ident(dbOrigen)}.`).join('');
  await destino.query(ddl);
}

async function contarFilas(conn, tablas) {
  const cuentas = {};
  for (const t of tablas) {
    const [[r]] = await conn.query(`SELECT COUNT(*) AS n FROM ${ident(t)}`);
    cuentas[t] = Number(r.n);
  }
  return cuentas;
}

// Triggers y rutinas no se copian: se avisa para que el dueño los vea.
async function programablesEnOrigen(conn, db) {
  const [triggers] = await conn.query('SELECT TRIGGER_NAME AS nombre FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?', [db]);
  const [rutinas] = await conn.query('SELECT ROUTINE_NAME AS nombre FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?', [db]);
  return { triggers: triggers.map(r => r.nombre), rutinas: rutinas.map(r => r.nombre) };
}

module.exports = { listarTablas, listarVistas, vaciarDestino, copiarTabla, copiarVista, contarFilas, programablesEnOrigen };
