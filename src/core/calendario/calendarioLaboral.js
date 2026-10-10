// src/core/calendario/calendarioLaboral.js
// Reglas puras del calendario laboral (sin base de datos). Toda hora es de pared UTC-6: un Date cuyos campos UTC
// son los dígitos de la hora de Guatemala, o el string 'YYYY-MM-DD HH:MM:SS' guardado en la base.
const { ErrorDeNegocio } = require('../utils/erroresHttp');

const OFFSET_UTC6_MS = 6 * 60 * 60 * 1000;
const MS_MIN = 60 * 1000;
const MS_DIA = 24 * 60 * MS_MIN;
const MAX_DIAS_BUSQUEDA = 800;
const HORA_MAXIMA_POR_DEFECTO = 12 * 60;
const DIAS_PLURAL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];

// Centroamérica (UTC-6, sin horario de verano): aritmética de offset fijo, sin depender de la zona del proceso.
function ahoraUTC6() {
  return new Date(Date.now() - OFFSET_UTC6_MS);
}

const aMs = (valor) => (valor instanceof Date ? valor.getTime() : Date.parse(`${String(valor).replace(' ', 'T')}Z`));
const aTexto = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const isoDe = (ms) => new Date(ms).toISOString().slice(0, 10);
const inicioDia = (ms) => Math.floor(ms / MS_DIA) * MS_DIA;
const diaMs = (iso) => Date.parse(`${iso}T00:00:00Z`);
const diaSemanaDe = (ms) => ((new Date(ms).getUTCDay() + 6) % 7) + 1; // 1 = lunes ... 7 = domingo
const aHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const aMinutos = (hhmm) => { const [h, m] = String(hhmm).split(':'); return Number(h) * 60 + Number(m); };
const fmtFecha = (iso) => iso.split('-').reverse().join('/');

// filas: { horarios, feriados, talleres, horasVencimiento, paisGuatemalaId } tal como las lee calendarioRepository.
function crearConfig({ horarios = [], feriados = [], talleres = [], horasVencimiento = 4, paisGuatemalaId = null }) {
  const porDia = new Array(8).fill(null);
  for (const h of horarios) {
    porDia[h.dia_semana] = {
      laboral: !!h.laboral && !!h.hora_inicio && !!h.hora_fin,
      recibeVales: !!h.laboral && !!h.recibe_vales,
      ini: h.hora_inicio ? aMinutos(h.hora_inicio) : 0,
      fin: h.hora_fin ? aMinutos(h.hora_fin) : 0
    };
  }
  const feriadosPorPais = new Map();
  for (const f of feriados) {
    if (!feriadosPorPais.has(f.pais_id)) feriadosPorPais.set(f.pais_id, { exactos: new Map(), anuales: new Map() });
    const entrada = feriadosPorPais.get(f.pais_id);
    entrada.exactos.set(f.fecha, f.nombre);
    if (f.se_repite_cada_anio) entrada.anuales.set(f.fecha.slice(5), f.nombre);
  }
  const porTaller = new Map();
  for (const t of talleres) {
    porTaller.set(t.id, {
      nombre: t.nombre,
      paisId: t.tienda_id == null ? paisGuatemalaId : (t.pais_id ?? null),
      horaMaxima: t.hora_maxima ? aMinutos(t.hora_maxima) : HORA_MAXIMA_POR_DEFECTO
    });
  }
  return { horarios: porDia, feriados: feriadosPorPais, talleres: porTaller, horasVencimiento, paisGuatemalaId };
}

function feriadoDe(cfg, paisId, iso) {
  const entrada = cfg.feriados.get(paisId);
  return entrada ? (entrada.exactos.get(iso) || entrada.anuales.get(iso.slice(5)) || null) : null;
}

function esDiaLaboral(cfg, iso, paisId) {
  const h = cfg.horarios[diaSemanaDe(diaMs(iso))];
  return !!(h && h.laboral) && !feriadoDe(cfg, paisId, iso);
}

function recibeVales(cfg, iso, paisId) {
  const h = cfg.horarios[diaSemanaDe(diaMs(iso))];
  return !!(h && h.recibeVales) && !feriadoDe(cfg, paisId, iso);
}

