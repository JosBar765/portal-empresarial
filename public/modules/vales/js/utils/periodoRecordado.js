// Período del Buzón recordado por usuario. Sin imports: las pruebas lo cargan solo.
// Solo se respeta lo futuro; lo actual o pasado sigue al día de hoy, para que no «falten» vales al volver.
const TIPOS = ['hoy', 'dia', 'semana', 'mes', 'rango'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const clave = (usuarioId) => `vales.periodo.${usuarioId}`;

// Última fecha del período en curso de cada tipo (AAAA-MM-DD).
function finDelActual(tipo, hoy) {
  const [y, m, d] = hoy.split('-').map(Number);
  const utc = (anio, mes, dia) => new Date(Date.UTC(anio, mes, dia));
  if (tipo === 'mes') return utc(y, m, 0).toISOString().slice(0, 10);
  if (tipo === 'semana') return utc(y, m - 1, d + 6 - ((utc(y, m - 1, d).getUTCDay() + 6) % 7)).toISOString().slice(0, 10);
  return hoy;
}

export function periodoAlAbrir(guardado, hoy) {
  const inicial = { tipo: 'mes', fecha: hoy, desde: '', hasta: '' };
  if (!TIPOS.includes(guardado?.tipo) || !FECHA.test(guardado.fecha)) return inicial;
  const { tipo, fecha, desde, hasta } = guardado;
  if (tipo === 'rango') return FECHA.test(desde) && FECHA.test(hasta) && hasta >= hoy ? { tipo, fecha, desde, hasta } : inicial;
  const futuro = tipo !== 'hoy' && fecha > finDelActual(tipo, hoy);
  return { tipo, fecha: futuro ? fecha : hoy, desde: '', hasta: '' };
}

export function leerPeriodo(usuarioId, hoy) {
  let guardado = null;
  try { guardado = JSON.parse(localStorage.getItem(clave(usuarioId))); } catch { /* sin almacenamiento o dato roto */ }
  return periodoAlAbrir(guardado, hoy);
}

export function guardarPeriodo(usuarioId, periodo) {
  try { localStorage.setItem(clave(usuarioId), JSON.stringify(periodo)); } catch { /* sin almacenamiento: no se recuerda */ }
}
