// node --test scripts/vales/ventaServicio.test.js (sin base de datos ni red).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');
const sustituir = (relativo, exports) => {
  const id = require.resolve(path.join(SRC, relativo));
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
sustituir('config/env', { nodeEnv: 'test', push: { habilitado: false }, supabase: {} });
sustituir('config/database', { query: async () => [], transaccion: async (fn) => fn({ query: async () => [] }) });

let vale, activa, ultima, duena, falloAlGuardar, hechos;
sustituir('modules/vales/repositories/valeRepository', { obtenerPorId: async () => vale });
sustituir('modules/vales/repositories/usuarioValeRepository', { obtenerSupervisoresDeAsesor: async () => [{ id: 3 }] });
const guardar = (nombre) => async (datos) => {
  if (falloAlGuardar) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
  hechos.push([nombre, datos.numero, datos.estado]);
  return true;
};
sustituir('modules/vales/repositories/valeVentaRepository', {
  obtenerActivaPorVale: async () => activa,
  obtenerUltimaPorVale: async () => ultima,
  obtenerActivaPorNumero: async () => duena,
  registrarEvento: async (e) => { hechos.push(['evento', e.numero, e.evento]); },
  registrar: guardar('registrar'), corregir: guardar('corregir'), cerrar: guardar('cerrar')
});
sustituir('modules/vales/events', {
  notificar: (n) => hechos.push(['aviso', n.tipo, n.salas.join()]),
  refrescar: () => {}
});

const servicio = require(path.join(SRC, 'modules/vales/services/valeVentaService'));
const dueno = { id: 7, rolId: 2, nombre: 'A', permissions: ['vales.crear'] };
const supervisor = { id: 3, rolId: 3, nombre: 'S', permissions: ['vales.supervisar'] };

function reiniciar() {
  vale = { id: 5, correlativo: 'V-5', asesor_id: 7, estado: 'RECIBIDO' };
  activa = null; ultima = null; duena = null; falloAlGuardar = false; hechos = [];
}
const pendiente = (numero = '100') => ({ id: 1, vale_id: 5, numero_ov: numero, estado: 'POR_CONFIRMAR' });
const falla = (promesa, status, texto) => assert.rejects(promesa, (e) => e.status === status && texto.test(e.message));

test('the owner registers a received voucher and its supervisors are told', async () => {
  reiniciar();
  const r = await servicio.registrar(dueno, 5, ' 100 ');
  assert.deepStrictEqual(r.venta, { numero: '100', estado: 'POR_CONFIRMAR' });
  assert.deepStrictEqual(hechos, [['registrar', '100', undefined], ['aviso', 'VENTA_POR_CONFIRMAR', 'supervisor:3']]);
});

test('only the owner, only when received, one sale per voucher', async () => {
  reiniciar();
  await falla(servicio.registrar({ id: 1, rolId: 1, permissions: ['vales.crear'] }, 5, '100'), 403, /dueño/);
  vale.estado = 'PENDIENTE_CONFIRMACION';
  await falla(servicio.registrar(dueno, 5, '100'), 409, /recibido/);
  reiniciar();
  activa = pendiente();
  await falla(servicio.registrar(dueno, 5, '200'), 409, /ya tiene la OV 100/);
  assert.deepStrictEqual(hechos, []);
});

test('a duplicate names the voucher using it and records the blocked attempt', async () => {
  reiniciar();
  falloAlGuardar = true;
  duena = { vale_id: 9, correlativo: 'V-9', estado: 'POR_CONFIRMAR' };
  await falla(servicio.registrar(dueno, 5, '100'), 409, /ya está registrada en el vale V-9/);
  assert.deepStrictEqual(hechos, [['evento', '100', 'DUPLICADO_BLOQUEADO']]);
});

test('correcting and deleting need a pending sale and ring only the supervisors', async () => {
  reiniciar();
  activa = pendiente();
  await servicio.corregir(dueno, 5, '200');
  await servicio.borrar(dueno, 5);
  assert.deepStrictEqual(hechos.map(h => h.slice(0, 2)), [['corregir', '200'], ['aviso', 'VENTA_CORREGIDA'], ['cerrar', '100'], ['aviso', 'VENTA_RETIRADA']]);
  reiniciar();
  activa = { ...pendiente(), estado: 'CONFIRMADA' };
  await falla(servicio.borrar(dueno, 5), 409, /ya fue confirmada/);
});

test('the supervisor decides only the number it saw', async () => {
  reiniciar();
  activa = pendiente('200');
  await assert.rejects(servicio.confirmar(supervisor, 5, '100'), (e) => e.status === 409 && e.codigo === 'OV_CAMBIO' && e.datos.numeroActual === '200');
  assert.deepStrictEqual(hechos, []);
  await servicio.confirmar(supervisor, 5, '200');
  assert.deepStrictEqual(hechos, [['cerrar', '200', 'CONFIRMADA'], ['aviso', 'VENTA_CONFIRMADA', 'asesor:7']]);
});

test('a second resolver gets 409; a deleted one says so', async () => {
  reiniciar();
  ultima = { estado: 'RECHAZADA', numero_ov: '100' };
  await falla(servicio.rechazar(supervisor, 5, '100'), 409, /ya fue resuelta/);
  ultima = { estado: 'BORRADA', numero_ov: '100' };
  await falla(servicio.confirmar(supervisor, 5, '100'), 409, /borró la OV 100/);
});

test('administrator, manager and other supervisors cannot decide', async () => {
  reiniciar();
  activa = pendiente();
  for (const usuario of [
    { id: 3, rolId: 1, permissions: ['vales.supervisar'] },
    { id: 3, rolId: 8, permissions: ['vales.supervisar'] },
    { id: 4, rolId: 3, permissions: ['vales.supervisar'] }
  ]) await falla(servicio.confirmar(usuario, 5, '100'), 403, /supervisor de este asesor/);
  assert.deepStrictEqual(hechos, []);
});