const hayDiaLaboral = (cfg) => cfg.horarios.some(h => h && h.laboral && h.fin > h.ini);

let avisoSinDiasLaborales = false;
function advertirSinDiasLaborales() {
  if (avisoSinDiasLaborales) return;
  avisoSinDiasLaborales = true;
  console.warn('[Calendario] No hay ningún día laboral configurado: los plazos se cuentan en horas corridas hasta que el administrador cargue un horario.');
}

// Suma `horas` de tiempo laboral a `inicio`; devuelve 'YYYY-MM-DD HH:MM:SS'.
function sumarHorasLaborales(cfg, inicio, horas, paisId) {
  let t = aMs(inicio);
  let resto = horas * 60 * MS_MIN;
  if (!hayDiaLaboral(cfg)) {
    advertirSinDiasLaborales();
    return aTexto(t + resto);
  }
  for (let n = 0; n < MAX_DIAS_BUSQUEDA; n++) {
    const dia = inicioDia(t);
    if (esDiaLaboral(cfg, isoDe(dia), paisId)) {
      const h = cfg.horarios[diaSemanaDe(dia)];
      const abre = dia + h.ini * MS_MIN;
      const cierra = dia + h.fin * MS_MIN;
      if (t < abre) t = abre;
      if (t < cierra) {
        if (resto <= cierra - t) return aTexto(t + resto);
        resto -= cierra - t;
      }
    }
    t = dia + MS_DIA;
  }
  advertirSinDiasLaborales();
  return aTexto(aMs(inicio) + horas * 60 * MS_MIN);
}

// Minutos de tiempo laboral entre `ahora` y `vencimiento` (0 si ya venció).
function minutosLaboralesRestantes(cfg, ahora, vencimiento, paisId) {
  const a = aMs(ahora);
  const v = aMs(vencimiento);
  if (!(v > a)) return 0;
  if (!hayDiaLaboral(cfg)) return Math.floor((v - a) / MS_MIN);
  let total = 0;
  let dia = inicioDia(a);
  for (let n = 0; n < MAX_DIAS_BUSQUEDA && dia < v; n++, dia += MS_DIA) {
    if (!esDiaLaboral(cfg, isoDe(dia), paisId)) continue;
    const h = cfg.horarios[diaSemanaDe(dia)];
    const desde = Math.max(a, dia + h.ini * MS_MIN);
    const hasta = Math.min(v, dia + h.fin * MS_MIN);
    if (hasta > desde) total += hasta - desde;
  }
  return Math.floor(total / MS_MIN);
}

const datosTaller = (cfg, id) => cfg.talleres.get(id) || { nombre: `#${id}`, paisId: cfg.paisGuatemalaId, horaMaxima: HORA_MAXIMA_POR_DEFECTO };

// País del vale: el del destino (el del primer taller; un vale no mezcla países).
function paisDeTalleres(cfg, talleresIds) {
  return talleresIds.length ? datosTaller(cfg, talleresIds[0]).paisId : cfg.paisGuatemalaId;
}

function minutosDelDia(ahora) {
  const a = aMs(ahora);
  return (a - inicioDia(a)) / MS_MIN;
}

function fechaMinimaParaTaller(cfg, tallerId, ahora) {
  const t = datosTaller(cfg, tallerId);
  let dia = inicioDia(aMs(ahora));
  if (minutosDelDia(ahora) >= t.horaMaxima) dia += MS_DIA;
  for (let n = 0; n < MAX_DIAS_BUSQUEDA; n++, dia += MS_DIA) {
    if (recibeVales(cfg, isoDe(dia), t.paisId)) return isoDe(dia);
  }
  return null;
}

// Con varios talleres rige el más restrictivo (la mínima más tardía). null si ningún día recibe vales.
function fechaMinimaEntrega(cfg, talleresIds, ahora) {
  let minima = '';
  for (const id of talleresIds) {
    const f = fechaMinimaParaTaller(cfg, id, ahora);
    if (!f) return null;
    if (f > minima) minima = f;
  }
  return minima || null;
}

