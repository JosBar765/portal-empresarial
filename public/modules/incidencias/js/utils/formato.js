// public/modules/incidencias/js/utils/formato.js
// Fechas, tiempos y textos cortos. Toda la región usa la hora de Guatemala (UTC-6).
const ZONA = 'America/Guatemala';
const formatoFecha = new Intl.DateTimeFormat('es-GT', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

export function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '--';
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

// 30/09/2026 08:10
export function fechaHora(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const partes = Object.fromEntries(formatoFecha.formatToParts(d).map(p => [p.type, p.value]));
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`;
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// «hace 5 horas», «hace 3 días»: sin abreviaturas.
export function hace(valor) {
  if (!valor) return '';
  const ms = Date.now() - new Date(valor).getTime();
  if (Number.isNaN(ms)) return '';
  const minutos = Math.floor(ms / 60000);
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${plural(minutos, 'minuto', 'minutos')}`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${plural(horas, 'hora', 'horas')}`;
  const dias = Math.floor(horas / 24);
  if (dias < 60) return `hace ${plural(dias, 'día', 'días')}`;
  return `hace ${plural(Math.floor(dias / 30), 'mes', 'meses')}`;
}

// «3 días» / «5 horas» (sin «hace»): cuánto lleva algo esperando.
export function antiguedad(valor) {
  return hace(valor).replace(/^hace /, '');
}

export const ordinal = (n) => `${n}.ª`;

// Un texto largo en un renglón: corta sin partir palabras.
export function resumir(texto, max = 90) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

export const claveDeOperacion = () => `inc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
