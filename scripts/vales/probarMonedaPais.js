#!/usr/bin/env node
// scripts/vales/probarMonedaPais.js
// Comprueba el formateo central de montos con la moneda del país (src/core/utils/moneda.js). Sin base de datos.
//
// Uso: node scripts/vales/probarMonedaPais.js
const path = require('path');
const assert = require('assert');
const { formatearMonto, monedaDeVale } = require(path.join(__dirname, '..', '..', 'src', 'core', 'utils', 'moneda'));

const casos = [
  ['símbolo del país', formatearMonto(1250, { simbolo: 'Q', codigo: 'GTQ' }), 'Q 1250.00'],
  ['otra moneda', formatearMonto('99.5', { simbolo: 'C$', codigo: 'NIO' }), 'C$ 99.50'],
  ['sin símbolo usa el código', formatearMonto(10, { simbolo: null, codigo: 'USD' }), 'USD 10.00'],
  ['sin moneda, monto solo', formatearMonto(10, { simbolo: null, codigo: null }), '10.00'],
  ['sin objeto moneda, no falla', formatearMonto(10, undefined), '10.00'],
  ['monto inválido, vacío', formatearMonto('abc', { simbolo: 'Q' }), ''],
  ['PDF: símbolo fuera de WinAnsi usa el código', formatearMonto(5, { simbolo: '₡', codigo: 'CRC' }, { paraPdf: true }), 'CRC 5.00'],
  ['PDF: símbolo compatible se conserva', formatearMonto(5, { simbolo: 'L', codigo: 'HNL' }, { paraPdf: true }), 'L 5.00'],
  ['fuera del PDF el símbolo se conserva', formatearMonto(5, { simbolo: '₡', codigo: 'CRC' }), '₡ 5.00'],
  ['moneda de la fila del vale', formatearMonto(7, monedaDeVale({ moneda_simbolo: '$', moneda_codigo: 'USD' })), '$ 7.00'],
  ['fila sin moneda', formatearMonto(7, monedaDeVale({})), '7.00']
];

let malas = 0;
for (const [nombre, obtenido, esperado] of casos) {
  try { assert.strictEqual(obtenido, esperado); console.log(`  OK    ${nombre}`); } catch { malas++; console.log(`  FALLA ${nombre} -> «${obtenido}» (esperado «${esperado}»)`); }
}
console.log(`${casos.length - malas}/${casos.length} correctas`);
process.exit(malas ? 1 : 0);
