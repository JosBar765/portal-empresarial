// Argumentos y configuración del refresco de staging (ORIGEN = producción, DESTINO = staging).
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ARCHIVO_POR_DEFECTO = path.join(__dirname, '..', '.env.refresco');
const CAMPOS = ['HOST', 'PORT', 'DB', 'USER', 'PASSWORD'];

function leerArgumentos(argv) {
  const args = { archivo: ARCHIVO_POR_DEFECTO, confirmar: null, soloLimpieza: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--archivo') args.archivo = path.resolve(argv[++i] || '');
    else if (a === '--confirmar') args.confirmar = argv[++i] || '';
    else if (a === '--solo-limpieza') args.soloLimpieza = true;
    else throw new Error(`Argumento desconocido: ${a}`);
  }
  return args;
}

// Lista TODAS las claves faltantes o inválidas de una vez, como src/config/env.js.
function cargarConfig(archivo, grupos) {
  if (!fs.existsSync(archivo)) {
    throw new Error(`No existe el archivo de configuración ${archivo}. Copia scripts/staging/refresco.env.example a scripts/staging/.env.refresco y complétalo.`);
  }
  const env = dotenv.parse(fs.readFileSync(archivo));
  const errores = [];
  const config = {};

  for (const grupo of grupos) {
    const c = {};
    for (const campo of CAMPOS) {
      const clave = `${grupo}_${campo}`;
      const valor = (env[clave] || '').trim();
      if (!valor) { errores.push(`${clave} falta o está vacía`); continue; }
      c[campo.toLowerCase()] = valor;
    }
    if (c.port !== undefined) {
      const puerto = Number(c.port);
      if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) errores.push(`${grupo}_PORT debe ser un puerto entre 1 y 65535`);
      c.port = puerto;
    }
    config[grupo.toLowerCase()] = c;
  }

  if (errores.length) throw new Error(`Configuración inválida en ${archivo}:\n  - ${errores.join('\n  - ')}`);
  return config;
}

const normalizarHost = h => (['localhost', '::1'].includes(h.toLowerCase()) ? '127.0.0.1' : h.toLowerCase());

function mismoDestino(a, b) {
  return normalizarHost(a.host) === normalizarHost(b.host) && a.port === b.port && a.db.toLowerCase() === b.db.toLowerCase();
}

const describir = c => `${c.host}:${c.port}/${c.db} (usuario ${c.user})`;

// Última defensa contra intercambiar ORIGEN y DESTINO: un destino cuyo nombre dice «prod» nunca se escribe.
function exigirDestinoNoProduccion(destino) {
  if (/prod/i.test(destino.db)) {
    throw new Error(`El DESTINO (${destino.db}) parece producción: su nombre contiene «prod». Revisa que ORIGEN sea producción y DESTINO staging, sin intercambiar. Se aborta.`);
  }
}

module.exports = { leerArgumentos, cargarConfig, mismoDestino, describir, exigirDestinoNoProduccion };
