// node --test scripts/vales/ventaTrabajo.test.js (sin base de datos ni red).
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

const venta = (id, vale_id, asesor_id, estado, registrada_en) => ({ id, vale_id, asesor_id, estado, registrada_en, numero_ov: `${id}00` });
// Vale 4: pendiente fuera del período; vale 5: pendiente de un asesor que no supervisa.
const ventas = [
  venta(1, 2, 7, 'POR_CONFIRMAR', '2026-11-20 10:00:00'), venta(2, 3, 7, 'CONFIRMADA', '2026-11-01 10:00:00'),
  venta(3, 4, 7, 'POR_CONFIRMAR', '2026-11-10 10:00:00'), venta(4, 5, 8, 'POR_CONFIRMAR', '2026-11-05 10:00:00')
];
sustituir('modules/vales/repositories/valeVentaRepository', {
  listarPorConfirmar: async () => ventas.filter(v => v.estado === 'POR_CONFIRMAR'),
  listarActivasPorVales: async (ids) => ventas.filter(v => ids.includes(v.vale_id))
});
sustituir('modules/vales/repositories/usuarioValeRepository', {
  obtenerSupervisoresDeAsesor: async (asesorId) => (asesorId === 7 ? [{ id: 3 }] : [{ id: 4 }])
});

const { aplicarVentas } = require(path.join(SRC, 'modules/vales/services/valeVentaBuzon'));

const supervisor = { id: 3, rolId: 3, permissions: ['vales.supervisar'] };
const vale = (id, extra = {}) => ({ id, asesor_id: id === 5 ? 8 : 7, tienda_id: 1, estado: 'RECIBIDO', actualizado_en: '2026-11-01 08:00:00', ...extra });
const pedir = (opciones) => aplicarVentas({
  usuario: supervisor, filas: [vale(1), vale(2), vale(3)], filtroContador: null, enTiendas: () => true,
  cargarVales: async (ids) => ids.map(id => vale(id)), comoPropias: false, ...opciones
});
const ids = (r) => r.vales.map(v => v.id);

test('pending sales go first, oldest first, even outside the window; no duplicates', async () => {
  const r = await pedir({});
  assert.deepStrictEqual(ids(r), [4, 2, 1, 3]);
  assert.strictEqual(r.porConfirmarOv, 2);
  assert.deepStrictEqual(r.vales[0].venta, { id: 3, numero: '300', estado: 'POR_CONFIRMAR', registrada_en: '2026-11-10 10:00:00', puede_decidir: true });
  assert.strictEqual(r.vales.find(v => v.id === 3).venta.puede_decidir, false);
  assert.strictEqual(r.vales.find(v => v.id === 1).venta, undefined);
});

test('the counter filter keeps only pending sales; another counter does not add outside rows', async () => {
  assert.deepStrictEqual(ids(await pedir({ filtroContador: 'porConfirmarOv' })), [4, 2]);
  const otro = await pedir({ filtroContador: 'confirmadosHoy', filas: [vale(1)] });
  assert.deepStrictEqual(ids(otro), [1]);
  assert.strictEqual(otro.porConfirmarOv, 2);
});

test('the store filter still applies to pending sales', async () => {
  const r = await pedir({ filas: [], enTiendas: () => false });
  assert.deepStrictEqual([ids(r), r.porConfirmarOv], [[], 0]);
});

test('workshop rows never show the sale; the owner sees it on an own row', async () => {
  const taller = { id: 9, rolId: 4, permissions: ['vales.gestionar_taller'] };
  const filas = [{ ...vale(2), _tipoRegistro: 'PROPUESTA' }, { ...vale(3), _tipoRegistro: 'FUSION' }];
  const ajeno = await pedir({ usuario: taller, filas, comoPropias: true });
  assert.ok(ajeno.vales.every(v => !v.venta));
  assert.strictEqual(ajeno.vales.length, 2);
  const dueno = await pedir({ usuario: { ...taller, id: 7 }, filas, comoPropias: true });
  assert.deepStrictEqual(dueno.vales.map(v => v._rowKey || `${v.id}-trabajo`), ['4-O', '2-O', '2-trabajo', '3-trabajo']);
  assert.ok(dueno.vales[0]._propio && dueno.vales[0].venta && !dueno.vales[0].venta.puede_decidir);
});

test('administrator and manager see every sale and decide none', async () => {
  for (const rolId of [1, 8]) {
    const r = await pedir({ usuario: { id: 99, rolId, permissions: [] } });
    assert.strictEqual(r.porConfirmarOv, 3);
    assert.ok(r.vales.every(v => !v.venta || !v.venta.puede_decidir));
  }
});
