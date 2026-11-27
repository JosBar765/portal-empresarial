// node --test scripts/vales/ventaReglas.test.js (sin base de datos ni red).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');
const sustituir = (relativo, exports) => {
  const id = require.resolve(path.join(SRC, relativo));
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
// Antes de cargar nada: sin esto se leería la configuración real y se abriría la base.
sustituir('config/env', { nodeEnv: 'test', push: { habilitado: false }, supabase: {} });
sustituir('config/database', { query: async () => [], transaccion: async (fn) => fn({ query: async () => [] }) });

const reglas = require(path.join(SRC, 'modules/vales/services/valeVentaReglas'));
const ov = reglas.normalizarNumeroOv;

test('accepts 1 to 12 digits and returns a string', () => {
  assert.strictEqual(ov('7'), '7');
  assert.strictEqual(ov('100234567890'), '100234567890');
});

test('strips spaces and invisible characters from a pasted number', () => {
  assert.strictEqual(ov(' 100 234 567​890﻿\r\n\t'), '100234567890');
});

test('rejects empty, leading zero, more than 12 digits, other symbols and non strings', () => {
  assert.throws(() => ov(''), /Escribe el número/);
  assert.throws(() => ov(' ​ '), /Escribe el número/);
  assert.throws(() => ov('0048213377'), /no puede empezar con cero/);
  assert.throws(() => ov('0'), /no puede empezar con cero/);
  assert.throws(() => ov('1234567890123'), /hasta 12 dígitos y escribiste 13/);
  for (const mala of ['12-34', '12.5', '1e5', '-5', 'OV123']) assert.throws(() => ov(mala), /solo puede tener números/, mala);
  for (const mala of [undefined, null, 123, ['5'], {}]) assert.throws(() => ov(mala), /Escribe el número/);
  assert.throws(() => ov(''), (e) => e.status === 400);
});

const fila = (id, estado, registrada_en, venta_id) => ({ id, ...(estado ? { venta: { estado, registrada_en, id: venta_id || id } } : {}) });

test('pending sales go first, oldest registration first; the rest keeps its order', () => {
  const filas = [
    fila(1), fila(2, 'CONFIRMADA', '2026-11-01 08:00:00'), fila(3, 'POR_CONFIRMAR', '2026-11-20 09:00:00'),
    fila(4), fila(5, 'POR_CONFIRMAR', '2026-11-10 09:00:00')
  ];
  assert.deepStrictEqual(reglas.ordenarConVentas(filas).map(f => f.id), [5, 3, 1, 2, 4]);
});

test('same registration time falls back to the sale id', () => {
  const filas = [fila(1, 'POR_CONFIRMAR', '2026-11-10 09:00:00', 8), fila(2, 'POR_CONFIRMAR', '2026-11-10 09:00:00', 3)];
  assert.deepStrictEqual(reglas.ordenarConVentas(filas).map(f => f.id), [2, 1]);
});

test('work rows of a workshop never carry the sale; own rows do', () => {
  assert.strictEqual(reglas.admiteVenta({ id: 1 }), true);
  assert.strictEqual(reglas.admiteVenta({ id: 1, _tipoRegistro: 'PROPUESTA' }), false);
  assert.strictEqual(reglas.admiteVenta({ id: 1, _tipoRegistro: 'FUSION' }), false);
  assert.strictEqual(reglas.admiteVenta({ id: 1, _tipoRegistro: 'PROPUESTA', _propio: true }), true);
});

test('who sees the sale: owner, supervisor of the advisor, administrator and manager', () => {
  const supervisados = new Set([7]);
  const ve = (usuario, asesorId) => reglas.veVenta(usuario, asesorId, supervisados);
  assert.ok(ve({ id: 7, rolId: 2 }, 7));
  assert.ok(ve({ id: 3, rolId: 3 }, 7));
  assert.ok(ve({ id: 1, rolId: 1 }, 9));
  assert.ok(ve({ id: 2, rolId: 8 }, 9));
  assert.ok(!ve({ id: 3, rolId: 3 }, 9));
  assert.ok(!ve({ id: 5, rolId: 6 }, 9));
});
