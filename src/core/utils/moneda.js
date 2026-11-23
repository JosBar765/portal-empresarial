// src/core/utils/moneda.js
// Único lugar que da formato a un monto con la moneda del país del vale (nada de símbolos fijos en el código).

// Los PDF usan fuentes estándar (WinAnsi): un símbolo fuera de ese juego (₡) haría fallar la generación.
const SIMBOLO_WIN_ANSI = /^[\x20-\x7E\xA0-\xFF]+$/;

// País sin símbolo: se usa el código ISO; sin ninguno, el monto va solo.
function formatearMonto(monto, moneda, { paraPdf = false } = {}) {
  const numero = Number(monto);
  const texto = Number.isFinite(numero) ? numero.toFixed(2) : '';
  if (!texto) return '';
  const simbolo = moneda && moneda.simbolo ? String(moneda.simbolo) : '';
  const codigo = moneda && moneda.codigo ? String(moneda.codigo) : '';
  const usable = simbolo && (!paraPdf || SIMBOLO_WIN_ANSI.test(simbolo)) ? simbolo : codigo;
  return usable ? `${usable} ${texto}` : texto;
}

// Moneda de la fila de un vale (columnas `moneda_*` que aporta valeRepository).
const monedaDeVale = (vale) => ({ simbolo: vale && vale.moneda_simbolo, codigo: vale && vale.moneda_codigo });

module.exports = { formatearMonto, monedaDeVale };
