// src/core/calendario/calendarioService.js
// Calendario laboral con caché en memoria. Quien cambie el horario, los feriados, el parámetro, la hora máxima de un
// taller o el país de una tienda llama a `invalidar()`; el TTL es solo un respaldo (p. ej. si otro proceso escribe).
const repo = require('./calendarioRepository');
const calendario = require('./calendarioLaboral');

const TTL_MS = 60 * 1000;
const HORAS_VENCIMIENTO_POR_DEFECTO = 4;
const FRACCION_AVISO = 0.25;

let cache = null;
let cargadoEn = 0;
let cargando = null;
let version = 0;

async function leerConfig() {
  const [horarios, feriados, talleres, horas, paisGuatemalaId] = await Promise.all([
    repo.listarHorarios(), repo.listarFeriados(), repo.listarTalleres(),
    repo.obtenerHorasVencimiento(), repo.obtenerPaisGuatemalaId()
  ]);
  if (!Number.isInteger(horas) || horas < 1) {
    console.warn(`[Calendario] Parámetro horas_vencimiento_vale ausente o inválido: se usan ${HORAS_VENCIMIENTO_POR_DEFECTO} horas.`);
  }
  if (!paisGuatemalaId) console.warn('[Calendario] No existe el país «Guatemala»: los talleres generales no tendrán feriados.');
  return calendario.crearConfig({
    horarios, feriados, talleres, paisGuatemalaId,
    horasVencimiento: Number.isInteger(horas) && horas >= 1 ? horas : HORAS_VENCIMIENTO_POR_DEFECTO
  });
}

// Configuración vigente; recarga si venció el TTL o se invalidó. Si la recarga falla y hay caché, sigue con ella.
async function cargar() {
  if (cache && Date.now() - cargadoEn < TTL_MS) return cache;
  if (!cargando) {
    const versionAlCargar = version;
    cargando = leerConfig().then((cfg) => {
      cache = cfg;
      cargadoEn = versionAlCargar === version ? Date.now() : 0;
      return cfg;
    }).finally(() => { cargando = null; });
  }
  try {
    return await cargando;
  } catch (error) {
    if (cache) return cache;
    throw error;
  }
}

// Lectura síncrona de lo ya cargado (null si nunca se cargó); dispara una recarga en segundo plano si está vencido.
function configCargada() {
  if (!cache || Date.now() - cargadoEn >= TTL_MS) cargar().catch(() => {});
  return cache;
}

function invalidar() {
  version += 1;
  cargadoEn = 0;
  cargar().catch((error) => console.error('[Calendario] No se pudo recargar:', error.message));
}

const idsDeCsv = (csv) => String(csv || '').split(',').map(Number).filter(Number.isFinite);

class CalendarioService {
  cargar() { return cargar(); }

  invalidar() { invalidar(); }

  async horasVencimiento() {
    return (await cargar()).horasVencimiento;
  }

  // Vencimiento de un plazo de N horas laborales que empieza `ahora`, para un vale con esos talleres.
  async vencimientoPlazo(talleresIds, ahora = calendario.ahoraUTC6()) {
    const cfg = await cargar();
    return calendario.sumarHorasLaborales(cfg, ahora, cfg.horasVencimiento, calendario.paisDeTalleres(cfg, talleresIds));
  }

  async minutosRestantes(vencimiento, talleresIds, ahora = calendario.ahoraUTC6()) {
    const cfg = await cargar();
    return calendario.minutosLaboralesRestantes(cfg, ahora, vencimiento, calendario.paisDeTalleres(cfg, talleresIds));
  }

  // Minutos de aviso (25% del plazo) y de «urgente» en la etiqueta del buzón.
  async umbralAvisoMinutos() {
    return (await cargar()).horasVencimiento * 60 * FRACCION_AVISO;
  }

  // Versión síncrona para armar el pipeline; null si la configuración aún no se cargó.
  minutosRestantesDeVale(vencimiento, talleresSolicitadosCsv, ahora = calendario.ahoraUTC6()) {
    const cfg = configCargada();
    if (!cfg) return null;
    return {
      minutos: calendario.minutosLaboralesRestantes(cfg, ahora, vencimiento, calendario.paisDeTalleres(cfg, idsDeCsv(talleresSolicitadosCsv))),
      umbralUrgente: cfg.horasVencimiento * 60 * FRACCION_AVISO
    };
  }

  async fechaMinimaEntrega(talleresIds, ahora = calendario.ahoraUTC6()) {
    return calendario.fechaMinimaEntrega(await cargar(), talleresIds, ahora);
  }

  // `diasMinimos`: 3 cuando el vale no es urgente (antelación mínima en días naturales); 0 con «urgente».
  // `diasHabiles`: antelación mínima en días que reciben vales, para las modificaciones (básica 1, media 2, avanzada 3; urgente 1).
  async fechasNoDisponibles(talleresIds, desde, hasta, diasMinimos = 0, ahora = calendario.ahoraUTC6(), diasHabiles = 0) {
    const cfg = await cargar();
    return {
      minima: calendario.fechaMinimaEntrega(cfg, talleresIds, ahora, diasMinimos, diasHabiles),
      horaMaxima: calendario.horaMaximaRestrictiva(cfg, talleresIds),
      noDisponibles: calendario.fechasNoDisponibles(cfg, talleresIds, desde, hasta, ahora, diasMinimos, diasHabiles)
    };
  }

  async validarFechaEntrega(fecha, talleresIds, diasMinimos = 0, ahora = calendario.ahoraUTC6(), diasHabiles = 0) {
    return calendario.validarFechaEntrega(await cargar(), fecha, talleresIds, ahora, diasMinimos, diasHabiles);
  }

  // Primera fecha de entrega posible de una modificación: el enésimo día que recibe vales contando desde hoy.
  async fechaMinimaModificacion(talleresIds, diasHabiles, ahora = calendario.ahoraUTC6()) {
    return calendario.fechaMinimaEntrega(await cargar(), talleresIds, ahora, 0, diasHabiles);
  }

  // Entrega de una modificación básica: el siguiente día que recibe vales desde el día de la solicitud (con la hora de corte del taller).
  async fechaMinimaModificacionBasica(talleresIds, ahora = calendario.ahoraUTC6()) {
    return calendario.fechaMinimaModificacionBasica(await cargar(), talleresIds, ahora);
  }

  async existenTalleres(talleresIds) {
    const cfg = await cargar();
    return talleresIds.every(id => cfg.talleres.has(id));
  }

  async horaMaximaRestrictiva(talleresIds) {
    return calendario.horaMaximaRestrictiva(await cargar(), talleresIds);
  }

  formatearDuracion(minutos) { return calendario.formatearDuracion(minutos); }
}

module.exports = new CalendarioService();
module.exports.calendario = calendario;
module.exports.idsDeCsv = idsDeCsv;
