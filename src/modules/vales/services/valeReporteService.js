// src/modules/vales/services/valeReporteService.js
// Pestaña «Reportes»: actividad de cada persona (y de su equipo) a partir de `vale_historial`. El alcance lo decide el
// servidor según el rol; el cliente solo pide un período y, si tiene gente a su cargo, evaluar a una o varias personas.
const reporteRepository = require('../repositories/reporteRepository');
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const tallerRepository = require('../repositories/tallerRepository');
const propuestaRepository = require('../repositories/propuestaRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const valeCatalogoService = require('./valeCatalogoService');
const valeBuzonService = require('./valeBuzonService');
const valeReporteGruposService = require('./valeReporteGruposService');
const { calcularPipeline } = require('./valePipeline');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const {
  ROL, ESTADOS, ESTADOS_TERMINALES, ESTADOS_TALLER, esDeTaller, hoyISO, enriquecer, enriquecerParaFila, esValeDeModificacion
} = require('./valeHelpers');

// El atraso del taller termina cuando entrega su propuesta (ver enriquecerParaFila).
const atrasadaEnSuTaller = (porId, fila) => { const v = porId.get(fila.vale_id); return !!v && enriquecerParaFila(v, fila).atrasado; };

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MAX_FILAS_PANTALLA = 100;
const MAX_FILAS_PDF = 500;
const MAX_PERSONAS = 50;

// Explicación de cada indicador, por rol (si un rol no define una clave, se usa la de `comunes`).
const AYUDAS_KPI = {
  comunes: {
    atrasadosAhora: 'Vales abiertos cuya fecha de entrega ya pasó. Es el estado de ahora mismo, sin importar el período elegido.'
  },
  administrador: {
    creados: 'Vales de arte creados en el período. No cuenta las solicitudes de modificación.',
    autorizados: 'Autorizaciones que los supervisores hicieron en el período (incluye las modificaciones autorizadas).',
    entregados: 'Propuestas que los diseñadores entregaron a revisión en el período. Si una se devuelve y se vuelve a entregar, cuenta otra vez.',
    cicloDias: 'Tiempo promedio entre la creación de un vale y su confirmación de recibido por el asesor, de los vales confirmados en el período.',
    tiempoProduccionH: 'Tiempo promedio desde que el diseñador comienza un vale hasta que entrega la propuesta, pausas incluidas, de las entregas del período.',
    sinPropuestaAhora: 'Vales abiertos que ya están en los talleres y todavía no tienen una propuesta adjunta. Es el estado de ahora mismo.'
  },
  supervisor: {
    creados: 'Vales creados en el período por tu equipo de ventas. No cuenta las solicitudes de modificación.',
    autorizados: 'Vales de tu equipo que se autorizaron en el período.',
    solicitudesMod: 'Solicitudes de modificación que tu equipo hizo en el período.'
  },
  asesor: {
    creados: 'Vales que creaste en el período. No cuenta las solicitudes de modificación.',
    autorizados: 'Tus vales que el supervisor autorizó en el período.',
    solicitudesMod: 'Solicitudes de modificación que hiciste en el período.'
  },
  encargado: {
    asignaciones: 'Veces que se asignó un vale a un diseñador de tu taller en el período.',
    entregados: 'Propuestas que los diseñadores de tu taller entregaron a revisión en el período.',
    aprobados: 'Propuestas de tu taller que se aprobaron en el período.',
    atrasadosAhora: 'Vales abiertos de tu taller cuya fecha de entrega ya pasó. Es el estado de ahora mismo.'
  },
  disenador: {
    comenzados: 'Vales que empezaste a trabajar en el período.',
    entregados: 'Propuestas que entregaste a revisión en el período.',
    aprobados: 'Entregas tuyas que el encargado aprobó en el período.',
    atrasadosAhora: 'Tus vales abiertos cuya fecha de entrega ya pasó. Es el estado de ahora mismo.'
  }
};
// Estados en los que el vale ya está en los talleres (se espera una propuesta).
const ESTADOS_CON_TALLER = ['CREADO', 'MODIFICADO', 'APROBADO_DEPARTAMENTO', 'PENDIENTE_CONFIRMACION'];
const ESTADOS_COLA_DISENADOR = [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA, ESTADOS_TALLER.EN_REVISION];

// ---- Fechas (todo en hora de Guatemala, como el resto del módulo) ----
const dos = n => String(n).padStart(2, '0');
function sumarDias(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function diasEntre(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}
const msDe = ts => new Date(`${String(ts).replace(' ', 'T')}-06:00`).getTime();
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

function rangoAnterior(r) {
  if (r.tipo === 'mes') {
    const fin = sumarDias(r.desde, -1);
    const [y, m] = fin.split('-').map(Number);
    return { tipo: 'mes', desde: `${y}-${dos(m)}-01`, hasta: fin };
  }
  const n = diasEntre(r.desde, r.hasta) + 1;
  return { tipo: r.tipo === 'hoy' ? 'dia' : r.tipo, desde: sumarDias(r.desde, -n), hasta: sumarDias(r.desde, -1) };
}

function etiquetaPeriodo(r) {
  if (r.tipo === 'mes') { const [y, m] = r.desde.split('-').map(Number); return `${MESES[m - 1]} ${y}`; }
  if (r.tipo === 'semana') return `Semana ${semanaIso(r.desde)} · ${fechaCorta(r.desde)} – ${fechaCorta(r.hasta)}`;
  if (r.desde === r.hasta) return r.desde === hoyISO() ? `Hoy · ${fechaCorta(r.desde)}` : fechaCorta(r.desde);
  return `${fechaCorta(r.desde)} – ${fechaCorta(r.hasta)}`;
}

const dentro = (fecha, r) => (!r.desde || fecha >= r.desde) && (!r.hasta || fecha <= r.hasta);
// Con entrega anterior al inicio del período (sin inicio, como «Todo», no hay nada anterior).
const antesDe = (fecha, r) => !!r.desde && fecha < r.desde;

// ---- Eventos: cada fila de historial se traduce a una acción con nombre ----
function clasificar(h) {
  const a = h.estado_anterior, n = h.estado_nuevo, accion = String(h.accion || '');
  if (h.taller_id) {
    if (a === 'PENDIENTE_ASIGNACION' && n === 'ASIGNADO') return 'asignacion';
    if (a === 'EN_REVISION' && n === 'ASIGNADO') return 'devolucion';
    if (a === 'ASIGNADO' && n === 'EN_PROCESO') return 'comienzo';
    if (a === 'EN_PROCESO' && n === 'EN_REVISION') return /entreg/i.test(accion) ? 'entrega' : null; // cancelar no cuenta
    if (a === 'EN_REVISION' && n === 'APROBADO') return 'aprobacion';
    return null;
  }
  if (a == null && n === 'ESPERANDO_AUTORIZACION') return 'creacion';
  if (a == null && n === 'SOLICITANDO_MODIFICACION') return 'solicitud_mod';
  if (n === 'RECHAZADO') return 'rechazo';
  if (a === 'RECHAZADO') return 'reenvio';
  if (a === 'ESPERANDO_AUTORIZACION' && n === 'CREADO') return 'autorizacion';
  if (a === 'SOLICITANDO_MODIFICACION' && n === 'MODIFICADO') return 'autorizacion';
  if (n === 'RECIBIDO' && /^Asesor confirm/i.test(accion)) return 'confirmacion';
  if (a === 'APROBADO_DEPARTAMENTO' && n === 'PENDIENTE_CONFIRMACION') return 'fusion';
  return null;
}

const TIPOS_DEL_DISENADOR_COMO_ACTOR = ['comienzo', 'entrega'];
const TIPOS_DEL_DISENADOR_COMO_DESTINO = ['asignacion', 'aprobacion', 'devolucion'];

function normalizar(h) {
  const tipo = clasificar(h);
  if (!tipo) return null;
  let persona = null;
  if (TIPOS_DEL_DISENADOR_COMO_ACTOR.includes(tipo)) persona = h.usuario_id;
  else if (TIPOS_DEL_DISENADOR_COMO_DESTINO.includes(tipo)) persona = h.disenador_id;
  return {
    id: h.id, valeId: h.vale_id, tipo, actor: h.usuario_id, persona, tallerId: h.taller_id || null,
    asesorId: h.asesor_id ?? null, tiendaId: h.tienda_id ?? null,
    ts: h.creado_en, ms: msDe(h.creado_en), fecha: String(h.creado_en).slice(0, 10),
    entregaMs: h.fecha_entrega ? msDe(h.fecha_entrega) : null
  };
}

// Empareja acciones consecutivas de un mismo vale para medir tiempos.
function emparejar(historial, infoVales) {
  // `personaDevolucion`: una devolución cuenta para quien entregó el trabajo devuelto, aunque se reasigne a otro.
  const pares = { autorizacion: [], ciclo: [], produccion: [], revision: [], personaDevolucion: new Map() };
  const porVale = new Map();
  historial.forEach(e => { if (!porVale.has(e.valeId)) porVale.set(e.valeId, []); porVale.get(e.valeId).push(e); });
  for (const [valeId, lista] of porVale) {
    const info = infoVales.get(valeId) || {};
    let esperaAutorizacion = null, inicioCiclo = null;
    const produccion = new Map(), revision = new Map();
    const dar = (e) => ({
      ...e, asesorId: e.asesorId ?? info.asesorId ?? null, tiendaId: e.tiendaId ?? info.tiendaId ?? null, entregaMs: e.entregaMs ?? info.entregaMs ?? null
    });
    for (const raw of lista) {
      const e = dar(raw);
      switch (e.tipo) {
        case 'creacion': case 'solicitud_mod': esperaAutorizacion = e; inicioCiclo = e; break;
        case 'reenvio': esperaAutorizacion = e; break;
        case 'autorizacion': case 'rechazo':
          if (esperaAutorizacion) { pares.autorizacion.push({ inicio: esperaAutorizacion, fin: e }); esperaAutorizacion = null; }
          break;
        case 'confirmacion': if (inicioCiclo) pares.ciclo.push({ inicio: inicioCiclo, fin: e }); break;
        case 'comienzo': produccion.set(e.tallerId, e); break;
        case 'entrega':
          if (produccion.has(e.tallerId)) { pares.produccion.push({ inicio: produccion.get(e.tallerId), fin: e }); produccion.delete(e.tallerId); }
          revision.set(e.tallerId, e);
          break;
        case 'aprobacion': case 'devolucion':
          if (revision.has(e.tallerId)) {
            const entrega = revision.get(e.tallerId);
            if (e.tipo === 'devolucion') { e.persona = entrega.persona; pares.personaDevolucion.set(e.id, entrega.persona); }
            pares.revision.push({ inicio: entrega, fin: e });
            revision.delete(e.tallerId);
          }
          break;
        default: break;
      }
    }
  }
  return pares;
}

const promedio = lista => (lista.length ? lista.reduce((s, x) => s + x, 0) / lista.length : null);
const porcentaje = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : null);
const horasDe = p => (p.fin.ms - p.inicio.ms) / 3600000;

// Indicadores de un conjunto de eventos del período (ya filtrados por persona/alcance) y de sus pares.
function indicadores(eventos, pares, rango) {
  const n = tipo => eventos.filter(e => e.tipo === tipo).length;
  const delPeriodo = lista => lista.filter(p => dentro(p.fin.fecha, rango));
  const entregas = eventos.filter(e => e.tipo === 'entrega' && e.entregaMs);
  const confirmaciones = eventos.filter(e => e.tipo === 'confirmacion' && e.entregaMs);
  return {
    creados: n('creacion'), solicitudesMod: n('solicitud_mod'), reenvios: n('reenvio'),
    autorizados: n('autorizacion'), rechazados: n('rechazo'), confirmados: n('confirmacion'),
    asignaciones: n('asignacion'), comenzados: n('comienzo'), entregados: n('entrega'),
    aprobados: n('aprobacion'), devueltos: n('devolucion'), fusiones: n('fusion'),
    tiempoAutorizacionH: promedio(delPeriodo(pares.autorizacion).map(horasDe)),
    cicloDias: promedio(delPeriodo(pares.ciclo).map(p => horasDe(p) / 24)),
    tiempoProduccionH: promedio(delPeriodo(pares.produccion).map(horasDe)),
    tiempoRevisionH: promedio(delPeriodo(pares.revision).map(horasDe)),
    entregasATiempoPct: porcentaje(entregas.filter(e => e.ms <= e.entregaMs).length, entregas.length),
    confirmadosATiempoPct: porcentaje(confirmaciones.filter(e => e.ms <= e.entregaMs).length, confirmaciones.length)
  };
}

const filtrarPares = (pares, pred) => ({
  autorizacion: pares.autorizacion.filter(p => pred(p.fin)),
  ciclo: pares.ciclo.filter(p => pred(p.fin)),
  produccion: pares.produccion.filter(p => pred(p.fin)),
  revision: pares.revision.filter(p => pred(p.fin))
});

// ---- Alcance por rol ----
const AGRUPACIONES_GLOBAL = ['tienda', 'taller', 'asesor', 'disenador'];

async function resolverAlcance(usuario) {
  switch (usuario.rolId) {
    case ROL.ADMINISTRADOR:
      return { rol: 'administrador', equipo: true, agrupaciones: AGRUPACIONES_GLOBAL };
    case ROL.ASESOR:
      return { rol: 'asesor', equipo: false, asesorIds: [usuario.id], personas: [] };
    case ROL.SUPERVISOR: {
      const asesores = await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id);
      const tiendas = await reporteRepository.listarTiendasPorSupervisor(usuario.id);
      const tallerIdsVisibles = (await tallerRepository.listarIdsPorSupervisor(usuario.id)).map(t => t.id);
      // Él también crea vales: aparece como «(yo)» junto a sus asesores.
      const personas = [{ id: usuario.id, nombre: `${usuario.nombre} (yo)` }, ...asesores.filter(a => a.id !== usuario.id).map(a => ({ id: a.id, nombre: a.nombre }))];
      return {
        rol: 'supervisor', equipo: true, agrupaciones: ['asesor'],
        asesorIds: [...new Set([...asesores.map(a => a.id), usuario.id])],
        tiendas, tiendaIds: tiendas.map(t => t.id), tallerIdsVisibles, personas
      };
    }
    case ROL.DISENADOR:
      return { rol: 'disenador', equipo: false, valesDeDisenadorId: usuario.id, personas: [] };
    default:
      if (esDeTaller(usuario)) {
        const idEfectivo = await valeCatalogoService.idEncargadoEfectivo(usuario);
        const talleres = (await tallerRepository.listarActivos()).filter(t => t.encargado_id === idEfectivo);
        const disenadores = await usuarioValeRepository.listarDisenadoresPorEncargado(idEfectivo);
        return {
          rol: 'encargado', equipo: true, agrupaciones: ['disenador'], tallerIds: talleres.map(t => t.id), actorId: usuario.id,
          personas: [{ id: usuario.id, nombre: `${usuario.nombre} (yo)` }, ...disenadores.map(d => ({ id: d.id, nombre: d.nombre }))]
        };
      }
      // La ruta ya exige `vales.ver_reportes`: quien llega aquí sin alcance propio (p. ej. el Gerente) ve todo el sistema, solo lectura.
      return { rol: 'administrador', equipo: true, soloLectura: true, agrupaciones: AGRUPACIONES_GLOBAL };
  }
}

