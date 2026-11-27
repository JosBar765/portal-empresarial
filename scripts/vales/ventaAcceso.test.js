// node --test scripts/vales/ventaAcceso.test.js (sin base de datos ni red).
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
// The advisor of the voucher is a supervisor too: the store list leaves them out, the voucher's supervisors do not.
sustituir('modules/vales/repositories/usuarioValeRepository', {
  listarAsesoresPorSupervisor: async () => [],
  obtenerPorId: async () => ({ taller_id: 1 }),
  obtenerSupervisoresDeAsesor: async () => [{ id: 3 }]
});
sustituir('modules/vales/repositories/tallerRepository', { listarActivos: async () => [{ id: 1, encargado_id: 5 }] });

const detalle = require(path.join(SRC, 'modules/vales/services/valeDetalleService'));
const vale = { id: 9, asesor_id: 7, estado: 'RECIBIDO' };

test('a supervisor who decides on the voucher can also open it', async () => {
  const supervisor = { id: 3, rolId: 3, permissions: ['vales.supervisar'] };
  assert.strictEqual(await detalle._puedeVerVale(supervisor, vale, []), true);
  assert.strictEqual(await detalle._puedeVerVale({ ...supervisor, id: 4 }, vale, []), false);
});

test('an owner with a workshop role sees the sale lines of their own voucher only', async () => {
  const linea = { estado_anterior: 'RECIBIDO', estado_nuevo: 'RECIBIDO', accion: 'Venta: se registró la OV 100, por confirmar', taller_id: null };
  const encargado = { id: 5, rolId: 4, permissions: ['vales.gestionar_taller'] };
  const disenador = { id: 6, rolId: 6, permissions: [] };
  for (const usuario of [encargado, disenador]) {
    assert.strictEqual((await detalle._filtrarHistorialPorRol(usuario, [linea], { esDuenio: false })).length, 0);
  }
  assert.strictEqual((await detalle._filtrarHistorialPorRol(encargado, [linea], { esDuenio: true })).length, 1);
});
