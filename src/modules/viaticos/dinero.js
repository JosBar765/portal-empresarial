// src/modules/viaticos/dinero.js
// Aritmética de dinero en centavos enteros: nunca se multiplica ni divide con decimales de coma flotante.
const DECIMAL_RE = /^(-?)(\d+)(?:\.(\d+))?$/;

// Texto o número con decimales -> entero en centésimas (2 decimales), half-up (lejos de cero) sobre el tercer decimal.
function aCentavos(valor) {
  const texto = typeof valor === 'number' ? valor.toFixed(12).replace(/\.?0+$/, '') : String(valor).trim();
  const partes = DECIMAL_RE.exec(texto);
  if (!partes) throw new Error(`Valor numérico no válido: «${texto}».`);
  const [, signo, enteros, decimales = ''] = partes;
  const base = Number(enteros) * 100 + Number(decimales.padEnd(2, '0').slice(0, 2));
  const redondeado = decimales.length > 2 && decimales[2] >= '5' ? base + 1 : base;
  return signo === '-' ? -redondeado : redondeado;
}

// Las centésimas de km, galones y horas usan la misma escala que los centavos.
const aCentesimas = aCentavos;

function deCentavos(centavos) {
  return centavos / 100;
}

// Divide enteros y redondea half-up al entero más cercano; BigInt evita perder precisión en productos grandes.
function dividirRedondeado(numerador, denominador) {
  const n = BigInt(numerador);
  const d = BigInt(denominador);
  if (d === 0n) throw new Error('División entre cero.');
  const signo = (n < 0n) !== (d < 0n) ? -1n : 1n;
  const nAbs = n < 0n ? -n : n;
  const dAbs = d < 0n ? -d : d;
  return Number(signo * ((2n * nAbs + dAbs) / (2n * dAbs)));
}

function sumar(valores) {
  return valores.reduce((acumulado, valor) => acumulado + valor, 0);
}

// 1234.5 -> «1,234.50», para textos de mensajes.
function formatear(centavos) {
  const negativo = centavos < 0;
  const absoluto = Math.abs(centavos);
  const enteros = String(Math.floor(absoluto / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negativo ? '-' : ''}${enteros}.${String(absoluto % 100).padStart(2, '0')}`;
}

module.exports = { aCentavos, aCentesimas, deCentavos, dividirRedondeado, sumar, formatear };
