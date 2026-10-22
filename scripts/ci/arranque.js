// Prueba de humo: arranca el servidor contra la base ya preparada y consulta dos rutas.
// Pensado para CI: en este proyecto el servidor de desarrollo lo levanta solo su dueño.
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const RAIZ = path.join(__dirname, '..', '..');
const ESPERA_MAX_MS = 30000;

function puertoLibre() {
  return new Promise((resolver, rechazar) => {
    const servidor = net.createServer();
    servidor.once('error', rechazar);
    servidor.listen(0, '127.0.0.1', () => {
      const { port } = servidor.address();
      servidor.close(() => resolver(port));
    });
  });
}

const dormir = ms => new Promise(r => setTimeout(r, ms));

async function esperarServidor(url, hijo, estado) {
  const limite = Date.now() + ESPERA_MAX_MS;
  while (Date.now() < limite) {
    if (estado.salio) throw new Error(`El servidor terminó antes de escuchar (código ${hijo.exitCode}).`);
    try {
      await fetch(url, { redirect: 'manual' });
      return;
    } catch {
      await dormir(500);
    }
  }
  throw new Error(`El servidor no respondió en ${ESPERA_MAX_MS / 1000} s.`);
}

async function verificar(base) {
  const login = await fetch(`${base}/login/`, { redirect: 'manual' });
  if (login.status !== 200) throw new Error(`GET /login/ devolvió ${login.status} (se esperaba 200).`);
  console.log('  OK    GET /login/ -> 200');

  // Sin cookie, authenticateJWT responde 401 a la API (o redirige si lo tratara como HTML).
  const api = await fetch(`${base}/api/modules`, { redirect: 'manual' });
  if (![401, 302].includes(api.status)) throw new Error(`GET /api/modules sin sesión devolvió ${api.status} (se esperaba 401).`);
  console.log(`  OK    GET /api/modules sin sesión -> ${api.status}`);
}

(async () => {
  for (const variable of ['CI_DB_HOST', 'CI_DB_USER', 'CI_DB_NAME']) {
    if (!process.env[variable]) {
      console.error(`Falta la variable ${variable} (también CI_DB_PORT y CI_DB_PASSWORD).`);
      process.exit(1);
    }
  }
  const puerto = await puertoLibre();
  const base = `http://127.0.0.1:${puerto}`;
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(puerto),
    JWT_SECRET: 'ci-secreto-de-prueba-solo-para-pruebas-0123456789',
    ACCESS_TOKEN_EXPIRES_IN: '15m',
    REFRESH_TOKEN_EXPIRES_IN: '12h',
    SOCKET_CORS_ORIGIN: base,
    TRUST_PROXY: '0',
    DB_HOST: process.env.CI_DB_HOST,
    DB_PORT: process.env.CI_DB_PORT || '3306',
    DB_USER: process.env.CI_DB_USER,
    DB_PASSWORD: process.env.CI_DB_PASSWORD || '',
    DB_NAME: process.env.CI_DB_NAME,
    SUPABASE_URL: 'https://ci-falso.supabase.co',
    SUPABASE_SECRET_KEY: 'ci-clave-falsa',
    SUPABASE_STORAGE_BUCKET: 'ci-bucket',
    SUPABASE_STORAGE_BUCKET_BORRADORES: 'ci-bucket-borradores'
  };

  console.log(`Arranque: node src/server.js en el puerto ${puerto}`);
  const hijo = spawn(process.execPath, ['src/server.js'], { cwd: RAIZ, env });
  const estado = { salio: false, salida: '' };
  const guardar = d => { estado.salida += d.toString(); };
  hijo.stdout.on('data', guardar);
  hijo.stderr.on('data', guardar);
  hijo.on('exit', () => { estado.salio = true; });

  let error = null;
  try {
    await esperarServidor(`${base}/login/`, hijo, estado);
    await verificar(base);
  } catch (e) {
    error = e;
  }
  if (!error && estado.salida.includes('[FATAL]')) error = new Error('La salida del servidor contiene [FATAL].');

  hijo.kill();
  await dormir(500);

  if (error) {
    console.error(`  FALLO ${error.message}\n--- salida del servidor ---\n${estado.salida}`);
    process.exit(1);
  }
  console.log('Arranque: correcto.');
  process.exit(0);
})().catch(error => {
  console.error(`Arranque: ${error.message}`);
  process.exit(1);
});
