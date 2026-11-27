// node --test scripts/vales/ventaEntrada.test.js (lógica pura del navegador: sin DOM ni red).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');

const modulo = import(pathToFileURL(path.join(__dirname, '..', '..', 'public', 'modules', 'vales', 'js', 'utils', 'ordenVenta.js')).href);

test('a pasted number is cleaned of spaces and invisible characters', async () => {
  const { limpiarOv } = await modulo;
  assert.strictEqual(limpiarOv(' 100 234 567​890﻿\n'), '100234567890');
  assert.strictEqual(limpiarOv(' ​ '), '');
});

test('the quote is only suggested when it is a whole number valid as OV', async () => {
  const { ovDeCotizacion } = await modulo;
  assert.strictEqual(ovDeCotizacion('48213377.00'), '48213377');
  assert.strictEqual(ovDeCotizacion(5), '5');
  for (const no of ['1250.50', '0.00', 0, -3, null, undefined, '', 'abc', 1e12]) assert.strictEqual(ovDeCotizacion(no), null, String(no));
});