const PERSONA_EN_EVENTO = { asesor: e => e.asesorId, disenador: e => e.persona };

class ValeReporteService {
  async obtenerReporte(usuario, filtros = {}, { maxFilas = MAX_FILAS_PANTALLA } = {}) {
    const ventana = resolverVentanaReporte(filtros);
    const rango = rangoDe(ventana);
    const anterior = rangoAnterior(rango);
    const alcance = await resolverAlcance(usuario);
    const entero = v => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
    const lista = v => [...new Set(String(v ?? '').split(',').map(entero).filter(Boolean))].slice(0, MAX_PERSONAS);
    const tiendaId = alcance.equipo ? entero(filtros.tiendaId) : null;
    const tallerId = alcance.equipo ? entero(filtros.tallerId) : null;
    if (alcance.equipo && filtros.agruparPor && !alcance.agrupaciones.includes(filtros.agruparPor)) throw new ErrorDeNegocio('Esa agrupación no está disponible para tu rol.');
    if (alcance.rol === 'encargado') {
      if (tallerId && !alcance.tallerIds.includes(tallerId)) throw new ErrorDeNegocio('Ese taller no está a tu cargo.');
      if (tiendaId || lista(filtros.asesorIds).length) throw new ErrorDeNegocio('Ese filtro no está disponible para tu rol.');
    }
    if (alcance.rol === 'supervisor') {
      if (tiendaId && !alcance.tiendaIds.includes(tiendaId)) throw new ErrorDeNegocio('Esa tienda no está a tu cargo.');
      if (tallerId && !alcance.tallerIdsVisibles.includes(tallerId)) throw new ErrorDeNegocio('Ese taller no está a tu cargo.');
      if (lista(filtros.disenadorIds).length) throw new ErrorDeNegocio('Ese filtro no está disponible para tu rol.');
    }
    // Quién se evalúa: asesores y diseñadores (el parámetro anterior `personaIds` se sigue aceptando).
    const asesorSel = new Set(lista(filtros.asesorIds));
    const disSel = new Set(lista(filtros.disenadorIds));
    lista(filtros.personaIds).forEach(id => (alcance.rol === 'encargado' ? disSel : asesorSel).add(id));
    const propias = new Set((alcance.personas || []).map(p => p.id));
    if (alcance.rol === 'supervisor' && [...asesorSel].some(id => !propias.has(id))) throw new ErrorDeNegocio('Esa persona no está a tu cargo.');
    if (alcance.rol === 'encargado' && [...disSel].some(id => !propias.has(id))) throw new ErrorDeNegocio('Esa persona no está a tu cargo.');
    if (!alcance.equipo) { asesorSel.clear(); disSel.clear(); }
    const personaIds = alcance.rol === 'supervisor' ? asesorSel : (alcance.rol === 'encargado' ? disSel : new Set());
    const evaluados = (await reporteRepository.listarNombres([...asesorSel, ...disSel])).map(u => ({ id: u.id, nombre: valeReporteGruposService.etiquetaNombre(u.nombre, u.rol_id, u.hereda_de_rol_id) }));

    // Un solo viaje a la base cubre el período y el anterior; después se reparte por fecha.
    const desdeCarga = (anterior || rango).desde;
    const crudos = await reporteRepository.listarEventos({
      desde: desdeCarga ? `${desdeCarga} 00:00:00` : null,
      hasta: rango.hasta ? `${rango.hasta} 23:59:59` : null,
      asesorIds: alcance.asesorIds || null,
      tallerIds: alcance.tallerIds || null,
      actorId: alcance.actorId || null,
      valesDeDisenadorId: alcance.valesDeDisenadorId || null,
      tiendaId, tallerId
    });
    const normalizados = crudos.map(normalizar).filter(Boolean);
    const valeIds = [...new Set(crudos.map(h => h.vale_id))];
    const historialCrudo = await reporteRepository.listarHistorialDeVales(valeIds);
    const infoVales = new Map(crudos.map(h => [h.vale_id, { asesorId: h.asesor_id, tiendaId: h.tienda_id, entregaMs: h.fecha_entrega ? msDe(h.fecha_entrega) : null }]));
    const historial = historialCrudo.map(normalizar).filter(Boolean);
    const paresTodos = emparejar(historial, infoVales);
    normalizados.forEach(e => { if (e.tipo === 'devolucion' && paresTodos.personaDevolucion.has(e.id)) e.persona = paresTodos.personaDevolucion.get(e.id); });

    // Qué eventos son «de» esta persona o alcance.
    const esDelAlcance = (e) => {
      if (alcance.rol === 'disenador') return e.persona === usuario.id;
      if (alcance.rol === 'encargado') return true; // el SQL ya lo acotó a su taller (y a su propia actividad)
      return true;
    };
    // Con un diseñador elegido (y sin ser el encargado, que ya se acota por persona) se miden los vales en los que trabajó.
    const valesDeDisenadores = new Set(disSel.size && alcance.rol !== 'encargado' ? normalizados.filter(e => disSel.has(e.persona)).map(e => e.valeId) : []);
    const dePersona = (e) => {
      if (asesorSel.size && !asesorSel.has(e.asesorId)) return false;
      if (disSel.size) {
        if (alcance.rol === 'encargado') return disSel.has(e.persona) || (e.tipo === 'fusion' && disSel.has(e.actor));
        return valesDeDisenadores.has(e.valeId);
      }
      return true;
    };
    const aplicable = e => esDelAlcance(e) && dePersona(e);
    const eventosPeriodo = normalizados.filter(e => dentro(e.fecha, rango) && aplicable(e));
    const eventosAnterior = anterior ? normalizados.filter(e => dentro(e.fecha, anterior) && aplicable(e)) : [];
    const paresAplicables = filtrarPares(paresTodos, aplicable);

    const ind = indicadores(eventosPeriodo, paresAplicables, rango);
    const indAnt = anterior ? indicadores(eventosAnterior, paresAplicables, anterior) : null;

    // Estado de hoy (no depende del período): cola de trabajo, abiertos y atrasados.
    const todos = (await valeRepository.listarTodos()).map(enriquecer);
    const porId = new Map(todos.map(v => [v.id, v]));
    const filasTaller = await valeTallerRepository.listarTodos();
    const ahora = await this._instantanea(alcance, usuario, { todos, porId, filasTaller, personaIds, asesorSel, disSel, tiendaId, tallerId });

    const kpis = await this._armarKpis(alcance, usuario, ind, indAnt, ahora, eventosPeriodo, rango);
    // Quienes ven a varias personas reciben la tabla unificada (personas con sus vales); asesor y diseñador, su listado simple.
    let tablas = [];
    let vales = null;
    let grupos = null;
    let atrasadosVigentes = null;
    if (alcance.equipo) {
      const agruparPor = valeReporteGruposService.agrupacionValida(filtros.agruparPor, alcance.agrupaciones.includes('asesor') ? 'asesor' : alcance.agrupaciones[0]);
      const argumentos = {
        alcance, dentroDelRango: (f) => dentro(f, rango), agruparPor, tiendaId, tallerId, asesorSel, disSel
      };
      grupos = await valeReporteGruposService.armar(argumentos);
      atrasadosVigentes = await valeReporteGruposService.armar({ ...argumentos, soloAtrasadosAntesDe: (f) => antesDe(f, rango) });
      // Contador «Atrasados sin entregar»: los vencidos de la ventana sin aprobar (ya contados) más los que se arrastran de antes de la ventana.
      if (grupos.indicadoresTaller) grupos.indicadoresTaller.atrasadosSinEntregar += atrasadosVigentes.sinEntregar || 0;
    } else {
      const nombres = await this._nombres(alcance, normalizados);
      tablas = await this._tablas(alcance, eventosPeriodo, paresAplicables, rango, { todos, filasTaller, nombres, personaIds });
      vales = await this._listado(alcance, usuario, { porId, filasTaller, nombres, maxFilas, dentroDelRango: (f) => dentro(f, rango) });
      atrasadosVigentes = await this._atrasadosVigentesSimple(alcance, usuario, { porId, filasTaller, antesDelPeriodo: (f) => antesDe(f, rango) });
    }

    const opcionesFiltro = await this._opcionesDeFiltro(alcance, usuario);
    return {
      rol: alcance.rol,
      alcance: alcance.equipo ? (alcance.rol === 'administrador' ? 'global' : 'equipo') : 'propio',
      titulo: this._titulo(alcance, evaluados),
      evaluados,
      periodo: { ...rango, etiqueta: etiquetaPeriodo(rango), titulo: `Fecha de entrega: ${etiquetaPeriodo(rango)}`, anterior: anterior ? etiquetaPeriodo(anterior) : null },
      kpis, tablas, vales, grupos, atrasadosVigentes,
      resumenFiltros: grupos ? this._resumenFiltros(grupos.agruparPor, opcionesFiltro, { tiendaId, tallerId }) : [],
      filtros: opcionesFiltro
    };
  }

