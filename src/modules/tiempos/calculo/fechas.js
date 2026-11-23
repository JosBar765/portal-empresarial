// src/modules/tiempos/calculo/fechas.js
// Fechas en días hábiles, sin zona horaria: se trabaja con «AAAA-MM-DD» (UTC) para que el resultado no cambie según dónde corra.
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const aFecha = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); };
const aISO = (f) => `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}-${String(f.getUTCDate()).padStart(2, '0')}`;
const esFechaISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && aISO(aFecha(s)) === s;

const esFinDeSemana = (iso) => { const d = aFecha(iso).getUTCDay(); return d === 0 || d === 6; };

// Predicado por defecto: lunes a viernes. `festivos`: Set de «AAAA-MM-DD» que tampoco cuentan.
const hacerDiaHabil = (festivos = new Set()) => (iso) => !esFinDeSemana(iso) && !festivos.has(iso);

// El día de la orden no cuenta: el día 1 es el siguiente día hábil. `dias` = 0 devuelve el primer día hábil siguiente a la orden.
function sumarDiasHabiles(inicioISO, dias, esHabil = hacerDiaHabil()) {
  const f = aFecha(inicioISO);
  let contados = 0;
  let ultimo = inicioISO;
  while (contados < dias) {
    f.setUTCDate(f.getUTCDate() + 1);
    const iso = aISO(f);
    if (esHabil(iso)) { contados++; ultimo = iso; }
  }
  return ultimo;
}

// Primer día hábil después de la orden (de dónde empieza a contar).
const primerDiaHabil = (inicioISO, esHabil = hacerDiaHabil()) => sumarDiasHabiles(inicioISO, 1, esHabil);

const fechaLarga = (iso) => { const f = aFecha(iso); return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`; };
const fechaMedia = (iso) => { const f = aFecha(iso); return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]}`; };

module.exports = { aFecha, aISO, esFechaISO, esFinDeSemana, hacerDiaHabil, sumarDiasHabiles, primerDiaHabil, fechaLarga, fechaMedia };
