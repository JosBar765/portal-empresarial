// Tocar un aviso abre lo que nombra. Sin base de datos ni red: lo externo se sustituye antes de cargar.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..', '..');
const SRC = path.join(RAIZ, 'src');
const sustituir = (relativo, exports) => {
  const id = require.resolve(path.join(SRC, relativo));
  require.cache[id] = { id, filename: id, loaded: true, exports };
  return exports;
};
const leer = (relativo) => fs.readFileSync(path.join(RAIZ, relativo), 'utf8');

test('el login conserva el número de aviso y descarta cualquier otro parámetro', () => {
  const { destinoSeguro, rutaDeLogin } = require(path.join(SRC, 'core/permissions/destinoLogin'));
  assert.strictEqual(destinoSeguro('/modules/vales/?aviso=15'), '/modules/vales/?aviso=15');
  assert.strictEqual(destinoSeguro('/modules/vales/?x=1&aviso=15&y=2'), '/modules/vales/?aviso=15');
  for (const mala of ['/modules/vales/?aviso=15abc', '/modules/vales/?aviso=https://evil.com', '/modules/vales/?aviso=']) {
    assert.strictEqual(destinoSeguro(mala), '/modules/vales/', mala);
  }
  assert.strictEqual(rutaDeLogin('/modules/vales/?aviso=15'), `/login/?expired=true&destino=${encodeURIComponent('/modules/vales/?aviso=15')}`);

  const fuente = leer('public/login/index.html').match(/function destinoTrasLogin\(busqueda\) \{[\s\S]*?\n {6}\}/)[0];
  const destinoTrasLogin = new Function(`${fuente}; return destinoTrasLogin;`)();
  const con = (d) => destinoTrasLogin(`?destino=${encodeURIComponent(d)}`);
  assert.strictEqual(con('/modules/vales/?aviso=15'), '/modules/vales/?aviso=15');
  assert.strictEqual(con('/modules/vales/?aviso=15&x=//evil.com'), '/dashboard/');
});

test('el número de aviso se lee de la dirección y se quita sin tocar lo demás', () => {
  const { idDeAvisoEnUrl, urlSinAviso } = require(path.join(RAIZ, 'public/js/notificaciones.js'));
  assert.strictEqual(idDeAvisoEnUrl('?aviso=15'), 15);
  for (const mala of ['', '?aviso=', '?aviso=1a', '?aviso=-3', '?otro=1']) assert.strictEqual(idDeAvisoEnUrl(mala), null, mala);
  assert.strictEqual(urlSinAviso({ pathname: '/modules/vales/', search: '?aviso=15', hash: '' }), '/modules/vales/');
  assert.strictEqual(urlSinAviso({ pathname: '/modules/proyectos/', search: '?aviso=15&volver=1', hash: '#/ventas' }), '/modules/proyectos/?volver=1#/ventas');
});

// Service worker con ventanas simuladas.
function cargarSw(ventanas) {
  const manejadores = {};
  const abiertas = [];
  const self = {
    addEventListener: (nombre, fn) => { manejadores[nombre] = fn; },
    navigator: { userAgent: 'Chrome Windows' },
    location: { origin: 'https://portal.test' },
    registration: { showNotification: async () => {} },
    skipWaiting() {},
    clients: { claim: async () => {}, matchAll: async () => ventanas, openWindow: async (url) => { abiertas.push(url); } }
  };
  vm.runInNewContext(leer('public/sw.js'), { self, URL });
  const tocar = async (url) => {
    let espera;
    manejadores.notificationclick({ notification: { close() {}, data: { url } }, waitUntil: (p) => { espera = p; } });
    await espera;
  };
  return { tocar, abiertas };
}
function ventana(ruta, { navegar = true } = {}) {
  const v = { url: `https://portal.test${ruta}`, mensajes: [], navegaciones: [], enfocada: false };
  v.focus = async () => { v.enfocada = true; };
  v.postMessage = (m) => v.mensajes.push(m);
  v.navigate = async (destino) => { if (!navegar) throw new Error('no controlada'); v.navegaciones.push(destino); };
  return v;
}

test('con el módulo ya abierto se le avisa a la pantalla sin recargarla', async () => {
  const otra = ventana('/dashboard/');
  const modulo = ventana('/modules/vales/');
  const sw = cargarSw([otra, modulo]);
  await sw.tocar('/modules/vales/?aviso=15');
  assert.ok(modulo.enfocada);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(modulo.mensajes)), [{ tipo: 'abrir-aviso', id: 15 }]);
  assert.deepStrictEqual([modulo.navegaciones.length, otra.navegaciones.length, sw.abiertas.length], [0, 0, 0]);
});