  // Texto de los filtros activos para el encabezado del PDF.
  _resumenFiltros(agruparPor, opciones, { tiendaId, tallerId }) {
    const nombre = (lista, id) => ((lista || []).find(o => o.id === id) || {}).nombre;
    const etiqueta = { asesor: 'asesor', disenador: 'diseñador', taller: 'taller', tienda: 'tienda' }[agruparPor];
    return [
      `Agrupado por ${etiqueta}`,
      ...(tiendaId ? [`Tienda: ${nombre(opciones.tiendas, tiendaId) || tiendaId}`] : []),
      ...(tallerId ? [`Taller: ${nombre(opciones.talleres, tallerId) || tallerId}`] : [])
    ];
  }

  _titulo(alcance, evaluados) {
    const base = {
      administrador: 'Actividad de todo el sistema', asesor: 'Mi actividad de ventas', supervisor: 'Actividad de mi equipo de ventas',
      encargado: 'Actividad de mi taller', disenador: 'Mi actividad de diseño'
    }[alcance.rol];
    if (!evaluados.length) return base;
    if (evaluados.length === 1) return `${base} · ${evaluados[0].nombre}`;
    return `${base} · ${evaluados.length} ${alcance.rol === 'encargado' ? 'personas' : 'asesores'}`;
  }

