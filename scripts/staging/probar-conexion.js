// Prueba de solo lectura: conecta a ORIGEN y DESTINO y muestra qué hay en cada uno. No escribe nada.
const { leerArgumentos, cargarConfig, mismoDestino, describir } = require('./lib/config');
const { conectar, activarSoloLectura, ident, cerrar } = require('./lib/conexiones');

const PRIVILEGIOS = ['CREATE', 'DROP', 'INSERT', 'ALTER', 'DELETE'];

function privilegiosDe(grants, db) {
  const encontrados = new Set();
  for (const g of grants) {
    const m = /^GRANT (.+?) ON (.+?) TO /i.exec(g.replace(/\\/g, ''));
    if (!m) continue;
    const alcance = m[2];
    const patron = alcance.replace(/^`|`\.\*$/g, '');
    const aplica = alcance === '*.*' || (alcance.endsWith('.*') && new RegExp(`^${patron.replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i').test(db));
    if (!aplica) continue;
    const lista = m[1].toUpperCase();
    for (const p of PRIVILEGIOS) {
      if (/ALL PRIVILEGES/.test(lista) || new RegExp(`\\b${p}\\b`).test(lista)) encontrados.add(p);
    }
  }
  return encontrados;
}

async function inspeccionar(nombre, c, esOrigen) {
  console.log(`\n[Refresco] ${nombre}: ${describir(c)}`);
  const conn = await conectar(c);
  try {
    const [[v]] = await conn.query('SELECT VERSION() AS version, DATABASE() AS base');
    console.log(`  Servidor: ${v.version} | base actual: ${v.base}`);

    const [[t]] = await conn.query(
      "SELECT COUNT(*) AS n, COALESCE(SUM(DATA_LENGTH + INDEX_LENGTH), 0) AS bytes FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
      [c.db]
    );
    console.log(`  Tablas: ${t.n} | tamaño aproximado: ${(Number(t.bytes) / 1048576).toFixed(1)} MB`);

    const [grandes] = await conn.query(
      "SELECT TABLE_NAME AS nombre, TABLE_ROWS AS filas, DATA_LENGTH + INDEX_LENGTH AS bytes FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY bytes DESC LIMIT 5",
      [c.db]
    );
    console.log('  Las 5 tablas más grandes:');
    for (const g of grandes) console.log(`    - ${g.nombre}: ~${g.filas} filas, ${(Number(g.bytes) / 1048576).toFixed(2)} MB`);

    const [[m]] = await conn.query("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'schema_migrations'", [c.db]);
    if (Number(m.n)) {
      const [[f]] = await conn.query(`SELECT COUNT(*) AS n FROM ${ident('schema_migrations')}`);
      console.log(`  schema_migrations: existe, ${f.n} fila(s)`);
    } else {
      console.log('  schema_migrations: no existe');
    }

    if (esOrigen) {
      await activarSoloLectura(conn);
      console.log('  Sesión de solo lectura: OK (transaction_read_only = 1)');
    } else {
      const [filas] = await conn.query('SHOW GRANTS FOR CURRENT_USER()');
      const grants = filas.map(f => Object.values(f)[0]);
      const tiene = privilegiosDe(grants, c.db);
      console.log(`  Privilegios sobre ${c.db}: ${PRIVILEGIOS.map(p => `${p}=${tiene.has(p) ? 'sí' : 'NO'}`).join(', ')}`);
      if (tiene.size < PRIVILEGIOS.length) console.log('  AVISO: faltan privilegios; el refresco fallaría en DESTINO.');
    }
  } finally {
    await cerrar(conn);
  }
}

(async () => {
  const args = leerArgumentos(process.argv.slice(2));
  const { origen, destino } = cargarConfig(args.archivo, ['ORIGEN', 'DESTINO']);
  if (mismoDestino(origen, destino)) throw new Error('ORIGEN y DESTINO son el mismo servidor y base de datos. Se aborta.');

  let fallos = 0;
  for (const [nombre, c, esOrigen] of [['ORIGEN', origen, true], ['DESTINO', destino, false]]) {
    try {
      await inspeccionar(nombre, c, esOrigen);
    } catch (error) {
      fallos++;
      console.error(`[Refresco] ERROR en ${nombre}: [${error.code || 'sin código'}] ${error.sqlMessage || error.message}`);
    }
  }
  if (fallos) {
    console.error(`\n[Refresco] La prueba falló en ${fallos} de 2 conexiones.`);
    process.exit(1);
  }
  console.log('\n[Refresco] Prueba correcta: ambas conexiones funcionan. No se escribió nada.');
  process.exit(0);
})().catch(error => {
  console.error(`[Refresco] ERROR: ${error.message}`);
  process.exit(1);
});
