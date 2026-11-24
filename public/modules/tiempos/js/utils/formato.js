// public/modules/tiempos/js/utils/formato.js
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const iniciales = (nombre) => String(nombre || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '--';
export const pluralDias = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;

// Fechas «AAAA-MM-DD» sin zona horaria (UTC), igual que el servidor.
export const aFecha = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); };
export const aISO = (f) => `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}-${String(f.getUTCDate()).padStart(2, '0')}`;
export const fechaLarga = (iso) => { const f = aFecha(iso); return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`; };
export const fechaCorta = (iso) => { const f = aFecha(iso); return `${DIAS[f.getUTCDay()].slice(0, 3)} ${f.getUTCDate()} ${MESES[f.getUTCMonth()].slice(0, 3)} ${f.getUTCFullYear()}`; };
export const nombreMes = (anio, mes) => `${MESES[mes]} ${anio}`;
// Hoy en Guatemala (UTC-6), igual que el servidor cuando no se manda fecha.
export const hoyISO = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

// «101 a 250» · «3001 o más»
export const textoRango = (r) => (r.hasta === null ? `${r.desde} o más` : `${r.desde} a ${r.hasta}`);

// El rango del producto al que pertenece una cantidad (null si no es válida o está por debajo del mínimo).
export function rangoDe(producto, cantidad) {
  const n = Number(cantidad);
  if (!producto || !Number.isInteger(n) || n < 1) return null;
  return producto.rangos.find(r => n >= r.desde && (r.hasta === null || n <= r.hasta)) || null;
}
