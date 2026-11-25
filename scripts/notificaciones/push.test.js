// Pruebas del push sin base de datos ni red: config y base de datos se sustituyen antes de cargar los servicios.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');
const sustituir = (relativo, exports) => {
  const id = require.resolve(path.join(SRC, relativo));
  require.cache[id] = { id, filename: id, loaded: true, exports };
};

const consultas = [];
let responder = () => [];
sustituir('config/env', { nodeEnv: 'development', push: { habilitado: true, publicKey: 'publica', privateKey: 'privada', subject: 'mailto:a@b.c' } });
sustituir('config/database', { query: async (sql, params, tag) => { consultas.push({ sql, params, tag }); return responder(tag, params); } });
sustituir('core/websocket/socketManager', { sendToRooms() {} });

const { leerPush } = require(path.join(SRC, 'core/notifications/pushConfig'));
const pushService = require(path.join(SRC, 'core/notifications/pushService'));
const preferenciaService = require(path.join(SRC, 'core/notifications/preferenciaService'));
const notificacionService = require(path.join(SRC, 'core/notifications/notificacionService'));

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc';
const suscripcion = (extra = {}) => ({ endpoint: ENDPOINT, keys: { p256dh: 'k', auth: 'a' }, dispositivo: 'movil', ...extra });
const CLAVES = { VAPID_PUBLIC_KEY: 'BAbc_-1', VAPID_PRIVATE_KEY: 'xyz_-2', VAPID_SUBJECT: 'mailto:a@b.c' };
const reiniciar = () => { consultas.length = 0; responder = () => []; pushService._setSender(null); };
const esperar = () => new Promise(r => setImmediate(r));

// Silencia los errores que la prueba provoca a propósito.
async function sinRuido(tarea) {
  const original = console.error;
  console.error = () => {};
  try { return await tarea(); } finally { console.error = original; }
}

test('push activo en producción, staging y desarrollo; nunca en test', () => {
  for (const env of ['production', 'staging', 'development']) assert.strictEqual(leerPush(CLAVES, env).habilitado, true, env);
  assert.strictEqual(leerPush(CLAVES, 'test').habilitado, false);
});

test('sin claves o con claves incompletas o inválidas queda apagado', () => {
  const avisos = [];
  const avisar = (m) => avisos.push(m);
  assert.strictEqual(leerPush({}, 'production', avisar).habilitado, false);
  assert.strictEqual(avisos.length, 0);
  assert.strictEqual(leerPush({ VAPID_PUBLIC_KEY: 'a' }, 'production', avisar).habilitado, false);
  assert.strictEqual(leerPush({ ...CLAVES, VAPID_SUBJECT: 'correo@x.com' }, 'production', avisar).habilitado, false);
  assert.strictEqual(avisos.length, 2);
});

test('suscribir guarda la clase de dispositivo', async () => {
  reiniciar();
  await pushService.suscribir(7, suscripcion(), 'Android');
  assert.strictEqual(consultas[0].tag, 'push:upsert');
  assert.strictEqual(consultas[0].params[0], 7);
  assert.ok(consultas[0].params.includes('movil'));
});

test('suscribir rechaza dispositivo desconocido y destinos que no son un servicio push', async () => {
  reiniciar();
  await assert.rejects(pushService.suscribir(7, suscripcion({ dispositivo: 'reloj' })), /dispositivo/i);
  const malos = ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://evil.com/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.com/x', 'https://fcm.googleapis.com:8443/x'];
  for (const endpoint of malos) await assert.rejects(pushService.suscribir(7, suscripcion({ endpoint })), /suscripción/i, endpoint);
  assert.strictEqual(consultas.length, 0);
});

test('acepta los servicios push de Chrome, Firefox, Apple y Edge', async () => {
  reiniciar();
  for (const host of ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', 'wns2-by3p.notify.windows.com']) {
    await pushService.suscribir(7, suscripcion({ endpoint: `https://${host}/x` }));
  }
  assert.strictEqual(consultas.length, 4);
});

test('envía a los dispositivos que activaron la categoría, con título, cuerpo, url y tag', async () => {
  reiniciar();
  responder = (tag) => (tag === 'push:destinos' ? [{ id: 1, usuario_id: 7, endpoint: ENDPOINT, p256dh: 'k', auth: 'a' }] : []);
  const enviados = [];
  pushService._setSender(async (s, payload, opciones) => enviados.push({ s, payload: JSON.parse(payload), opciones }));
  const porUsuario = new Map([[7, { id: 55, mensaje: 'Autorizada', nivel: 'info' }], [8, { id: 56, mensaje: 'Autorizada', nivel: 'info' }]]);
  await pushService.enviar('viaticos', 'solicitud_autorizada', porUsuario);
  assert.deepStrictEqual(consultas[0].params, ['viaticos', 'autorizadas_rechazadas', [7, 8]]);
  assert.strictEqual(enviados.length, 1);
  assert.deepStrictEqual(enviados[0].payload, { titulo: 'Calculadora de Viáticos', cuerpo: 'Autorizada', url: '/modules/viaticos/', tag: 'notif-55', nivel: 'info', modulo: 'viaticos' });
  assert.strictEqual(enviados[0].opciones.urgency, 'normal');
});

