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

export function parseIsoLocal(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
