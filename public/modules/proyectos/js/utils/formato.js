export function escapeHtml(texto) {
  return String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Iniciales del avatar de cuenta (p. ej. "Asesor Comercial" -> "AC").
export function inicialesAvatar(nombreCompleto) {
  const partes = (nombreCompleto || '').trim().split(/\s+/);
  const iniciales = partes.slice(0, 2).map(p => p[0]).join('');
  return iniciales.toUpperCase() || '--';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// El servidor entrega «AAAA-MM-DD HH:MM:SS» en la hora de Guatemala; se lee tal cual, sin convertir zonas.
function partes(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(fecha || ''));
  return m ? { anio: +m[1], mes: +m[2], dia: +m[3], hora: m[4], minuto: m[5] } : null;
}

// «05 nov · 10:42»
export function fechaCorta(fecha) {
  const p = partes(fecha);
  return p ? `${String(p.dia).padStart(2, '0')} ${MESES[p.mes - 1]} · ${p.hora}:${p.minuto}` : '—';
}

// «hace 2 días», «hace 3 horas»; para fechas lejanas, la fecha corta.
export function hace(fecha, ahora = new Date()) {
  const p = partes(fecha);
  if (!p) return '—';
  const minutos = Math.max(0, Math.round((ahora - new Date(p.anio, p.mes - 1, p.dia, +p.hora, +p.minuto)) / 60000));
  if (minutos < 1) return 'ahora mismo';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  if (dias < 30) return `hace ${Math.floor(dias / 7)} ${Math.floor(dias / 7) === 1 ? 'semana' : 'semanas'}`;
  return fechaCorta(fecha).split(' · ')[0];
}

// «Andrés Pérez» -> «Andrés P.»
export function nombreCorto(nombre) {
  const [primero, ...resto] = String(nombre || '').trim().split(/\s+/);
  return resto.length ? `${primero} ${resto[0][0].toUpperCase()}.` : (primero || '—');
}

export const pluralizar = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;
