// node --test scripts/vales/ventaUbicacion.test.js (sin base de datos ni red).
// El aviso de una venta lleva al vale: el buzón real lo encuentra en «Trabajo realizado».
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');
const sustituir = (relativo, exports) => {
  const id = require.resolve(path.join(SRC, relativo));
  require.cache[id] = { id, filename: id, loaded: true, exports };
};

const vale = {
  id: 4, correlativo: 'GT-MTC-1026-4', asesor_id: 7, tienda_id: 1, estado: 'RECIBIDO', fecha_entrega: '2026-10-28',
  cliente_nombre: 'C', fecha_creacion: '2026-10-20', hora_creacion: '08:00:00', actualizado_en: '2026-10-28 10:00:00'
};
const pendiente = { id: 1, vale_id: 4, numero_ov: '48213377', estado: 'POR_CONFIRMAR', registrada_en: '2026-11-10 09:00:00', asesor_id: 7 };
// Respuestas por etiqueta de consulta; lo demás vuelve vacío.
const respuestas = {
  'vale:find_by_id': () => [vale],
  'vale:list_para_buzon': (sql) => (sql.includes('v.id IN') ? [vale] : []),
  'vale_venta:por_confirmar': () => [pendiente],
  'usuario:find_supervisores_by_asesor': () => [{ id: 3 }]
};
sustituir('config/env', { nodeEnv: 'test', push: { habilitado: false }, supabase: {} });
sustituir('config/database', {
  query: async (sql, params, tag) => (respuestas[tag] ? respuestas[tag](sql) : []),
  transaccion: async (fn) => fn({ query: async () => [] })
});

const buzon = require(path.join(SRC, 'modules/vales/services/valeBuzonService'));
const { ubicar } = require(path.join(SRC, 'modules/vales/services/valeUbicacionService'));
const supervisor = { id: 3, rolId: 3, permissions: ['vales.ver', 'vales.supervisar'] };

test('a pending sale outside the selected period is listed with its counter', async () => {
  const r = await buzon.obtenerBuzon(supervisor, { vista: 'trabajo', ventana: 'mes', fecha: '2026-12-01' });
  assert.deepStrictEqual(r.vales.map(v => [v.id, v.venta.numero, v.venta.puede_decidir]), [[4, '48213377', true]]);
  assert.strictEqual(r.contadores.porConfirmarOv, 1);
});

test('the notice finds the voucher in the work view', async () => {
  const donde = await ubicar(supervisor, 4);
  assert.ok(donde.vistas.includes('trabajo'), donde.vistas.join());
  assert.ok(!donde.vistas.includes('buzon'));
});
