// Refresca la base de STAGING (DESTINO) con una copia de PRODUCCIÓN (ORIGEN), sin mysqldump.
// ORIGEN solo se lee (sesión de solo lectura + snapshot); todo lo demás ocurre en DESTINO.
const readline = require('readline');
const { leerArgumentos, cargarConfig, mismoDestino, describir } = require('./lib/config');
const { conectarOrigen, conectarDestino, cerrar } = require('./lib/conexiones');
const copia = require('./lib/copia');
const { ejecutarLimpiezas } = require('./lib/limpiezas');

const log = mensaje => console.log(`[Refresco] ${mensaje}`);

function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(texto, r => { rl.close(); resolve(r.trim()); }));
}

async function confirmar(args, destino) {
  const escrito = args.confirmar !== null
    ? args.confirmar
    : await preguntar(`Escribe el nombre exacto de la base DESTINO (${destino.db}) para continuar: `);
  if (escrito !== destino.db) throw new Error(`La confirmación «${escrito}» no coincide con la base DESTINO «${destino.db}». No se tocó nada.`);
}

async function copiarTodo(origen, destino, cfg) {
  const inicio = Date.now();
  const borrado = await copia.vaciarDestino(destino, cfg.destino.db);
  log(`DESTINO vaciado: ${borrado.tablas} tabla(s) y ${borrado.vistas} vista(s) eliminadas.`);

  const tablas = await copia.listarTablas(origen, cfg.origen.db);
  const vistas = await copia.listarVistas(origen, cfg.origen.db);
  let totalFilas = 0;
  for (const tabla of tablas) {
    const t0 = Date.now();
    try {
      const filas = await copia.copiarTabla(origen, destino, cfg.origen.db, tabla);
      totalFilas += filas;
      log(`tabla ${tabla}: ${filas} fila(s) en ${Date.now() - t0} ms`);
    } catch (error) {
      throw new Error(`tabla ${tabla}: [${error.code || 'sin código'}] ${error.sqlMessage || error.message}`);
    }
  }

  if (!vistas.length) log('ORIGEN no tiene vistas.');
  for (const vista of vistas) {
    try {
      await copia.copiarVista(origen, destino, vista, cfg.origen.db);
      log(`vista ${vista}: copiada`);
    } catch (error) {
      throw new Error(`vista ${vista}: [${error.code || 'sin código'}] ${error.sqlMessage || error.message}`);
    }
  }

  const { triggers, rutinas } = await copia.programablesEnOrigen(origen, cfg.origen.db);
  if (triggers.length) log(`AVISO: ORIGEN tiene ${triggers.length} trigger(s) que NO se copian: ${triggers.join(', ')}`);
  if (rutinas.length) log(`AVISO: ORIGEN tiene ${rutinas.length} rutina(s) que NO se copian: ${rutinas.join(', ')}`);

  log(`Copia terminada: ${tablas.length} tabla(s), ${totalFilas} fila(s) en ${Date.now() - inicio} ms.`);
  return tablas;
}

// COUNT(*) exacto en ambos lados; ORIGEN se lee dentro del mismo snapshot.
async function verificar(origen, destino, tablas) {
  const enOrigen = await copia.contarFilas(origen, tablas);
  const enDestino = await copia.contarFilas(destino, tablas);
  const difieren = tablas.filter(t => enOrigen[t] !== enDestino[t]);
  if (difieren.length) {
    difieren.forEach(t => console.error(`[Refresco] DIFERENCIA en ${t}: ORIGEN ${enOrigen[t]} / DESTINO ${enDestino[t]}`));
    throw new Error(`La verificación falló en ${difieren.length} tabla(s).`);
  }
  log(`Verificación correcta: ${tablas.length} tabla(s) con el mismo COUNT(*) en ORIGEN y DESTINO.`);
}

(async () => {
  const args = leerArgumentos(process.argv.slice(2));
  const cfg = cargarConfig(args.archivo, args.soloLimpieza ? ['DESTINO'] : ['ORIGEN', 'DESTINO']);
  if (!args.soloLimpieza && mismoDestino(cfg.origen, cfg.destino)) {
    throw new Error('ORIGEN y DESTINO son el mismo servidor y base de datos. Se aborta.');
  }

  log(args.soloLimpieza ? 'Modo: SOLO LIMPIEZA (no se copia nada).' : 'Modo: refresco completo.');
  if (!args.soloLimpieza) log(`ORIGEN  (solo lectura): ${describir(cfg.origen)}`);
  log(`DESTINO (se BORRA y reescribe): ${describir(cfg.destino)}`);
  if (!args.soloLimpieza && cfg.origen.db === cfg.destino.db) log('AVISO: ORIGEN y DESTINO tienen el mismo nombre de base (en servidores distintos).');
  if (args.soloLimpieza) log('Solo se aplicarán las limpiezas de staging sobre DESTINO.');

  await confirmar(args, cfg.destino);

  let origen = null;
  let destino = null;
  let codigo = 0;
  try {
    destino = await conectarDestino(cfg.destino);
    if (!args.soloLimpieza) {
      origen = await conectarOrigen(cfg.origen);
      log('ORIGEN: sesión de solo lectura verificada y snapshot consistente abierto.');
      const tablas = await copiarTodo(origen, destino, cfg);
      await verificar(origen, destino, tablas);
    }
    await destino.query('SET FOREIGN_KEY_CHECKS = 1');
    await destino.query('SET UNIQUE_CHECKS = 1');
    await ejecutarLimpiezas(destino);

    log('Listo. Reinicia el servidor de staging: el ejecutor aplicará las migraciones pendientes.');
    log('Después revisa: SELECT nombre, aplicada_en FROM schema_migrations ORDER BY nombre;');
  } catch (error) {
    console.error(`[Refresco] ERROR: ${error.message}`);
    codigo = 1;
  } finally {
    await cerrar(origen, destino);
  }
  process.exit(codigo);
})().catch(error => {
  console.error(`[Refresco] ERROR: ${error.message}`);
  process.exit(1);
});
