// Respaldo de PRODUCCIÓN a un archivo .sql en el PC del dueño, sin mysqldump y en solo lectura.
// Reutiliza el cargador de configuración y la conexión de ORIGEN del refresco de staging (scripts/staging/lib).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const mysql = require('mysql2');
const { cargarConfig, describir, ARCHIVO_POR_DEFECTO } = require('../staging/lib/config');
const { conectarOrigen, ident, cerrar } = require('../staging/lib/conexiones');
const { protegerConexion } = require('./guardaSoloLectura');
const marca = require('../staging/lib/marca');
const copia = require('../staging/lib/copia');

const CARPETA_POR_DEFECTO = path.join(__dirname, '..', '..', 'respaldos');
const FILAS_POR_SENTENCIA = 500;
const BYTES_POR_SENTENCIA = 1024 * 1024;

// Tipos de sentencia enviados a producción (lista blanca en guardaSoloLectura.js).
const sentencias = {};
const abrirOrigen = cfg => conectarOrigen(cfg, conn => protegerConexion(conn, sentencias));

const log = mensaje => console.log(`[Respaldo] ${mensaje}`);

function leerArgumentos(argv) {
  const args = { archivo: ARCHIVO_POR_DEFECTO, confirmar: null, salida: null, comprimir: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--archivo') args.archivo = path.resolve(argv[++i] || '');
    else if (a === '--confirmar') args.confirmar = argv[++i] || '';
    else if (a === '--salida') args.salida = path.resolve(argv[++i] || '');
    else if (a === '--comprimir') args.comprimir = true;
    else throw new Error(`Argumento desconocido: ${a}`);
  }
  return args;
}

// Un solo readline para varias preguntas: con stdin redirigido, uno por pregunta pierde las líneas ya leídas.
function crearPreguntador() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lineas = [];
  let espera = null;
  let cerrado = false;
  rl.on('line', l => { if (espera) { const r = espera; espera = null; r(l.trim()); } else lineas.push(l.trim()); });
  rl.on('close', () => { cerrado = true; if (espera) espera(''); });
  return {
    preguntar(texto) {
      process.stdout.write(texto);
      if (lineas.length) return Promise.resolve(lineas.shift());
      if (cerrado) return Promise.resolve('');
      return new Promise(resolve => { espera = resolve; });
    },
    cerrar: () => rl.close()
  };
}

const dos = n => String(n).padStart(2, '0');