test('en otra pantalla navega con el aviso; si no puede, abre una nueva', async () => {
  const dashboard = ventana('/dashboard/');
  await cargarSw([dashboard]).tocar('/modules/vales/?aviso=15');
  assert.deepStrictEqual(dashboard.navegaciones, ['https://portal.test/modules/vales/?aviso=15']);

  const sw = cargarSw([ventana('/dashboard/', { navegar: false })]);
  await sw.tocar('/modules/vales/?aviso=15');
  assert.deepStrictEqual(sw.abiertas, ['https://portal.test/modules/vales/?aviso=15']);

  const cerrada = cargarSw([]);
  await cerrada.tocar('/modules/vales/?aviso=15');
  assert.deepStrictEqual(cerrada.abiertas, ['https://portal.test/modules/vales/?aviso=15']);
});

// Al correr toda la carpeta, otro archivo puede haber sustituido ya la base: se intercepta la consulta en el momento.
sustituir('config/env', { nodeEnv: 'development', push: { habilitado: false } });
sustituir('config/database', { query: async () => [] });
sustituir('core/websocket/socketManager', { sendToRooms() {} });

test('un aviso solo se entrega a su dueño', async () => {
  const db = require(path.join(SRC, 'config/database'));
  const notificacionService = require(path.join(SRC, 'core/notifications/notificacionService'));
  const original = db.query;
  const consultas = [];
  let filas = [{ id: 15, modulo: 'vales' }];
  db.query = async (sql, params) => { consultas.push({ sql, params }); return filas; };
  try {
    assert.strictEqual((await notificacionService.obtener(7, 15)).id, 15);
    assert.deepStrictEqual(consultas[0].params, [15, 7]);
    assert.match(consultas[0].sql, /usuario_id = ?/);
    filas = [];
    await assert.rejects(notificacionService.obtener(7, 99), (e) => e.status === 404);
  } finally { db.query = original; }
});

test('ubicar un vale: pestañas donde de verdad aparece para ese usuario', async () => {
  const buzon = require(path.join(SRC, 'modules/vales/services/valeUbicacionService'));
  const pedidas = [];
  const dependencias = {
    obtenerVale: async (id) => (id === 5 ? { id: 5, correlativo: 'GT-1', fecha_entrega: '2026-10-09 00:00:00', tienda_id: 3, asesor_id: 12 } : null),
    obtenerBuzon: async (usuario, filtros) => {
      pedidas.push(filtros);
      if (filtros.vista === 'mios') throw Object.assign(new Error('No tienes permiso para ver tus vales.'), { status: 403 });
      return { vales: filtros.vista === 'trabajo' ? [{ id: 5 }] : [{ id: 6 }] };
    }
  };
  assert.deepStrictEqual(await buzon.ubicar({ id: 7 }, 5, dependencias), { correlativo: 'GT-1', fechaEntrega: '2026-10-09', vistas: ['trabajo'], tiendaId: 3, asesorId: 12 });
  assert.deepStrictEqual(pedidas[0], { vista: 'buzon', ventana: 'mes', fecha: '2026-10-09', busqueda: 'GT-1' });
  await assert.rejects(buzon.ubicar({ id: 7 }, 8, dependencias), (e) => e.status === 404);
  await assert.rejects(buzon.ubicar({ id: 7 }, 5, { ...dependencias, obtenerBuzon: async () => ({ vales: [] }) }), (e) => e.status === 404);
});

test('ubicar una solicitud de viáticos: dueño y quien gestiona; los demás no', async () => {
  const servicio = require(path.join(SRC, 'modules/viaticos/services/ubicacionService'));
  const dependencias = { leerEncabezado: async () => ({ id: 3, correlativo: 'VIA-3', solicitanteId: 7, creadoEn: '2026-11-02 10:00:00' }) };
  assert.deepStrictEqual(await servicio.ubicar({ id: 7, permissions: ['viaticos.ver'] }, 3, dependencias), { correlativo: 'VIA-3', fechaCreacion: '2026-11-02', vistas: ['solicitudes'] });
  assert.deepStrictEqual((await servicio.ubicar({ id: 9, permissions: ['viaticos.ver', 'viaticos.gestionar'] }, 3, dependencias)).vistas, ['gestiones']);
  await assert.rejects(servicio.ubicar({ id: 9, permissions: ['viaticos.ver'] }, 3, dependencias), (e) => e.status === 404);
});

test('los avisos de viáticos guardan a qué solicitud se refieren', () => {
  for (const archivo of ['gestionService', 'rechazoVencimientoService', 'solicitudGuardadoService', 'liquidacionService']) {
    const fuente = leer(`src/modules/viaticos/services/${archivo}.js`);
    const llamadas = fuente.split('notificacionService.registrar(').slice(1);
    assert.ok(llamadas.length, archivo);
    for (const llamada of llamadas) assert.match(llamada.slice(0, 400), /referenciaTipo: NOTIFICACION\.REFERENCIA,\s*referenciaId:/, archivo);
  }
});
