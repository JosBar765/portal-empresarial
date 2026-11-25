// Lógica del navegador sin navegador: clasificación del dispositivo, estado de activación y service worker.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..', '..');
const { clasificarDispositivo, esIOS, resolverEstado, planSincronizacion, mismaClave } = require(path.join(RAIZ, 'public/js/pushDispositivo.js'));

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  tabletAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
};

test('celulares y tabletas son «movil», incluido el iPad que se presenta como Mac', () => {
  assert.strictEqual(clasificarDispositivo(UA.iphone, 5), 'movil');
  assert.strictEqual(clasificarDispositivo(UA.android, 5), 'movil');
  assert.strictEqual(clasificarDispositivo(UA.tabletAndroid, 5), 'movil');
  assert.strictEqual(clasificarDispositivo(UA.mac, 5), 'movil');
  assert.strictEqual(clasificarDispositivo(UA.mac, 0), 'escritorio');
  assert.strictEqual(clasificarDispositivo(UA.windows, 10), 'escritorio');
  assert.strictEqual(esIOS(UA.mac, 5), true);
  assert.strictEqual(esIOS(UA.android, 5), false);
});

test('el estado de activación del dispositivo', () => {
  const base = { habilitado: true, ios: false, instalado: false, soportado: true, permiso: 'default', suscrito: false };
  assert.strictEqual(resolverEstado({ ...base, habilitado: false }), 'deshabilitado');
  assert.strictEqual(resolverEstado({ ...base, ios: true, soportado: false }), 'ios');
  assert.strictEqual(resolverEstado({ ...base, ios: true, instalado: true }), 'inactivo');
  assert.strictEqual(resolverEstado({ ...base, soportado: false }), 'no-soportado');
  assert.strictEqual(resolverEstado({ ...base, permiso: 'denied' }), 'bloqueado');
  assert.strictEqual(resolverEstado({ ...base, permiso: 'granted' }), 'inactivo');
  assert.strictEqual(resolverEstado({ ...base, permiso: 'granted', suscrito: true }), 'activo');
});

function cargarSW(userAgent, ventanas) {
  const manejadores = {};
  const mostradas = [];
  const abiertas = [];
  const self = {
    navigator: { userAgent },
    location: { origin: 'https://portal.example' },
    addEventListener: (nombre, fn) => { manejadores[nombre] = fn; },
    skipWaiting() {},
    registration: { showNotification: async (titulo, opciones) => { mostradas.push({ titulo, ...opciones }); } },
    clients: { claim: async () => {}, matchAll: async () => ventanas, openWindow: async (url) => { abiertas.push(url); } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(RAIZ, 'public/sw.js'), 'utf8'), { self, URL });
  const disparar = async (nombre, evento) => {
    let espera;
    manejadores[nombre]({ ...evento, waitUntil: (p) => { espera = p; } });
    await espera;
  };
  return { manejadores, mostradas, abiertas, disparar };
}

const PUSH = { data: { json: () => ({ titulo: 'Viáticos', cuerpo: 'Autorizada', url: '/modules/viaticos/', tag: 'notif-9' }) } };
const ENFOCADA_EN = (ruta) => [{ visibilityState: 'visible', focused: true, url: `https://portal.example${ruta}` }];
const ENFOCADA = ENFOCADA_EN('/modules/vales/');

test('el service worker no guarda nada en caché', () => {
  const codigo = fs.readFileSync(path.join(RAIZ, 'public/sw.js'), 'utf8');
  assert.ok(!/caches\.|respondWith/.test(codigo));
});

test('muestra el aviso si no hay una pestaña enfocada y lo omite si la enfocada es la de su módulo', async () => {
  const sin = cargarSW(UA.windows, []);
  await sin.disparar('push', PUSH);
  assert.strictEqual(sin.mostradas.length, 1);
  assert.strictEqual(sin.mostradas[0].titulo, 'Viáticos');
  assert.strictEqual(sin.mostradas[0].body, 'Autorizada');
  assert.strictEqual(sin.mostradas[0].tag, 'notif-9');
  const con = cargarSW(UA.windows, ENFOCADA_EN('/modules/viaticos/'));
  await con.disparar('push', PUSH);
  assert.strictEqual(con.mostradas.length, 0);
});

test('con otro módulo o el dashboard a la vista, el aviso sí se muestra', async () => {
  for (const ruta of ['/modules/vales/', '/dashboard/']) {
    const sw = cargarSW(UA.windows, ENFOCADA_EN(ruta));
    await sw.disparar('push', PUSH);
    assert.strictEqual(sw.mostradas.length, 1, ruta);
  }
});

test('en navegadores de Apple siempre muestra el aviso', async () => {
  for (const ua of [UA.iphone, UA.mac]) {
    const sw = cargarSW(ua, ENFOCADA);
    await sw.disparar('push', PUSH);
    assert.strictEqual(sw.mostradas.length, 1);
  }
});

test('al tocar el aviso abre el módulo si no hay ventana del portal', async () => {
  const sw = cargarSW(UA.windows, []);
  await sw.disparar('notificationclick', { notification: { close() {}, data: { url: '/modules/viaticos/' } } });
  assert.deepStrictEqual(sw.abiertas, ['https://portal.example/modules/viaticos/']);
});

const SYNC = { permiso: 'granted', usuarioId: 7, propietario: 7, suscrito: true, claveCoincide: true };