// Nunca sobrescribe: <base>_<fecha>, luego <base>_<fecha>_<HHmm>, luego con contador.
function rutaLibre(carpeta, db, ext, ahora) {
  const fecha = `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
  const hora = `${dos(ahora.getHours())}${dos(ahora.getMinutes())}`;
  const candidatos = [`${db}_${fecha}`, `${db}_${fecha}_${hora}`];
  for (const c of candidatos) {
    const ruta = path.join(carpeta, c + ext);
    if (!fs.existsSync(ruta)) return ruta;
  }
  for (let n = 2; ; n++) {
    const ruta = path.join(carpeta, `${candidatos[1]}_${n}${ext}`);
    if (!fs.existsSync(ruta)) return ruta;
  }
}

async function elegirCarpeta(args, preguntar) {
  if (args.salida) return args.salida;
  if (args.confirmar !== null) return CARPETA_POR_DEFECTO;
  const escrito = await preguntar(`Carpeta donde guardar el respaldo [${CARPETA_POR_DEFECTO}]: `);
  return escrito ? path.resolve(escrito) : CARPETA_POR_DEFECTO;
}

// Escritura con contrapresión (memoria plana); gzip opcional.
function abrirSalida(ruta, comprimir) {
  const archivo = fs.createWriteStream(ruta, { flags: 'wx' });
  const cola = comprimir ? zlib.createGzip({ level: 6 }) : archivo;
  if (comprimir) cola.pipe(archivo);
  let fallo = null;
  let aviso = null;
  const alFallar = e => { fallo = e; if (aviso) aviso(); };
  archivo.on('error', alFallar);
  cola.on('error', alFallar);
  cola.on('drain', () => { if (aviso) aviso(); });
  let bytes = 0;
  return {
    get bytes() { return bytes; },
    async escribir(texto) {
      if (fallo) throw fallo;
      bytes += Buffer.byteLength(texto);
      if (!cola.write(texto, 'utf8')) {
        await new Promise(resolve => { aviso = resolve; });
        aviso = null;
        if (fallo) throw fallo;
      }
    },
    async cerrar() {
      await new Promise(resolve => { archivo.once('finish', resolve); archivo.once('error', resolve); cola.end(); });
      if (fallo) throw fallo;
    }
  };
}

const literal = v => mysql.escape(copia.normalizarValor(v));

async function volcarTabla(origen, db, tabla, salida) {
  const [[fila]] = await origen.query(`SHOW CREATE TABLE ${ident(tabla)}`);
  await salida.escribir(`\n-- Tabla ${tabla}\nDROP TABLE IF EXISTS ${ident(tabla)};\n${fila['Create Table']}\n;\n`);

  const columnas = await copia.columnasCopiables(origen, db, tabla);
  const cabecera = `INSERT INTO ${ident(tabla)} (${columnas.map(ident).join(', ')}) VALUES\n`;
  const stream = origen.connection
    .query({ sql: `SELECT ${columnas.map(ident).join(', ')} FROM ${ident(tabla)}`, rowsAsArray: true })
    .stream();

  let lote = [];
  let bytes = 0;
  let total = 0;
  const volcar = async () => {
    if (!lote.length) return;
    await salida.escribir(`${cabecera}${lote.join(',\n')}\n;\n`);
    total += lote.length;
    lote = [];
    bytes = 0;
  };
  try {
    for await (const registro of stream) {
      const texto = `(${registro.map(literal).join(', ')})`;
      lote.push(texto);
      bytes += texto.length;
      if (lote.length >= FILAS_POR_SENTENCIA || bytes >= BYTES_POR_SENTENCIA) await volcar();
    }
    await volcar();
  } catch (error) {
    stream.destroy();
    throw error;
  }
  return total;
}

async function volcarVista(origen, db, vista, salida) {
  const [[fila]] = await origen.query(`SHOW CREATE VIEW ${ident(vista)}`);
  const ddl = fila['Create View']
    .replace(/DEFINER\s*=\s*`[^`]*`@`[^`]*`\s*/i, '')
    .split(`${ident(db)}.`).join('');
  await salida.escribir(`\n-- Vista ${vista}\nDROP VIEW IF EXISTS ${ident(vista)};\n${ddl}\n;\n`);
}

function cabeceraDump(cfg, ahora) {
  return [
    '-- Respaldo de la base de datos del Portal Empresarial (npm run main:backup)',
    `-- Generado: ${ahora.toISOString()} (UTC)`,
    `-- Origen: ${cfg.host}:${cfg.port}/${cfg.db}`,
    '-- Contiene datos reales de clientes: no compartir ni subir a git.',
    '-- Restaurar reemplaza las tablas existentes con el mismo nombre.',
    '',
    'SET NAMES utf8mb4;',
    "SET time_zone = '+00:00';",
    'SET FOREIGN_KEY_CHECKS = 0;',
    'SET UNIQUE_CHECKS = 0;',
    "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO,NO_ENGINE_SUBSTITUTION';",
    ''
  ].join('\n');
}

async function respaldar(origen, cfg, ruta, comprimir, ahora) {
  const db = cfg.db;
  const salida = abrirSalida(ruta, comprimir);
  const inicio = Date.now();
  try {
    await salida.escribir(cabeceraDump(cfg, ahora));
    const tablas = await copia.listarTablas(origen, db);
    const vistas = await copia.listarVistas(origen, db);
    const escritas = {};
    for (const tabla of tablas) {
      const t0 = Date.now();
      try {
        escritas[tabla] = await volcarTabla(origen, db, tabla, salida);
      } catch (error) {
        throw new Error(`tabla ${tabla}: [${error.code || 'sin código'}] ${error.sqlMessage || error.message}`);
      }
      log(`tabla ${tabla}: ${escritas[tabla]} fila(s) en ${Date.now() - t0} ms`);
    }
    for (const vista of vistas) {
      await volcarVista(origen, db, vista, salida);
      log(`vista ${vista}: exportada`);
    }
    const { triggers, rutinas } = await copia.programablesEnOrigen(origen, db);
    if (triggers.length) {
      log(`AVISO: ORIGEN tiene ${triggers.length} trigger(s) que NO se exportan: ${triggers.join(', ')}`);
      await salida.escribir(`\n-- AVISO: triggers NO exportados: ${triggers.join(', ')}\n`);
    }
    if (rutinas.length) {
      log(`AVISO: ORIGEN tiene ${rutinas.length} rutina(s) que NO se exportan: ${rutinas.join(', ')}`);
      await salida.escribir(`\n-- AVISO: rutinas NO exportadas: ${rutinas.join(', ')}\n`);
    }
    await salida.escribir('\nSET FOREIGN_KEY_CHECKS = 1;\nSET UNIQUE_CHECKS = 1;\n-- Fin del respaldo\n');
    await salida.cerrar();
    return { tablas, vistas, escritas, ms: Date.now() - inicio };
  } catch (error) {
    await salida.cerrar().catch(() => {});
    fs.rmSync(ruta, { force: true });
    log(`Se eliminó el archivo incompleto ${ruta}.`);
    throw error;
  }
}

// COUNT(*) exacto dentro del mismo snapshot contra las filas escritas.
async function verificar(origen, resultado) {
  const enOrigen = await copia.contarFilas(origen, resultado.tablas);
  const difieren = resultado.tablas.filter(t => enOrigen[t] !== resultado.escritas[t]);
  if (difieren.length) {
    difieren.forEach(t => console.error(`[Respaldo] DIFERENCIA en ${t}: escritas ${resultado.escritas[t]} / COUNT(*) ${enOrigen[t]}`));
    return false;
  }
  log(`Verificación correcta: ${resultado.tablas.length} tabla(s) con las filas escritas iguales al COUNT(*) del mismo snapshot.`);
  return true;
}

const mb = bytes => `${(bytes / 1048576).toFixed(2)} MB`;

(async () => {
  const args = leerArgumentos(process.argv.slice(2));
  const cfg = cargarConfig(args.archivo, ['ORIGEN']).origen;

  const preguntador = crearPreguntador();
  let origen = null;
  let codigo = 0;
  try {
    // Lectura previa de la marca; la sesión del snapshot se abre después de confirmar, para que sea reciente.
    const previa = await abrirOrigen(cfg);
    let marcaOrigen;
    try { marcaOrigen = await marca.leerMarca(marca.consultaDe(previa)); } finally { await cerrar(previa); }
    if (marcaOrigen === 'staging') {
      throw new Error('Esta base es de staging, no producción (lleva la marca entorno = staging). Revisa ORIGEN_* en el archivo de configuración. No se leyó nada más.');
    }

    log(`ORIGEN (solo lectura): ${describir(cfg)}`);
    log(marcaOrigen ? `AVISO: la base lleva la marca «${marcaOrigen}».` : 'Sin marca de entorno (producción).');
    const escrito = args.confirmar !== null ? args.confirmar : await preguntador.preguntar(`Escribe el nombre exacto de la base (${cfg.db}) para continuar: `);
    if (escrito !== cfg.db) throw new Error(`La confirmación «${escrito}» no coincide con la base «${cfg.db}». No se leyó nada.`);

    const carpeta = await elegirCarpeta(args, preguntador.preguntar);
    try {
      fs.mkdirSync(carpeta, { recursive: true });
    } catch (error) {
      throw new Error(`No se pudo crear la carpeta de salida ${carpeta} (${error.code || error.message}). Elige otra con --salida <carpeta>.`);
    }
    const ahora = new Date();
    const ruta = rutaLibre(carpeta, cfg.db, args.comprimir ? '.sql.gz' : '.sql', ahora);
    try {
      fs.closeSync(fs.openSync(ruta, 'wx'));
      fs.rmSync(ruta);
    } catch (error) {
      throw new Error(`No se puede escribir en la carpeta ${carpeta}: ${error.code || error.message}`);
    }

    origen = await abrirOrigen(cfg);
    log('Sesión de solo lectura verificada (transaction_read_only = 1) y snapshot consistente abierto.');
    const resultado = await respaldar(origen, cfg, ruta, args.comprimir, ahora);
    const tamano = fs.statSync(ruta).size;
    const filas = Object.values(resultado.escritas).reduce((a, b) => a + b, 0);
    const consistente = await verificar(origen, resultado);

    log(`Sentencias enviadas a la base: ${Object.entries(sentencias).map(([t, n]) => `${t} ${n}`).join(', ')} (todo lo demás se rechaza antes de enviarse).`);
    log(`Archivo: ${ruta}`);
    log(`Tamaño: ${mb(tamano)}${args.comprimir ? ' (comprimido)' : ''} | ${resultado.tablas.length} tabla(s), ${resultado.vistas.length} vista(s), ${filas} fila(s) | ${((Date.now() - ahora.getTime()) / 1000).toFixed(1)} s`);
    if (!consistente) {
      console.error(`[Respaldo] ERROR: el archivo ${ruta} es SOSPECHOSO (no coincide con el conteo). Se conserva, pero no confíes en él y repite el respaldo.`);
      codigo = 1;
    } else {
      log('Recuerda: el archivo tiene datos reales de clientes; no lo compartas ni lo subas a git.');
    }
  } catch (error) {
    console.error(`[Respaldo] ERROR: ${error.message}`);
    codigo = 1;
  } finally {
    preguntador.cerrar();
    await cerrar(origen);
  }
  process.exit(codigo);
})().catch(error => {
  console.error(`[Respaldo] ERROR: ${error.message}`);
  process.exit(1);
});
