// src/config/env.js
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Todas las variables son obligatorias y no hay valores por defecto: un
// valor "por si acaso" escondido en el código termina siendo la
// configuración real en producción sin que nadie lo note (un secreto
// conocido, un puerto o un origen equivocados). Si falta alguna, o tiene un
// formato inválido, se listan TODAS las que fallan y el proceso no arranca —
// mismo criterio fail-fast que ya usa database.js con la conexión a MySQL.
const problemas = [];

function leer(nombre, { puedeEstarVacia = false } = {}) {
  const valor = process.env[nombre];
  if (valor === undefined || (!puedeEstarVacia && valor.trim() === '')) {
    problemas.push(`Falta la variable de entorno ${nombre} en el .env.`);
    return '';
  }
  return valor;
}

function leerPuerto(nombre) {
  const valor = leer(nombre).trim();
  if (!valor) return 0;
  const numero = Number(valor);
  if (!/^\d+$/.test(valor) || numero < 1 || numero > 65535) {
    problemas.push(`${nombre} debe ser un puerto entre 1 y 65535 (valor recibido: "${valor}").`);
    return 0;
  }
  return numero;
}

// <entero positivo><s|m|h|d>: segundos, minutos, horas o días — cualquier
// cantidad ("45s", "90m", "2h", "7d"). Es el único formato que entienden a la
// vez jsonwebtoken (vida del JWT) y tokenService (vida de la cookie).
const FORMATO_DURACION = /^[1-9]\d*(s|m|h|d)$/;
function leerDuracion(nombre) {
  const valor = leer(nombre).trim();
  if (!valor) return '';
  if (!FORMATO_DURACION.test(valor)) {
    problemas.push(`${nombre} debe ser un número entero positivo seguido de s, m, h o d — por ejemplo 30s, 15m, 12h o 7d (valor recibido: "${valor}").`);
    return '';
  }
  return valor;
}

const AMBIENTES = ['development', 'production', 'test'];
const nodeEnv = leer('NODE_ENV').trim();
if (nodeEnv && !AMBIENTES.includes(nodeEnv)) {
  problemas.push(`NODE_ENV debe ser uno de: ${AMBIENTES.join(', ')} (valor recibido: "${nodeEnv}").`);
}
const esProduccion = nodeEnv === 'production';

const port = leerPuerto('PORT');

const jwtSecret = leer('JWT_SECRET');
if (jwtSecret && jwtSecret.length < 32) {
  problemas.push('JWT_SECRET es demasiado corto: debe tener al menos 32 caracteres (en producción se recomiendan 48 o más, aleatorios).');
}
if (jwtSecret && esProduccion && /cambiar_este/i.test(jwtSecret)) {
  problemas.push('JWT_SECRET sigue siendo el valor de ejemplo: en producción debe ser un secreto propio y aleatorio.');
}

const jwtExpiresIn = leerDuracion('ACCESS_TOKEN_EXPIRES_IN');
const refreshExpiresIn = leerDuracion('REFRESH_TOKEN_EXPIRES_IN');

const dbPassword = leer('DB_PASSWORD', { puedeEstarVacia: true });
if (esProduccion && dbPassword === '') {
  problemas.push('DB_PASSWORD no puede estar vacía en producción.');
}

// Origen(es) desde los que un navegador puede abrir el WebSocket: esquema +
// dominio (+ puerto), sin barra final ni ruta. Varios separados por comas.
function leerOrigenes(nombre) {
  const bruto = leer(nombre).trim();
  if (!bruto) return [];
  const origenes = bruto.split(',').map(o => o.trim()).filter(Boolean);
  const validos = [];
  for (const origen of origenes) {
    if (origen === '*') {
      problemas.push(`${nombre} no puede ser "*": con cookies de sesión hay que listar el dominio exacto (ejemplo: https://portal.midominio.com).`);
      continue;
    }
    let url;
    try {
      url = new URL(origen);
    } catch {
      problemas.push(`${nombre} contiene un origen inválido: "${origen}" (ejemplo: https://portal.midominio.com).`);
      continue;
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origen) {
      problemas.push(`${nombre}: "${origen}" debe ser solo esquema y dominio, sin barra final ni ruta, y no puede ser "*" (ejemplo: https://portal.midominio.com).`);
      continue;
    }
    if (esProduccion && url.protocol !== 'https:') {
      problemas.push(`${nombre}: en producción el origen debe usar https (recibido: "${origen}").`);
      continue;
    }
    validos.push(origen);
  }
  return validos;
}

const supabaseUrl = leer('SUPABASE_URL').trim();
if (supabaseUrl) {
  try {
    new URL(supabaseUrl);
  } catch {
    problemas.push(`SUPABASE_URL no es una URL válida (valor recibido: "${supabaseUrl}").`);
  }
}

const config = {
  port,
  nodeEnv,
  jwtSecret,
  // Access token corto; la sesión larga la sostiene el refresh token rotativo.
  jwtExpiresIn,
  // Vida máxima de una sesión (desde el login), sin importar cuántas veces se renueve.
  refreshExpiresIn,
  socketCorsOrigin: leerOrigenes('SOCKET_CORS_ORIGIN'),
  db: {
    host: leer('DB_HOST').trim(),
    port: leerPuerto('DB_PORT'),
    user: leer('DB_USER').trim(),
    password: dbPassword,
    database: leer('DB_NAME').trim()
  },
  supabase: {
    url: supabaseUrl,
    secretKey: leer('SUPABASE_SECRET_KEY').trim(),
    bucket: leer('SUPABASE_STORAGE_BUCKET').trim()
  }
};

if (problemas.length) {
  problemas.forEach(p => console.error(`[FATAL] ${p}`));
  console.error(`[FATAL] ${problemas.length} problema(s) de configuración en el .env (ver .env.example). No se puede arrancar el servidor.`);
  process.exit(1);
}

module.exports = config;
