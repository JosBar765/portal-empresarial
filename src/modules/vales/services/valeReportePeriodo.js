// src/modules/vales/services/valeReportePeriodo.js
// Período (ventanas y fechas en hora de Guatemala) y rótulos de filtros que comparten los reportes de actividad.
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { hoyISO } = require('./valeHelpers');

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const SIN_PAIS = 'Sin país';

// Rótulo de las tiendas elegidas, derivado del catálogo en el servidor: nunca se imprime texto enviado por el cliente.
function etiquetaTiendasFiltro(ids, tiendas = []) {
  if (ids.length === 1) return `Tienda: ${((tiendas.find(t => t.id === ids[0])) || {}).nombre || ids[0]}`;
  const elegidas = new Set(ids);
  const agrupar = (clave) => {
    const grupos = new Map();
    tiendas.forEach(t => { const k = clave(t); if (k) grupos.set(k, [...(grupos.get(k) || []), t]); });
    return grupos;
  };
  const coincide = (grupo) => grupo.length === elegidas.size && grupo.every(t => elegidas.has(t.id));
  for (const [pais, grupo] of agrupar(t => t.pais_nombre || SIN_PAIS)) if (coincide(grupo)) return `País: ${pais}`;
  for (const [depto, grupo] of agrupar(t => (/trofex/i.test(t.departamento_nombre || '') ? t.departamento_nombre : null))) {
    if (coincide(grupo)) return `Grupo: ${depto.replace(/^Ventas\s+/i, '')}`;
  }
  return `Tiendas: ${ids.length} seleccionadas`;
}

// Rótulo de los talleres elegidos, derivado del catálogo: «País: X» si son exactamente los talleres de ese país.
function etiquetaTalleresFiltro(ids, talleres = []) {
  if (ids.length === 1) return `Taller: ${((talleres.find(t => t.id === ids[0])) || {}).nombre || ids[0]}`;
  const elegidos = new Set(ids);
  const porPais = new Map();
  talleres.forEach(t => (t.paises && t.paises.length ? t.paises : [SIN_PAIS]).forEach(p => porPais.set(p, [...(porPais.get(p) || []), t])));
  for (const [pais, grupo] of porPais) if (grupo.length === elegidos.size && grupo.every(t => elegidos.has(t.id))) return `País: ${pais}`;
  return `Talleres: ${ids.length} seleccionados`;
}

const dos = n => String(n).padStart(2, '0');
function sumarDias(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const fechaCorta = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

const VENTANAS_REPORTE = ['hoy', 'dia', 'semana', 'mes', 'rango'];

function fechaIso(valor, etiqueta) {
  if (valor === undefined || valor === null || valor === '') return null;
  const texto = String(valor);
  const f = new Date(`${texto}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(f.getTime()) || f.toISOString().slice(0, 10) !== texto) {
    throw new ErrorDeNegocio(`La fecha ${etiqueta} no es válida.`);
  }
  return texto;
}

// Reportes ya no tiene «Todo»: sin período válido arranca en «Hoy».
function resolverVentanaReporte(filtros = {}) {
  const tipo = filtros.ventana || 'hoy';
  if (!VENTANAS_REPORTE.includes(tipo)) throw new ErrorDeNegocio('El período elegido no es válido.');
  if (tipo === 'rango') {
    const desde = fechaIso(filtros.desde, '«Desde»');
    const hasta = fechaIso(filtros.hasta, '«Hasta»');
    if (!desde || !hasta) throw new ErrorDeNegocio('Elige las fechas «Desde» y «Hasta».');
    if (desde > hasta) throw new ErrorDeNegocio('La fecha «Desde» no puede ser posterior a «Hasta».');
    return { tipo, desde, hasta };
  }
  return { tipo, fecha: fechaIso(filtros.fecha, 'del período') || null };
}

const lunesDe = (iso) => sumarDias(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));

// Número de semana ISO (la semana empieza en lunes).
function semanaIso(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const primerJueves = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - primerJueves) / 86400000 - 3 + ((primerJueves.getUTCDay() + 6) % 7)) / 7);
}

function rangoDe(ventana) {
  const hoy = hoyISO();
  const base = ventana.fecha || hoy;
  switch (ventana.tipo) {
    case 'hoy': return { tipo: 'hoy', desde: hoy, hasta: hoy };
    case 'dia': return { tipo: 'dia', desde: base, hasta: base };
    case 'semana': { const lunes = lunesDe(base); return { tipo: 'semana', desde: lunes, hasta: sumarDias(lunes, 6) }; }
    case 'mes': {
      const [y, m] = base.split('-').map(Number);
      return { tipo: 'mes', desde: `${y}-${dos(m)}-01`, hasta: sumarDias(`${m === 12 ? y + 1 : y}-${dos(m === 12 ? 1 : m + 1)}-01`, -1) };
    }
    default: return { tipo: 'rango', desde: ventana.desde, hasta: ventana.hasta };
  }
}

function etiquetaPeriodo(r) {
  if (r.tipo === 'mes') { const [y, m] = r.desde.split('-').map(Number); return `${MESES[m - 1]} ${y}`; }
  if (r.tipo === 'semana') return `Semana ${semanaIso(r.desde)} · ${fechaCorta(r.desde)} – ${fechaCorta(r.hasta)}`;
  if (r.desde === r.hasta) return r.desde === hoyISO() ? `Hoy · ${fechaCorta(r.desde)}` : fechaCorta(r.desde);
  return `${fechaCorta(r.desde)} – ${fechaCorta(r.hasta)}`;
}

const dentro = (fecha, r) => (!r.desde || fecha >= r.desde) && (!r.hasta || fecha <= r.hasta);
// Con entrega anterior al inicio del período (sin inicio no hay nada anterior).
const antesDe = (fecha, r) => !!r.desde && fecha < r.desde;

module.exports = {
  periodo: { resolverVentanaReporte, rangoDe, etiquetaPeriodo, dentro, antesDe },
  etiquetaTiendasFiltro,
  etiquetaTalleresFiltro
};
