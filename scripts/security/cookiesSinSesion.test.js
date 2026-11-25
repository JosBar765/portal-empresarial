// node --test scripts/security/cookiesSinSesion.test.js (sin base de datos ni red).
// Una petición sin cookies (arranque de la app instalada) no debe ordenar borrar las que el navegador sí guarda.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');
const sustituir = (relativo, exports) => {
  const id = require.resolve(path.join(SRC, relativo));
  require.cache[id] = { id, filename: id, loaded: true, exports };
};

let borrados = 0;
let sesion = null;
sustituir('core/auth/jwtHelper', { verifyToken: () => null });
sustituir('core/auth/tokenService', {
  ACCESS_COOKIE: 'token',
  REFRESH_COOKIE: 'refresh_token',
  autenticar: async () => sesion,
  sesionViva: async () => false,
  limpiarCookies: () => { borrados += 1; }
});

const { authenticateJWT } = require(path.join(SRC, 'core/permissions/permissionMiddleware'));

async function pedir(cookies, { url = '/dashboard/' } = {}) {
  borrados = 0;
  const salida = { siguio: false };
  const res = {
    setHeader() {},
    status(codigo) { salida.estado = codigo; return this; },
    json() { return this; },
    redirect(destino) { salida.destino = destino; return this; }
  };
  await authenticateJWT({ cookies, headers: {}, originalUrl: url, path: url }, res, () => { salida.siguio = true; });
  return { ...salida, borrados };
}

test('sin cookies redirige al login y no borra nada', async () => {
  sesion = null;
  for (const cookies of [{}, undefined, { otra: 'x' }]) {
    const r = await pedir(cookies);
    assert.strictEqual(r.destino, '/login/?expired=true');
    assert.strictEqual(r.borrados, 0);
  }
});

test('sin cookies en la API responde 401 y no borra nada', async () => {
  sesion = null;
  const r = await pedir({}, { url: '/api/modules' });
  assert.strictEqual(r.estado, 401);
  assert.strictEqual(r.borrados, 0);
});

test('con cookies que ya no valen sí las borra', async () => {
  sesion = null;
  for (const cookies of [{ token: 'vencido' }, { refresh_token: 'invalido' }]) {
    assert.strictEqual((await pedir(cookies)).borrados, 1);
  }
});

test('con sesión válida continúa sin tocar las cookies', async () => {
  sesion = { id: 7 };
  const r = await pedir({ token: 'bueno' });
  assert.strictEqual(r.siguio, true);
  assert.strictEqual(r.borrados, 0);
});
