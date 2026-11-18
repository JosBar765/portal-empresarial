// src/modules/viaticos/services/montoEnLetras.js
// Función pura: monto -> texto en español como en un cheque («Cuatrocientos cuarenta 00/100»), hasta 99,999,999.99.
const { aCentavos } = require('../dinero');
const { LIMITES } = require('../constantes');

// Del 0 al 29 cada número tiene su propia palabra; desde el 30 se forma «decena y unidad».
const HASTA_29 = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'
];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

// Ante «mil» y «millones» el «uno» final se apocopa: «veintiún mil», «treinta y un millones».
function hasta99(n, apocope) {
  if (n < 30) {
    if (apocope && n === 1) return 'un';
    if (apocope && n === 21) return 'veintiún';
    return HASTA_29[n];
  }
  const unidad = n % 10;
  if (unidad === 0) return DECENAS[Math.floor(n / 10)];
  return `${DECENAS[Math.floor(n / 10)]} y ${apocope && unidad === 1 ? 'un' : HASTA_29[unidad]}`;
}

function hasta999(n, apocope) {
  if (n === 100) return 'cien';
  return [CENTENAS[Math.floor(n / 100)], hasta99(n % 100, apocope)].filter(Boolean).join(' ');
}

// Parte entera en palabras (en minúsculas); 0 es «cero».
function enteroEnLetras(n) {
  if (n === 0) return 'cero';
  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const unidades = n % 1000;
  const partes = [];
  if (millones === 1) partes.push('un millón');
  else if (millones > 1) partes.push(`${hasta999(millones, true)} millones`);
  if (miles === 1) partes.push('mil');
  else if (miles > 1) partes.push(`${hasta999(miles, true)} mil`);
  if (unidades > 0) partes.push(hasta999(unidades, false));
  return partes.join(' ');
}

// «440» -> «Cuatrocientos cuarenta 00/100». Lanza RangeError fuera de 0..LIMITES.VALOR_MAX (quien llama valida antes).
function montoEnLetras(monto) {
  const centavos = aCentavos(monto);
  if (centavos < 0 || centavos > aCentavos(LIMITES.VALOR_MAX)) throw new RangeError(`Monto fuera de rango para escribirlo en letras: ${monto}.`);
  const letras = enteroEnLetras(Math.floor(centavos / 100));
  return `${letras.charAt(0).toUpperCase()}${letras.slice(1)} ${String(centavos % 100).padStart(2, '0')}/100`;
}

// Plural de la moneda: el guardado en viaticos_monedas.nombre_plural o, si falta, la regla del español sobre su nombre.
function pluralDeMoneda(nombre, nombrePlural) {
  if (nombrePlural && String(nombrePlural).trim()) return String(nombrePlural).trim();
  const base = String(nombre || '').trim();
  if (!base) return '';
  if (/[aeiouáéíóú]$/i.test(base)) return `${base}s`;
  if (/z$/i.test(base)) return `${base.slice(0, -1)}ces`;
  // «Colón» -> «Colones»: la tilde de la última sílaba desaparece al sumar una.
  const sinTilde = base.replace(/[áéíóú](?=[^aeiouáéíóú]*$)/i, v => v.normalize('NFD')[0]);
  return `${sinTilde}es`;
}

// Texto completo del recibo: «Cuatrocientos cuarenta 00/100 quetzales».
function montoEnLetrasConMoneda(monto, { nombre, nombrePlural }) {
  return `${montoEnLetras(monto)} ${pluralDeMoneda(nombre, nombrePlural).toLowerCase()}`.trim();
}

module.exports = { montoEnLetras, enteroEnLetras, pluralDeMoneda, montoEnLetrasConMoneda };
