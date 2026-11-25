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
  assert.strictEqual(leerPush({}, 'production', avisar, () => {}).habilitado, false);
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

// Registros para diagnosticar en el hosting.
async function capturar(tarea) {
  const lineas = [];
  const originales = { log: console.log, warn: console.warn, error: console.error };
  for (const k of Object.keys(originales)) console[k] = (m) => lineas.push(String(m));
  try { await tarea(); } finally { Object.assign(console, originales); }
  return lineas.join('\n');
}

test('al arrancar se informa si los avisos quedan activados o por qué no', () => {
  const lineas = [];
  const anotar = (m) => lineas.push(m);
  leerPush(CLAVES, 'staging', anotar, anotar);
  leerPush({}, 'production', anotar, anotar);
  leerPush(CLAVES, 'test', anotar, anotar);
  assert.strictEqual(lineas.length, 2);
  assert.match(lineas[0], /activados.*staging/);
  assert.match(lineas[1], /desactivados.*no hay variables VAPID/i);
  assert.ok(!lineas.join().includes(CLAVES.VAPID_PRIVATE_KEY));
});

test('un envío fallido registra servicio, código y motivo, sin la dirección del dispositivo', async () => {
  reiniciar();
  const endpoint = 'https://web.push.apple.com/secreto123';
  responder = (tag) => (tag === 'push:destinos' ? [{ id: 1, usuario_id: 7, endpoint, p256dh: 'k', auth: 'a' }] : []);
  pushService._setSender(async () => { throw Object.assign(new Error('x'), { statusCode: 403, body: `{"reason":"BadJwtToken"} ${endpoint}` }); });
  const log = await capturar(() => pushService.enviar('vales', 'ATRASO', new Map([[7, { id: 1, mensaje: 'texto privado' }]])));
  assert.match(log, /Apple/);
  assert.match(log, /403/);
  assert.match(log, /BadJwtToken/);
  assert.ok(!log.includes('secreto123') && !log.includes('texto privado'));
});

test('fuera de producción cada aviso cuenta qué pasó', async () => {
  reiniciar();
  const sinDispositivos = await capturar(() => pushService.enviar('vales', 'ASIGNADO', new Map([[7, { id: 1, mensaje: 'x' }]])));
  assert.match(sinDispositivos, /vales\/ASIGNADO categoría=asignacion destinatarios=1 dispositivos=0/);
  const soloCampana = await capturar(() => pushService.enviar('vales', 'TOMADO', new Map([[7, { id: 1, mensaje: 'x' }]])));
  assert.match(soloCampana, /vales\/TOMADO sin categoría: solo campana/);
  responder = (tag) => (tag === 'push:destinos' ? [{ id: 1, usuario_id: 7, endpoint: ENDPOINT, p256dh: 'k', auth: 'a' }] : []);
  pushService._setSender(async () => {});
  const enviado = await capturar(() => pushService.enviar('vales', 'ATRASO', new Map([[7, { id: 9, mensaje: 'x' }]])));
  assert.match(enviado, /enviado notif-9 a usuario 7 por Google/);
  const registrado = await capturar(() => pushService.suscribir(7, suscripcion(), 'Android'));
  assert.match(registrado, /dispositivo registrado: usuario 7, movil, servicio Google/);
});

test('en producción no se registra el detalle de cada aviso', async () => {
  reiniciar();
  const config = require(path.join(SRC, 'config/env'));
  config.nodeEnv = 'production';
  try {
    const log = await capturar(() => pushService.enviar('vales', 'TOMADO', new Map([[7, { id: 1, mensaje: 'x' }]])));
    assert.strictEqual(log, '');
  } finally { config.nodeEnv = 'development'; }
});

const DIAGNOSTICO = [
  { usuario_id: 8, activo: 1, marca_escritorio: 0, marca_movil: 0, escritorios: 1, moviles: 0 },
  { usuario_id: 9, activo: 1, marca_escritorio: 1, marca_movil: 0, escritorios: 0, moviles: 0 },
  { usuario_id: 10, activo: 1, marca_escritorio: 0, marca_movil: 1, escritorios: 1, moviles: 0 },
  { usuario_id: 11, activo: 0, marca_escritorio: 1, marca_movil: 1, escritorios: 1, moviles: 1 }
];
const CINCO = () => new Map([7, 8, 9, 10, 11].map(id => [id, { id, mensaje: 'texto privado', nivel: 'info' }]));
const SOLO_EL_7 = [{ id: 1, usuario_id: 7, endpoint: ENDPOINT, p256dh: 'k', auth: 'a' }];

test('fuera de producción se explica por qué cada destinatario quedó sin push', async () => {
  reiniciar();
  responder = (tag) => {
    if (tag === 'push:destinos') return SOLO_EL_7;
    return tag === 'push:diagnostico' ? DIAGNOSTICO : [];
  };
  pushService._setSender(async () => {});
  const log = await capturar(() => pushService.enviar('vales', 'ATRASO', CINCO()));
  assert.match(log, /usuarios=7,8,9,10,11/);
  assert.match(log, /sin envío: 8=sin casilla, 9=sin dispositivo, 10=sin dispositivo de la clase marcada, 11=usuario desactivado/);
  assert.deepStrictEqual(consultas.find(c => c.tag === 'push:diagnostico').params.at(-1), [8, 9, 10, 11]);
  assert.ok(!log.includes('texto privado') && !log.includes(ENDPOINT));
});

test('si el diagnóstico falla, el aviso se envía igual; en producción ni se consulta', async () => {
  reiniciar();
  const enviados = [];
  responder = (tag) => {
    if (tag === 'push:diagnostico') throw new Error('x');
    return tag === 'push:destinos' ? SOLO_EL_7 : [];
  };
  pushService._setSender(async () => enviados.push(1));
  await capturar(() => pushService.enviar('vales', 'ATRASO', CINCO()));
  assert.strictEqual(enviados.length, 1);

  const config = require(path.join(SRC, 'config/env'));
  config.nodeEnv = 'production';
  consultas.length = 0;
  try {
    await capturar(() => pushService.enviar('vales', 'ATRASO', CINCO()));
    assert.ok(!consultas.some(c => c.tag === 'push:diagnostico'));
  } finally { config.nodeEnv = 'development'; }
});
