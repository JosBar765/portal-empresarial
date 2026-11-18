// Fechas locales del navegador; el servidor manda y recibe texto «AAAA-MM-DD» en hora de Guatemala.
export function hoyMedianoche() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function sumarDiaLocal(fecha, dias) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

export function isoLocal(fecha) {
  const y = fecha.getFullYear(), m = String(fecha.getMonth() + 1).padStart(2, '0'), d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function primerDiaDelMes(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

export function parseIsoLocal(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ---------- Días como texto «AAAA-MM-DD» (aritmética en UTC: no depende de la zona del navegador) ----------
const MS_DIA = 86400000;
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_ABREVIADOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TOPE_DIAS = 400;

export function esIsoValido(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  return fecha.getUTCFullYear() === y && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

const aMs = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };

// Todos los días entre dos fechas, inclusive; vacío si falta una, es inválida o el regreso es anterior a la salida.
export function diasEntre(desde, hasta) {
  if (!esIsoValido(desde) || !esIsoValido(hasta)) return [];
  const dias = [];
  for (let ms = aMs(desde); ms <= aMs(hasta) && dias.length < TOPE_DIAS; ms += MS_DIA) dias.push(new Date(ms).toISOString().slice(0, 10));
  return dias;
}

// «Mié 18 nov».
export function etiquetaDia(iso) {
  if (!esIsoValido(iso)) return String(iso);
  const fecha = new Date(aMs(iso));
  return `${DIAS_CORTOS[fecha.getUTCDay()]} ${fecha.getUTCDate()} ${MESES_ABREVIADOS[fecha.getUTCMonth()]}`;
}