test('un aviso sin categoría no consulta ni envía', async () => {
  reiniciar();
  await pushService.enviar('vales', 'TOMADO', new Map([[7, { id: 1, mensaje: 'x' }]]));
  await pushService.enviar('vales', null, new Map([[7, { id: 1, mensaje: 'x' }]]));
  assert.strictEqual(consultas.length, 0);
});

test('404 y 410 borran la suscripción; otro error no borra ni lanza', async () => {
  reiniciar();
  responder = (tag) => (tag === 'push:destinos' ? [1, 2, 3].map(id => ({ id, usuario_id: 7, endpoint: ENDPOINT + id, p256dh: 'k', auth: 'a' })) : []);
  pushService._setSender(async (s) => { throw Object.assign(new Error('x'), { statusCode: [404, 410, 500][Number(s.endpoint.slice(-1)) - 1] }); });
  await sinRuido(() => pushService.enviar('vales', 'ATRASO', new Map([[7, { id: 1, mensaje: 'x', nivel: 'alerta' }]])));
  assert.deepStrictEqual(consultas.filter(c => c.tag === 'push:delete_by_id').map(c => c.params[0]).sort(), [1, 2]);
});

test('registrar guarda y no se rompe si falla el push', async () => {
  reiniciar();
  responder = (tag) => {
    if (tag === 'notificacion:insert_varias') return { insertId: 10 };
    if (tag === 'notificacion:find_varias') return [{ id: 10, usuario_id: 7, mensaje: 'x', nivel: 'info' }];
    if (tag === 'push:destinos') throw new Error('tabla ausente');
    return [];
  };
  await sinRuido(async () => {
    await notificacionService.registrar([7], { modulo: 'vales', tipo: 'ATRASO', mensaje: 'x' });
    await esperar();
  });
  assert.ok(consultas.some(c => c.tag === 'push:destinos'));
});

test('revocar un usuario borra sus suscripciones y nunca lanza', async () => {
  reiniciar();
  await pushService.revocarUsuario(7);
  assert.deepStrictEqual([consultas[0].tag, consultas[0].params], ['push:delete_by_usuario', [7]]);
  responder = () => { throw new Error('x'); };
  await sinRuido(() => pushService.revocarUsuario(7));
});

const ASESOR = { id: 7, rolId: 2, permissions: ['viaticos.ver', 'viaticos.gestionar'] };

test('preferencias: solo las categorías visibles, desactivadas si no hay fila', async () => {
  reiniciar();
  responder = (tag) => (tag === 'preferencias:list' ? [{ categoria: 'vencimientos', escritorio: 0, movil: 1 }] : []);
  const { categorias } = await preferenciaService.listar(ASESOR, 'viaticos');
  assert.deepStrictEqual(categorias.map(c => [c.id, c.escritorio, c.movil]), [['autorizadas_rechazadas', false, false], ['vencimientos', false, true]]);
  assert.ok(categorias.every(c => c.nombre && c.descripcion));
});

test('preferencias: módulo inválido se rechaza; módulo sin categorías devuelve lista vacía', async () => {
  reiniciar();
  await assert.rejects(preferenciaService.listar(ASESOR, 'nada'), /módulo/i);
  assert.deepStrictEqual(await preferenciaService.listar(ASESOR, 'tiempos'), { categorias: [] });
});

test('guardar una casilla o la columna completa', async () => {
  reiniciar();
  await preferenciaService.guardar(ASESOR, { modulo: 'viaticos', categoria: 'vencimientos', canal: 'movil', activo: true });
  assert.strictEqual(consultas[0].tag, 'preferencias:upsert');
  assert.ok(/`movil`/.test(consultas[0].sql) && !/`escritorio`/.test(consultas[0].sql));
  assert.deepStrictEqual(consultas[0].params, [[[7, 'viaticos', 'vencimientos', 1]]]);
  reiniciar();
  await preferenciaService.guardar(ASESOR, { modulo: 'viaticos', todas: true, canal: 'escritorio', activo: false });
  assert.deepStrictEqual(consultas[0].params, [[[7, 'viaticos', 'autorizadas_rechazadas', 0], [7, 'viaticos', 'vencimientos', 0]]]);
});

test('guardar rechaza canal, valor o categoría no permitidos', async () => {
  reiniciar();
  const base = { modulo: 'viaticos', categoria: 'vencimientos', canal: 'movil', activo: true };
  await assert.rejects(preferenciaService.guardar(ASESOR, { ...base, canal: 'reloj' }), /escritorio/i);
  await assert.rejects(preferenciaService.guardar(ASESOR, { ...base, activo: 'si' }), /activ/i);
  await assert.rejects(preferenciaService.guardar(ASESOR, { ...base, categoria: 'por_autorizar' }), /categoría/i);
  assert.strictEqual(consultas.length, 0);
});
