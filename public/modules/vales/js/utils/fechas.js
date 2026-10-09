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
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Hora de Guatemala (UTC-6) sin depender de la zona del navegador: los getters UTC dan la hora de pared.
export function ahoraGT() {
  return new Date(Date.now() - 6 * 3600 * 1000);
}

export function hoyGT() {
  const a = ahoraGT();
  return new Date(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
}

export function esFinDeSemana(fecha) {
  const d = fecha.getDay();
  return d === 0 || d === 6;
}

// Mínimo de entrega (medianoche local del día): hoy antes de las 12:00 GT, si no mañana; sábado y domingo pasan al lunes.
export function fechaMinimaEntregaGT() {
  let min = hoyGT();
  if (ahoraGT().getUTCHours() >= 12) min = sumarDiaLocal(min, 1);
  while (esFinDeSemana(min)) min = sumarDiaLocal(min, 1);
  return min;
}
