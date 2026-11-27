// El aviso «lo guardamos en tus Borradores» es solo del dueño del vale. Sin base de datos ni red.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');
const sustituir = (relativo, exports) => {
  const id = require.resolve(path.join(SRC, relativo));
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
const cargado = (relativo) => require.cache[require.resolve(path.join(SRC, relativo))];
if (!cargado('config/env')) sustituir('config/env', { nodeEnv: 'test', push: { habilitado: false }, supabase: {} });
if (!cargado('config/database')) sustituir('config/database', { query: async () => [], transaccion: async (fn) => fn({ query: async () => [] }) });

const destinatariosRepository = require(path.join(SRC, 'modules/vales/repositories/destinatariosRepository'));
const notificacionService = require(path.join(SRC, 'core/notifications/notificacionService'));
const valeEvents = require(path.join(SRC, 'modules/vales/events'));

async function destinatarios(opciones) {
  const originales = [destinatariosRepository.listarAdministradores, notificacionService.registrar];
  let ids;
  destinatariosRepository.listarAdministradores = async () => [1, 2];
  notificacionService.registrar = async (usuarios) => { ids = usuarios; };
  try {
    valeEvents.notificar({ vale: { id: 7, correlativo: 'X-7', asesor_id: 13 }, texto: 'venció', salas: ['asesor:13'], ...opciones });
    await new Promise(r => setImmediate(r));
    return [...ids].sort((a, b) => a - b);
  } finally { [destinatariosRepository.listarAdministradores, notificacionService.registrar] = originales; }
}

test('the draft notice is stored only for the voucher owner', async () => {
  assert.deepStrictEqual(await destinatarios({ conAdmin: false }), [13]);
});

test('every other notice is still stored for the administrators too', async () => {
  assert.deepStrictEqual(await destinatarios({}), [1, 2, 13]);
});