  // ---- Fotografía de hoy ----
  async _instantanea(alcance, usuario, { todos, porId, filasTaller, personaIds, asesorSel = new Set(), disSel = new Set(), tiendaId, tallerId }) {
    const abierto = v => !ESTADOS_TERMINALES.includes(v.estado);
    if (alcance.rol === 'disenador') {
      const mias = filasTaller.filter(f => f.disenador_id === usuario.id && ESTADOS_COLA_DISENADOR.includes(f.estado));
      return {
        asignadosAhora: mias.filter(f => f.estado === ESTADOS_TALLER.ASIGNADO).length,
        enProcesoAhora: mias.filter(f => [ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA].includes(f.estado)).length,
        atrasadosAhora: mias.filter(f => atrasadaEnSuTaller(porId, f)).length
      };
    }
    if (alcance.rol === 'encargado') {
      const enTaller = filasTaller.filter(f => alcance.tallerIds.includes(f.taller_id) && f.estado !== ESTADOS_TALLER.APROBADO
        && (!personaIds.size || personaIds.has(f.disenador_id)));
      return {
        porRevisarAhora: enTaller.filter(f => f.estado === ESTADOS_TALLER.EN_REVISION).length,
        enColaAhora: enTaller.length,
        atrasadosAhora: enTaller.filter(f => atrasadaEnSuTaller(porId, f)).length
      };
    }
    let propios = todos.filter(abierto);
    if (alcance.asesorIds) propios = propios.filter(v => alcance.asesorIds.includes(v.asesor_id));
    if (personaIds.size && alcance.rol === 'supervisor') propios = propios.filter(v => personaIds.has(v.asesor_id));
    if (asesorSel.size && alcance.rol !== 'supervisor') propios = propios.filter(v => asesorSel.has(v.asesor_id));
    if (disSel.size && alcance.rol !== 'encargado') {
      const idsVale = new Set(filasTaller.filter(f => disSel.has(f.disenador_id)).map(f => f.vale_id));
      propios = propios.filter(v => idsVale.has(v.id));
    }
    if (tiendaId) propios = propios.filter(v => v.tienda_id === tiendaId);
    if (tallerId) {
      const ids = new Set(filasTaller.filter(f => f.taller_id === tallerId).map(f => f.vale_id));
      propios = propios.filter(v => ids.has(v.id));
    }
    // Vales abiertos que ya están en los talleres y todavía no tienen propuesta adjunta.
    const esperanPropuesta = propios.filter(v => ESTADOS_CON_TALLER.includes(v.estado));
    const conPropuesta = await propuestaRepository.listarUltimasPorVales(esperanPropuesta.map(v => v.id));
    const sinPropuestaAhora = esperanPropuesta.filter(v => !v.propuesta_general_url && !conPropuesta.has(v.id)).length;
    return { abiertosAhora: propios.length, atrasadosAhora: propios.filter(v => v.atrasado).length, sinPropuestaAhora };
  }

