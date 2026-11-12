// Período de las listas: { tipo: hoy|dia|semana|mes|rango, fecha, desde, hasta }. Sin DOM; toda la aritmética es en UTC sobre «AAAA-MM-DD».
const ZONA = 'America/Guatemala';
const MS_DIA = 86400000;

const aUtc = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const aIso = (ms) => new Date(ms).toISOString().slice(0, 10);

// El servidor cuenta los días en hora de Guatemala; «hoy» no depende de la zona del navegador.
export function hoyGuatemala(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

// Semana actual, igual que el valor por defecto del servidor cuando faltan `desde` y `hasta`.
export function periodoInicial(ahora = new Date()) {
  return { tipo: 'semana', fecha: hoyGuatemala(ahora), desde: '', hasta: '' };
}

// Filtros `{ desde, hasta }` (AAAA-MM-DD) para la consulta: Hoy y Día un solo día, Semana de lunes a domingo, Mes completo, Rango tal cual.
export function aplicarPeriodoAConsulta(periodo, ahora = new Date()) {
  const fecha = periodo.tipo === 'hoy' ? hoyGuatemala(ahora) : (periodo.fecha || hoyGuatemala(ahora));
  switch (periodo.tipo) {
    case 'rango':
      return { desde: periodo.desde, hasta: periodo.hasta };
    case 'semana': {
      const ms = aUtc(fecha);
      const lunes = ms - ((new Date(ms).getUTCDay() + 6) % 7) * MS_DIA;
      return { desde: aIso(lunes), hasta: aIso(lunes + 6 * MS_DIA) };
    }
    case 'mes': {
      const d = new Date(aUtc(fecha));
      const y = d.getUTCFullYear(), m = d.getUTCMonth();
      return { desde: aIso(Date.UTC(y, m, 1)), hasta: aIso(Date.UTC(y, m + 1, 0)) };
    }
    default:
      return { desde: fecha, hasta: fecha };
  }
}