function horaMaximaRestrictiva(cfg, talleresIds) {
  const horas = talleresIds.map(id => datosTaller(cfg, id).horaMaxima);
  return aHHMM(horas.length ? Math.min(...horas) : HORA_MAXIMA_POR_DEFECTO);
}

// Primer motivo por el que `fecha` (YYYY-MM-DD) no se puede pedir para alguno de los talleres, o null.
function razonNoDisponible(cfg, fecha, talleresIds, ahora) {
  const hoy = isoDe(aMs(ahora));
  for (const id of talleresIds) {
    const t = datosTaller(cfg, id);
    if (fecha < hoy) return { motivo: 'PASADO', detalle: 'Fecha pasada' };
    const feriado = feriadoDe(cfg, t.paisId, fecha);
    if (feriado) return { motivo: 'FERIADO', detalle: feriado };
    const h = cfg.horarios[diaSemanaDe(diaMs(fecha))];
    if (!(h && h.recibeVales)) return { motivo: 'NO_RECIBE', detalle: 'No se reciben vales' };
    if (fecha === hoy && minutosDelDia(ahora) >= t.horaMaxima) {
      return { motivo: 'PASADO', detalle: `Pasó la hora máxima de recibimiento (${aHHMM(t.horaMaxima)})`, hora: aHHMM(t.horaMaxima), taller: t.nombre };
    }
  }
  return null;
}

function fechasNoDisponibles(cfg, talleresIds, desde, hasta, ahora) {
  const lista = [];
  for (let dia = diaMs(desde); dia <= diaMs(hasta); dia += MS_DIA) {
    const fecha = isoDe(dia);
    const r = razonNoDisponible(cfg, fecha, talleresIds, ahora);
    if (r) lista.push({ fecha, motivo: r.motivo, detalle: r.detalle });
  }
  return lista;
}

// Lanza un Error con mensaje para el usuario si la fecha de entrega no se puede pedir; si no, devuelve la mínima.
function validarFechaEntrega(cfg, fecha, talleresIds, ahora) {
  const minima = fechaMinimaEntrega(cfg, talleresIds, ahora);
  if (!minima) throw new ErrorDeNegocio('No hay ningún día configurado para recibir vales de arte. Avisa al administrador.');
  const r = razonNoDisponible(cfg, fecha, talleresIds, ahora);
  if (!r) return minima;
  const legible = fmtFecha(fecha);
  if (r.motivo === 'FERIADO') throw new ErrorDeNegocio(`La fecha de entrega ${legible} es feriado (${r.detalle}). Elige otro día.`);
  if (r.motivo === 'NO_RECIBE') {
    throw new ErrorDeNegocio(`Los ${DIAS_PLURAL[diaSemanaDe(diaMs(fecha)) - 1]} no se reciben vales de arte: la fecha de entrega ${legible} no está disponible.`);
  }
  if (r.hora) {
    const de = talleresIds.length > 1 ? ` de ${r.taller}` : '';
    throw new ErrorDeNegocio(`Ya pasó la hora máxima de recibimiento${de} (${r.hora}) para entregar hoy. La fecha de entrega mínima es ${fmtFecha(minima)}.`);
  }
  throw new ErrorDeNegocio(`La fecha de entrega ${legible} ya pasó. La fecha de entrega mínima es ${fmtFecha(minima)}.`);
}

// '45 minutos', '1 hora', '2 h 30 min'.
function formatearDuracion(minutos) {
  const m = Math.max(0, Math.round(minutos));
  if (m < 60) return `${m} ${m === 1 ? 'minuto' : 'minutos'}`;
  const h = Math.floor(m / 60);
  const resto = m % 60;
  if (resto) return `${h} h ${resto} min`;
  return `${h} ${h === 1 ? 'hora' : 'horas'}`;
}

module.exports = {
  ahoraUTC6, crearConfig, feriadoDe, esDiaLaboral, recibeVales,
  sumarHorasLaborales, minutosLaboralesRestantes, paisDeTalleres,
  fechaMinimaEntrega, horaMaximaRestrictiva, fechasNoDisponibles, validarFechaEntrega, formatearDuracion
};