  // Cada indicador lleva su explicación (`ayuda`), que la pantalla muestra en el ícono de información de la tarjeta.
  async _armarKpis(alcance, usuario, ind, indAnt, ahora, eventos, rango) {
    const kpis = await this._kpisBase(alcance, usuario, ind, indAnt, ahora, eventos, rango);
    const ayudas = AYUDAS_KPI[alcance.rol] || AYUDAS_KPI.administrador;
    return kpis.map(k => ({ ...k, ayuda: ayudas[k.clave] || AYUDAS_KPI.comunes[k.clave] || k.ayuda || null }));
  }

  async _kpisBase(alcance, usuario, ind, indAnt, ahora, eventos, rango) {
    const k = (clave, label, formato, extra = {}) => ({
      clave, label, formato, valor: ind[clave] ?? ahora[clave] ?? null, anterior: indAnt ? (indAnt[clave] ?? null) : null, ...extra
    });
    const instantaneo = (clave, label, extra = {}) => ({ clave, label, formato: 'num', valor: ahora[clave] ?? 0, anterior: null, instantaneo: true, ...extra });
    switch (alcance.rol) {
      case 'disenador':
        return [
          k('comenzados', 'Vales comenzados', 'num'), k('entregados', 'Propuestas entregadas', 'num'),
          k('aprobados', 'Aprobados por el encargado', 'num'), instantaneo('atrasadosAhora', 'Atrasados ahora', { malo: true })
        ];
      case 'asesor':
      case 'supervisor':
        return [
          k('creados', 'Vales creados', 'num'), k('autorizados', 'Autorizados', 'num'),
          k('solicitudesMod', 'Modificaciones solicitadas', 'num')
        ];
      case 'encargado':
        return [
          k('asignaciones', 'Asignaciones hechas', 'num'), k('entregados', 'Propuestas recibidas', 'num'),
          k('aprobados', 'Aprobados', 'num'), instantaneo('atrasadosAhora', 'Atrasados ahora', { malo: true })
        ];
      default:
        return [
          k('creados', 'Vales creados', 'num'), k('autorizados', 'Autorizados', 'num'), k('entregados', 'Propuestas entregadas', 'num'),
          k('cicloDias', 'Ciclo completo (crear → confirmar)', 'dias', { menorEsMejor: true }),
          k('tiempoProduccionH', 'Tiempo de producción', 'horas', { menorEsMejor: true }),
          instantaneo('sinPropuestaAhora', 'Sin propuesta', { malo: true, ayuda: 'Vales abiertos en los talleres sin propuesta adjunta.' }),
          instantaneo('atrasadosAhora', 'Atrasados ahora', { malo: true })
        ];
    }
  }

