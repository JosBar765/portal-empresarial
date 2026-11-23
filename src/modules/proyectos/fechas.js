// src/modules/proyectos/fechas.js
// Validación de fechas de calendario. `Date.parse('2026-02-31')` la da por buena (la corre a marzo) y MySQL la rechaza con un 500:
// aquí se exige que la fecha, vuelta a escribir, sea la misma.
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// ¿'AAAA-MM-DD' es un día real del calendario?
function esFechaReal(texto) {
  if (!FECHA.test(String(texto))) return false;
  const [a, m, d] = String(texto).split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

module.exports = { esFechaReal };
