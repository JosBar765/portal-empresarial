// Lógica del navegador sin navegador: clasificación del dispositivo, estado de activación y service worker.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..', '..');
const { clasificarDispositivo, esIOS, resolverEstado } = require(path.join(RAIZ, 'public/js/pushDispositivo.js'));

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
const ENFOCADA = [{ visibilityState: 'visible', focused: true, url: 'https://portal.example/modules/vales/' }];

test('el service worker no guarda nada en caché', () => {
  const codigo = fs.readFileSync(path.join(RAIZ, 'public/sw.js'), 'utf8');
  assert.ok(!/caches\.|respondWith/.test(codigo));
});

test('muestra el aviso si no hay una pestaña enfocada y lo omite si la hay', async () => {
  const sin = cargarSW(UA.windows, []);
  await sin.disparar('push', PUSH);
  assert.strictEqual(sin.mostradas.length, 1);
  assert.strictEqual(sin.mostradas[0].titulo, 'Viáticos');
  assert.strictEqual(sin.mostradas[0].body, 'Autorizada');
  assert.strictEqual(sin.mostradas[0].tag, 'notif-9');
  const con = cargarSW(UA.windows, ENFOCADA);
  await con.disparar('push', PUSH);
  assert.strictEqual(con.mostradas.length, 0);
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