  async _nombres(alcance, normalizados) {
    const ids = new Set();
    normalizados.forEach(e => { [e.actor, e.persona, e.asesorId].forEach(i => { if (i) ids.add(i); }); });
    (alcance.personas || []).forEach(p => ids.add(p.id));
    const filas = await reporteRepository.listarNombres([...ids]);
    return new Map(filas.map(f => [f.id, f.nombre]));
  }

  // ---- Tablas por persona ----
  async _tablas(alcance, eventos, pares, rango, { todos, filasTaller, nombres, personaIds }) {
    const nombre = id => nombres.get(id) || `#${id}`;
    const tablas = [];
    const columnasAsesor = [
      { clave: 'creados', label: 'Creados', formato: 'num' }, { clave: 'autorizados', label: 'Autorizados', formato: 'num' },
      { clave: 'solicitudesMod', label: 'Modificaciones', formato: 'num' }
    ];
    const unico = personaIds.size === 1; // con una sola persona las tarjetas ya son las suyas
    const columnasDisenador = [
      { clave: 'comenzados', label: 'Comenzados', formato: 'num' }, { clave: 'entregados', label: 'Entregados', formato: 'num' },
      { clave: 'aprobados', label: 'Aprobados', formato: 'num' }, { clave: 'atrasados', label: 'Atrasados', formato: 'num' }
    ];

    if (['supervisor', 'administrador'].includes(alcance.rol)) {
      const ids = new Set(eventos.map(e => e.asesorId).filter(Boolean));
      personaIds.forEach(id => ids.add(id));
      const filas = [...ids].map(id => {
        const ind = indicadores(eventos.filter(e => e.asesorId === id), { autorizacion: [], ciclo: [], produccion: [], revision: [] }, rango);
        return { id, nombre: nombre(id), creados: ind.creados, autorizados: ind.autorizados, solicitudesMod: ind.solicitudesMod };
      }).filter(f => f.creados || f.autorizados || f.solicitudesMod)
        .sort((a, b) => b.creados - a.creados || a.nombre.localeCompare(b.nombre));
      if (!unico) tablas.push({ clave: 'asesores', titulo: 'Por asesor', columnas: columnasAsesor, filas });
    }

    if (['encargado', 'administrador'].includes(alcance.rol)) {
      const base = alcance.rol === 'encargado' ? (personaIds.size ? [...personaIds] : alcance.personas.map(p => p.id)) : [];
      const ids = new Set(base);
      eventos.forEach(e => { if (e.persona) ids.add(e.persona); });
      const filas = [...ids].map(id => {
        const ev = eventos.filter(e => e.persona === id);
        const ind = indicadores(ev, filtrarPares(pares, e => e.persona === id), rango);
        const cola = filasTaller.filter(f => f.disenador_id === id && ESTADOS_COLA_DISENADOR.includes(f.estado)
          && (alcance.rol !== 'encargado' || alcance.tallerIds.includes(f.taller_id)));
        return {
          id, nombre: alcance.rol === 'encargado' && id === (alcance.actorId) ? `${nombre(id)} (yo)` : nombre(id), ...ind, cola: cola.length,
          atrasados: cola.filter(f => (todos.find(v => v.id === f.vale_id) || {}).atrasado).length
        };
      }).filter(f => f.comenzados || f.entregados || f.aprobados || f.devueltos || f.cola)
        .sort((a, b) => b.entregados - a.entregados || a.nombre.localeCompare(b.nombre));
      if (!(alcance.rol === 'encargado' && unico)) tablas.push({ clave: 'disenadores', titulo: 'Por diseñador', columnas: columnasDisenador, filas });
    }

    if (alcance.rol === 'administrador') {
      const talleres = await tallerRepository.listarTodos();
      const porTaller = new Map();
      eventos.filter(e => e.tallerId).forEach(e => { if (!porTaller.has(e.tallerId)) porTaller.set(e.tallerId, []); porTaller.get(e.tallerId).push(e); });
      tablas.push({
        clave: 'talleres', titulo: 'Por taller',
        columnas: [
          { clave: 'asignaciones', label: 'Asignaciones', formato: 'num' }, { clave: 'entregados', label: 'Entregados', formato: 'num' },
          { clave: 'aprobados', label: 'Aprobados', formato: 'num' }, { clave: 'devueltos', label: 'Devueltos', formato: 'num' },
          { clave: 'tiempoProduccionH', label: 'Tiempo prod.', formato: 'horas' }
        ],
        filas: [...porTaller.entries()].map(([id, ev]) => ({
          id, nombre: (talleres.find(t => t.id === id) || {}).nombre || `Taller ${id}`,
          ...indicadores(ev, filtrarPares(pares, e => e.tallerId === id), rango)
        })).sort((a, b) => b.entregados - a.entregados || a.nombre.localeCompare(b.nombre))
      });
      const porTienda = new Map();
      eventos.filter(e => e.tiendaId).forEach(e => { if (!porTienda.has(e.tiendaId)) porTienda.set(e.tiendaId, []); porTienda.get(e.tiendaId).push(e); });
      const tiendas = await reporteRepository.listarTiendas();
      tablas.push({
        clave: 'tiendas', titulo: 'Por tienda',
        columnas: [
          { clave: 'creados', label: 'Creados', formato: 'num' }, { clave: 'autorizados', label: 'Autorizados', formato: 'num' },
          { clave: 'rechazados', label: 'Rechazados', formato: 'num' }, { clave: 'confirmados', label: 'Confirmados', formato: 'num' },
          { clave: 'cicloDias', label: 'Ciclo', formato: 'dias' }
        ],
        filas: [...porTienda.entries()].map(([id, ev]) => ({
          id, nombre: (tiendas.find(t => t.id === id) || {}).nombre || `Tienda ${id}`,
          ...indicadores(ev, filtrarPares(pares, e => e.tiendaId === id), rango)
        })).sort((a, b) => b.creados - a.creados || a.nombre.localeCompare(b.nombre))
      });
    }
    return tablas;
  }