test('el mismo usuario reasocia, y recupera la suscripción perdida o hecha con otra clave', () => {
  assert.strictEqual(planSincronizacion(SYNC), 'registrar');
  assert.strictEqual(planSincronizacion({ ...SYNC, suscrito: false }), 'recrear');
  assert.strictEqual(planSincronizacion({ ...SYNC, claveCoincide: false }), 'recrear');
});

test('otra persona en el equipo lo deja apagado', () => {
  assert.strictEqual(planSincronizacion({ ...SYNC, usuarioId: 8 }), 'soltar');
  assert.strictEqual(planSincronizacion({ ...SYNC, usuarioId: 8, suscrito: false }), 'nada');
});

test('sin dueño recordado: adopta una suscripción existente y no crea ninguna', () => {
  assert.strictEqual(planSincronizacion({ ...SYNC, propietario: null }), 'registrar');
  assert.strictEqual(planSincronizacion({ ...SYNC, propietario: null, claveCoincide: false }), 'recrear');
  assert.strictEqual(planSincronizacion({ ...SYNC, propietario: null, suscrito: false }), 'nada');
});

test('sin permiso o sin usuario no se hace nada', () => {
  assert.strictEqual(planSincronizacion({ ...SYNC, permiso: 'default', suscrito: false }), 'nada');
  assert.strictEqual(planSincronizacion({ ...SYNC, permiso: 'denied' }), 'nada');
  assert.strictEqual(planSincronizacion({ ...SYNC, usuarioId: null }), 'nada');
});

test('se detecta una suscripción hecha con otra clave del servidor', () => {
  const clave = Uint8Array.from([1, 2, 3]);
  assert.strictEqual(mismaClave(Uint8Array.from([1, 2, 3]).buffer, clave), true);
  assert.strictEqual(mismaClave(Uint8Array.from([1, 2, 4]).buffer, clave), false);
  assert.strictEqual(mismaClave(Uint8Array.from([1, 2]).buffer, clave), false);
  assert.strictEqual(mismaClave(null, clave), true); // el navegador no informa la clave: no se toca
});

// Equipo simulado para el flujo en el navegador: permiso concedido, almacenamiento y service worker.
function cargarPagina({ usuarioId, memoria = new Map(), navegador = { suscripcion: null } }) {
  const llamadas = [];
  const nueva = () => {
    const s = {
      endpoint: `https://fcm.googleapis.com/x${llamadas.length}`,
      options: { applicationServerKey: Uint8Array.from([1, 2, 3]).buffer },
      toJSON: () => ({ endpoint: s.endpoint, keys: { p256dh: 'k', auth: 'a' } }),
      unsubscribe: async () => { navegador.suscripcion = null; }
    };
    return s;
  };
  const registro = { pushManager: { getSubscription: async () => navegador.suscripcion, subscribe: async () => (navegador.suscripcion = nueva()) } };
  const Notification = { permission: 'granted', requestPermission: async () => 'granted' };
  const navigator = { userAgent: UA.windows, maxTouchPoints: 0, serviceWorker: { register: async () => registro, getRegistration: async () => registro, ready: Promise.resolve(registro) } };
  const window = { Notification, PushManager: {}, navigator, matchMedia: () => ({ matches: false }) };
  const document = { addEventListener() {}, visibilityState: 'visible' };
  const localStorage = { getItem: (k) => (memoria.has(k) ? memoria.get(k) : null), setItem: (k, v) => memoria.set(k, String(v)), removeItem: (k) => memoria.delete(k) };
  const fetch = async (url, opciones = {}) => {
    llamadas.push(`${opciones.method || 'GET'} ${url.split('/push/')[1]}`);
    return { ok: true, json: async () => ({ habilitado: true, clavePublica: 'AQID', usuarioId }) };
  };
  vm.runInNewContext(fs.readFileSync(path.join(RAIZ, 'public/js/pushDispositivo.js'), 'utf8'),
    { window, document, navigator, Notification, localStorage, fetch, atob, setTimeout, Uint8Array });
  return { api: window.pushDispositivo, llamadas, memoria, navegador };
}

test('cerrar sesión conserva la elección; «Desactivar» la olvida', async () => {
  const equipo = cargarPagina({ usuarioId: 7 });
  await equipo.api.sincronizar();
  assert.strictEqual(await equipo.api.activar(), 'activo');

  await equipo.api.soltarAlSalir();
  assert.strictEqual(equipo.navegador.suscripcion, null);
  const vuelve = cargarPagina({ usuarioId: 7, memoria: equipo.memoria, navegador: equipo.navegador });
  await vuelve.api.sincronizar();
  assert.ok(vuelve.navegador.suscripcion, 'se reactiva solo');
  assert.ok(vuelve.llamadas.includes('POST suscripcion'));

  await vuelve.api.desactivar();
  const despues = cargarPagina({ usuarioId: 7, memoria: equipo.memoria, navegador: equipo.navegador });
  await despues.api.sincronizar();
  assert.strictEqual(despues.navegador.suscripcion, null);
});

test('al entrar otra persona el equipo queda apagado y su dueño lo recupera al volver', async () => {
  const equipo = cargarPagina({ usuarioId: 7 });
  await equipo.api.sincronizar();
  await equipo.api.activar();

  const otra = cargarPagina({ usuarioId: 8, memoria: equipo.memoria, navegador: equipo.navegador });
  await otra.api.sincronizar();
  assert.strictEqual(otra.navegador.suscripcion, null);
  assert.ok(!otra.llamadas.includes('POST suscripcion'));

  const duenio = cargarPagina({ usuarioId: 7, memoria: equipo.memoria, navegador: equipo.navegador });
  await duenio.api.sincronizar();
  assert.ok(duenio.navegador.suscripcion);
});