  // Atrasados vigentes de un Asesor o Diseñador: sus vales abiertos y atrasados con entrega fuera del período.
  async _atrasadosVigentesSimple(alcance, usuario, { porId, filasTaller, antesDelPeriodo }) {
    const mios = alcance.rol === 'disenador' ? new Set(filasTaller.filter(f => f.disenador_id === usuario.id).map(f => f.vale_id)) : null;
    // Al Diseñador no le cuenta un vale que su Encargado ya aprobó (su atraso terminó ahí).
    const aprobadoPorSuTaller = (valeId) => {
      const propias = filasTaller.filter(f => f.vale_id === valeId && f.disenador_id === usuario.id);
      return propias.length > 0 && propias.every(f => f.estado === ESTADOS_TALLER.APROBADO);
    };
    const candidatos = [...porId.values()]
      .filter(v => v.atrasado && !ESTADOS_TERMINALES.includes(v.estado) && antesDelPeriodo(String(v.fecha_entrega).slice(0, 10)))
      .filter(v => (mios ? mios.has(v.id) && !aprobadoPorSuTaller(v.id) : v.asesor_id === usuario.id));
    const conTaller = await valeBuzonService._enriquecerConTaller(candidatos);
    const vales = conTaller
      .map(v => ({
        id: v.id, correlativo: v.correlativo, cliente: v.cliente_nombre, esMod: esValeDeModificacion(v), fechaEntrega: String(v.fecha_entrega).slice(0, 10),
        atrasado: true, diasAtraso: v.diasAtraso, estado: v.estado, pipeline: calcularPipeline(v, { rolId: ROL.ADMINISTRADOR }), responsable: ''
      }))
      .sort((a, b) => (b.diasAtraso || 0) - (a.diasAtraso || 0));
    return { total: vales.length, truncado: vales.length > 200, vales: vales.slice(0, 200) };
  }

  // ---- Listado de vales con entrega en el período (Asesor y Diseñador), con sus hitos ----
  async _listado(alcance, usuario, { porId, filasTaller, nombres, maxFilas, dentroDelRango }) {
    const enRango = (v) => dentroDelRango(String(v.fecha_entrega).slice(0, 10));
    const mios = alcance.rol === 'disenador' ? new Set(filasTaller.filter(f => f.disenador_id === usuario.id).map(f => f.vale_id)) : null;
    const ids = [...porId.values()]
      .filter(v => enRango(v) && (mios ? mios.has(v.id) : v.asesor_id === usuario.id))
      .map(v => v.id);
    const vales = await reporteRepository.listarValesPorIds(ids);
    const resumen = new Map(vales.map(v => [v.id, enriquecer(v)]));
    const historial = (await reporteRepository.listarHistorialDeVales(ids)).map(normalizar).filter(Boolean);
    const pares = emparejar(historial, new Map(vales.map(v => [v.id, { asesorId: v.asesor_id, tiendaId: v.tienda_id, entregaMs: v.fecha_entrega ? msDe(v.fecha_entrega) : null }])));
    const historialPorVale = new Map();
    historial.forEach(e => { if (!historialPorVale.has(e.valeId)) historialPorVale.set(e.valeId, []); historialPorVale.get(e.valeId).push(e); });
    const ultimo = (lista, tipos, pred = () => true) => {
      const e = [...lista].reverse().find(x => tipos.includes(x.tipo) && pred(x));
      return e ? e.ts : null;
    };
    const esDiseno = ['disenador', 'encargado'].includes(alcance.rol);
    const propioDiseno = (e) => (alcance.rol === 'disenador' ? e.persona === usuario.id : (alcance.tallerIds ? alcance.tallerIds.includes(e.tallerId) : true));

    const filas = ids.map(id => {
      const v = resumen.get(id);
      if (!v) return null;
      const h = historialPorVale.get(id) || [];
      // Diseñador y Encargado: el atraso termina cuando su taller entrega la propuesta.
      const filaPropia = esDiseno
        ? filasTaller.find(f => f.vale_id === id && f.atraso_congelado_en && (alcance.rol === 'disenador' ? f.disenador_id === usuario.id : (alcance.tallerIds || []).includes(f.taller_id)))
        : null;
      const atraso = filaPropia ? enriquecerParaFila(v, filaPropia) : v;
      const base = {
        id, correlativo: v.correlativo, cliente: v.cliente_nombre, asesor: nombres.get(v.asesor_id) || `#${v.asesor_id}`,
        fechaEntrega: String(v.fecha_entrega).slice(0, 10), estado: v.estado, esMod: esValeDeModificacion(v),
        atrasado: atraso.atrasado, diasAtraso: atraso.diasAtraso
      };
      if (esDiseno) {
        const del = h.filter(propioDiseno);
        const par = [...pares.produccion].reverse().find(p => p.fin.valeId === id && propioDiseno(p.fin));
        return {
          ...base, asignado: ultimo(del, ['asignacion']), comenzado: ultimo(del, ['comienzo']), entregado: ultimo(del, ['entrega']),
          aprobado: ultimo(del, ['aprobacion']), devuelto: ultimo(del, ['devolucion']), tiempoProduccionH: par ? horasDe(par) : null
        };
      }
      return {
        ...base, creado: ultimo(h, ['creacion']), autorizado: ultimo(h, ['autorizacion']), modificacion: ultimo(h, ['solicitud_mod'])
      };
    }).filter(Boolean).sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega) || a.correlativo.localeCompare(b.correlativo));

    // Sección de cada vale: atrasado (abierto) > entregado > no entregado. Entregado: para el Diseñador, su propuesta ya salió a revisión;
    // para el Asesor, el vale ya llegó a él.
    const ENTREGADA = [ESTADOS_TALLER.APROBADO]; // entregado = aprobado por el Encargado
    const LLEGO_AL_ASESOR = [ESTADOS.PENDIENTE_CONFIRMACION, ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO];
    filas.forEach(f => {
      const propias = alcance.rol === 'disenador' ? filasTaller.filter(x => x.vale_id === f.id && x.disenador_id === usuario.id) : [];
      const entregado = alcance.rol === 'disenador' ? (propias.length > 0 && propias.every(x => ENTREGADA.includes(x.estado))) : LLEGO_AL_ASESOR.includes(f.estado);
      // El atraso del Diseñador corre hasta que su Encargado aprueba (en revisión sigue contando).
      const aprobadoPorSuTaller = alcance.rol === 'disenador' && propias.length > 0 && propias.every(x => x.estado === ESTADOS_TALLER.APROBADO);
      const abierto = !ESTADOS_TERMINALES.includes(f.estado) && !aprobadoPorSuTaller;
      f.seccion = f.atrasado && abierto ? 'atrasados' : (entregado ? 'entregados' : 'noEntregados');
    });
    const ordenSecciones = ['atrasados', 'noEntregados', 'entregados'];
    // Atrasados: el más atrasado primero; el resto, por fecha de entrega.
    filas.sort((a, b) => ordenSecciones.indexOf(a.seccion) - ordenSecciones.indexOf(b.seccion)
      || (a.seccion === 'atrasados' ? (b.diasAtraso || 0) - (a.diasAtraso || 0) : 0)
      || a.fechaEntrega.localeCompare(b.fechaEntrega) || a.correlativo.localeCompare(b.correlativo));
    // Cada vale lleva su paso del pipeline (el PDF lo muestra en lugar del estado crudo).
    const mostradas = filas.slice(0, maxFilas);
    const conTaller = await valeBuzonService._enriquecerConTaller(mostradas.map(f => resumen.get(f.id)));
    const pipelines = new Map(conTaller.map(v => [v.id, calcularPipeline(v, { rolId: ROL.ADMINISTRADOR })]));
    mostradas.forEach(f => { f.pipeline = pipelines.get(f.id); });

    const columnas = esDiseno
      ? (alcance.rol === 'encargado'
        ? [['asignado', 'Asignado'], ['entregado', 'Entregado'], ['aprobado', 'Aprobado'], ['devuelto', 'Devuelto'], ['tiempoProduccionH', 'Tiempo prod.']]
        : [['comenzado', 'Comenzó'], ['entregado', 'Entregó'], ['aprobado', 'Aprobado'], ['devuelto', 'Devuelto'], ['tiempoProduccionH', 'Tiempo prod.']])
      : [['creado', 'Creado'], ['autorizado', 'Autorizado'], ['modificacion', 'Modif. solicitada']];
    return {
      total: filas.length,
      columnas: columnas.map(([clave, label]) => ({ clave, label, formato: clave === 'tiempoProduccionH' ? 'horas' : 'fechaHora' })),
      filas: mostradas,
      secciones: Object.fromEntries(ordenSecciones.map(clave => [clave, {
        total: filas.filter(f => f.seccion === clave).length, filas: mostradas.filter(f => f.seccion === clave)
      }])),
      truncado: filas.length > maxFilas
    };
  }

  // Opciones de los filtros de la barra de Reportes (solo quienes ven a varias personas).
  async _opcionesDeFiltro(alcance, usuario) {
    const opciones = { personas: alcance.equipo ? (alcance.personas || []) : [], agrupaciones: alcance.agrupaciones || [], tiendas: [], talleres: [], asesores: [], disenadores: [] };
    if (!alcance.equipo) return opciones;
    const talleres = await tallerRepository.listarTodos();
    if (alcance.rol === 'supervisor') {
      opciones.tiendas = alcance.tiendas;
      opciones.asesores = alcance.personas;
      opciones.talleres = talleres.filter(t => alcance.tallerIdsVisibles.includes(t.id)).map(t => ({ id: t.id, nombre: t.nombre }));
      return opciones;
    }
    if (alcance.rol === 'encargado') {
      opciones.disenadores = alcance.personas;
      const propios = talleres.filter(t => alcance.tallerIds.includes(t.id)).map(t => ({ id: t.id, nombre: t.nombre }));
      opciones.talleres = propios.length > 1 ? propios : [];
      return opciones;
    }
    opciones.tiendas = await reporteRepository.listarTiendas();
    opciones.asesores = await reporteRepository.listarAsesores();
    opciones.disenadores = (await reporteRepository.listarDisenadores()).map(d => ({
      id: d.id, nombre: valeReporteGruposService.etiquetaNombre(d.nombre, d.rol_id, d.hereda_de_rol_id), tallerIds: String(d.taller_ids || '').split(',').map(Number).filter(Boolean)
    }));
    opciones.talleres = talleres.map(t => ({ id: t.id, nombre: t.nombre }));
    return opciones;
  }
}

module.exports = new ValeReporteService();
module.exports.MAX_FILAS_PDF = MAX_FILAS_PDF;
