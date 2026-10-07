// src/modules/vales/services/valeReporteService.js
// Pestaña «Reportes»: actividad de cada persona (y de su equipo) a partir de `vale_historial`. El alcance lo decide el
// servidor según el rol; el cliente solo pide un período y, si tiene gente a su cargo, evaluar a una o varias personas.
const reporteRepository = require('../repositories/reporteRepository');
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const tallerRepository = require('../repositories/tallerRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const valeCatalogoService = require('./valeCatalogoService');
const valeBuzonService = require('./valeBuzonService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const {
  ROL, ESTADOS_TERMINALES, ESTADOS_TALLER, ROLES_ENCARGADO_TALLER, hoyISO, enriquecer, esValeDeModificacion
} = require('./valeHelpers');

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MAX_FILAS_PANTALLA = 100;
const MAX_FILAS_PDF = 500;
const MAX_PERSONAS = 50;
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

function rangoDe(ventana) {
  const hoy = hoyISO();
  if (ventana.tipo === 'mes') {
    const [y, m] = (ventana.fecha || hoy).split('-').map(Number);
    const desde = `${y}-${dos(m)}-01`;
    return { tipo: 'mes', desde, hasta: sumarDias(`${m === 12 ? y + 1 : y}-${dos(m === 12 ? 1 : m + 1)}-01`, -1) };
  }
  if (ventana.tipo === 'rango') return { tipo: 'rango', desde: ventana.desde || null, hasta: ventana.hasta || null };
  return { tipo: 'todo', desde: null, hasta: null };
}

function rangoAnterior(r) {
  if (r.tipo === 'mes') {
    const fin = sumarDias(r.desde, -1);
    const [y, m] = fin.split('-').map(Number);
    return { tipo: 'mes', desde: `${y}-${dos(m)}-01`, hasta: fin };
  }
  if (r.desde && r.hasta) {
    const n = diasEntre(r.desde, r.hasta) + 1;
    return { tipo: 'rango', desde: sumarDias(r.desde, -n), hasta: sumarDias(r.desde, -1) };
  }
  return null;
}

function etiquetaPeriodo(r) {
  if (r.tipo === 'todo') return 'Todo el historial';
  if (r.tipo === 'mes') { const [y, m] = r.desde.split('-').map(Number); return `${MESES[m - 1]} ${y}`; }
  if (r.desde && r.hasta) {
    if (r.desde === r.hasta) return r.desde === hoyISO() ? `Hoy · ${fechaCorta(r.desde)}` : fechaCorta(r.desde);
    return `${fechaCorta(r.desde)} – ${fechaCorta(r.hasta)}`;
  }
  return r.desde ? `Desde ${fechaCorta(r.desde)}` : `Hasta ${fechaCorta(r.hasta)}`;
}

const dentro = (fecha, r) => (!r.desde || fecha >= r.desde) && (!r.hasta || fecha <= r.hasta);

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
async function resolverAlcance(usuario) {
  switch (usuario.rolId) {
    case ROL.ADMINISTRADOR:
      return { rol: 'administrador', equipo: true };
    case ROL.ASESOR:
      return { rol: 'asesor', equipo: false, asesorIds: [usuario.id], personas: [] };
    case ROL.SUPERVISOR: {
      const asesores = await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id);
      return {
        rol: 'supervisor', equipo: true,
        asesorIds: [...new Set([...asesores.map(a => a.id), usuario.id])],
        personas: asesores.map(a => ({ id: a.id, nombre: a.nombre }))
      };
    }
    case ROL.DISENADOR:
      return { rol: 'disenador', equipo: false, valesDeDisenadorId: usuario.id, personas: [] };
    default:
      if (ROLES_ENCARGADO_TALLER.includes(usuario.rolId)) {
        const idEfectivo = await valeCatalogoService.idEncargadoEfectivo(usuario);
        const talleres = (await tallerRepository.listarActivos()).filter(t => t.encargado_id === idEfectivo);
        const disenadores = await usuarioValeRepository.listarDisenadoresPorEncargado(idEfectivo);
        return {
          rol: 'encargado', equipo: true, tallerIds: talleres.map(t => t.id), actorId: usuario.id,
          personas: [{ id: usuario.id, nombre: `${usuario.nombre} (yo)` }, ...disenadores.map(d => ({ id: d.id, nombre: d.nombre }))]
        };
      }
      throw new ErrorDeNegocio('Tu rol no tiene reportes.');
  }
}

const PERSONA_EN_EVENTO = { asesor: e => e.asesorId, disenador: e => e.persona };

class ValeReporteService {
  async obtenerReporte(usuario, filtros = {}, { maxFilas = MAX_FILAS_PANTALLA } = {}) {
    const ventana = valeBuzonService._resolverVentana(filtros);
    const rango = rangoDe(ventana);
    const anterior = rangoAnterior(rango);
    const alcance = await resolverAlcance(usuario);
    const entero = v => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
    const tiendaId = ['supervisor', 'administrador'].includes(alcance.rol) ? entero(filtros.tiendaId) : null;
    const tallerId = alcance.rol === 'administrador' ? entero(filtros.tallerId) : null;
    const pedidas = [...new Set(String(filtros.personaIds ?? '').split(',').map(entero).filter(Boolean))].slice(0, MAX_PERSONAS);
    if (alcance.equipo && alcance.personas && pedidas.some(id => !alcance.personas.some(p => p.id === id))) {
      throw new ErrorDeNegocio('Esa persona no está a tu cargo.');
    }
    const personaIds = alcance.equipo ? new Set(pedidas) : new Set();
    const evaluados = (alcance.personas || []).filter(p => personaIds.has(p.id)).map(p => ({ id: p.id, nombre: p.nombre }));

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
    const dePersona = (e) => {
      if (!personaIds.size) return true;
      if (alcance.rol === 'supervisor') return personaIds.has(e.asesorId);
      if (alcance.rol === 'encargado') return personaIds.has(e.persona) || (e.tipo === 'fusion' && personaIds.has(e.actor));
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
    const ahora = this._instantanea(alcance, usuario, { todos, porId, filasTaller, personaIds, tiendaId, tallerId });

    const kpis = await this._armarKpis(alcance, usuario, ind, indAnt, ahora, eventosPeriodo, rango);
    const nombres = await this._nombres(alcance, normalizados);
    const tablas = await this._tablas(alcance, eventosPeriodo, paresAplicables, rango, { todos, filasTaller, nombres, personaIds });
    const vales = await this._listado(alcance, usuario, eventosPeriodo, historial, paresAplicables, { porId, nombres, maxFilas });

    return {
      rol: alcance.rol,
      alcance: alcance.equipo ? (alcance.rol === 'administrador' ? 'global' : 'equipo') : 'propio',
      titulo: this._titulo(alcance, evaluados),
      evaluados,
      periodo: { ...rango, etiqueta: etiquetaPeriodo(rango), anterior: anterior ? etiquetaPeriodo(anterior) : null },
      kpis, tablas, vales,
      filtros: await this._opcionesDeFiltro(alcance, usuario)
    };
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
  _instantanea(alcance, usuario, { todos, porId, filasTaller, personaIds, tiendaId, tallerId }) {
    const abierto = v => !ESTADOS_TERMINALES.includes(v.estado);
    if (alcance.rol === 'disenador') {
      const mias = filasTaller.filter(f => f.disenador_id === usuario.id && ESTADOS_COLA_DISENADOR.includes(f.estado));
      return {
        asignadosAhora: mias.filter(f => f.estado === ESTADOS_TALLER.ASIGNADO).length,
        enProcesoAhora: mias.filter(f => [ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA].includes(f.estado)).length,
        atrasadosAhora: mias.filter(f => (porId.get(f.vale_id) || {}).atrasado).length
      };
    }
    if (alcance.rol === 'encargado') {
      const enTaller = filasTaller.filter(f => alcance.tallerIds.includes(f.taller_id) && f.estado !== ESTADOS_TALLER.APROBADO
        && (!personaIds.size || personaIds.has(f.disenador_id)));
      return {
        porRevisarAhora: enTaller.filter(f => f.estado === ESTADOS_TALLER.EN_REVISION).length,
        enColaAhora: enTaller.length,
        atrasadosAhora: enTaller.filter(f => (porId.get(f.vale_id) || {}).atrasado).length
      };
    }
    let propios = todos.filter(abierto);
    if (alcance.asesorIds) propios = propios.filter(v => alcance.asesorIds.includes(v.asesor_id));
    if (personaIds.size && alcance.rol === 'supervisor') propios = propios.filter(v => personaIds.has(v.asesor_id));
    if (tiendaId) propios = propios.filter(v => v.tienda_id === tiendaId);
    if (tallerId) {
      const ids = new Set(filasTaller.filter(f => f.taller_id === tallerId).map(f => f.vale_id));
      propios = propios.filter(v => ids.has(v.id));
    }
    return { abiertosAhora: propios.length, atrasadosAhora: propios.filter(v => v.atrasado).length };
  }

  async _armarKpis(alcance, usuario, ind, indAnt, ahora, eventos, rango) {
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
          k('creados', 'Vales creados', 'num'), k('autorizados', 'Autorizados', 'num'), k('rechazados', 'Rechazados', 'num', { malo: true }),
          k('confirmados', 'Confirmados de recibido', 'num'), k('asignaciones', 'Asignaciones', 'num'), k('entregados', 'Propuestas entregadas', 'num'),
          k('aprobados', 'Aprobados', 'num'), k('devueltos', 'Devueltos a corregir', 'num', { malo: true }),
          k('cicloDias', 'Ciclo completo (crear → confirmar)', 'dias', { menorEsMejor: true }),
          k('tiempoProduccionH', 'Tiempo de producción promedio', 'horas', { menorEsMejor: true }),
          instantaneo('abiertosAhora', 'Abiertos ahora'), instantaneo('atrasadosAhora', 'Atrasados ahora', { malo: true })
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

  // ---- Listado de vales del período con sus hitos ----
  async _listado(alcance, usuario, eventos, historial, pares, { porId, nombres, maxFilas }) {
    const TIPOS_VENTAS = ['creacion', 'autorizacion', 'solicitud_mod'];
    const ids = [...new Set(eventos.filter(e => ['disenador', 'encargado'].includes(alcance.rol) || TIPOS_VENTAS.includes(e.tipo)).map(e => e.valeId))];
    const vales = await reporteRepository.listarValesPorIds(ids);
    const resumen = new Map(vales.map(v => [v.id, enriquecer(v)]));
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
      const actividad = Math.max(...eventos.filter(e => e.valeId === id).map(e => e.ms));
      const base = {
        id, correlativo: v.correlativo, cliente: v.cliente_nombre, asesor: nombres.get(v.asesor_id) || `#${v.asesor_id}`,
        fechaEntrega: String(v.fecha_entrega).slice(0, 10), estado: v.estado, esMod: esValeDeModificacion(v),
        atrasado: v.atrasado, diasAtraso: v.diasAtraso, actividadMs: actividad
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
    }).filter(Boolean).sort((a, b) => b.actividadMs - a.actividadMs);

    const columnas = esDiseno
      ? (alcance.rol === 'encargado'
        ? [['asignado', 'Asignado'], ['entregado', 'Entregado'], ['aprobado', 'Aprobado'], ['devuelto', 'Devuelto'], ['tiempoProduccionH', 'Tiempo prod.']]
        : [['comenzado', 'Comenzó'], ['entregado', 'Entregó'], ['aprobado', 'Aprobado'], ['devuelto', 'Devuelto'], ['tiempoProduccionH', 'Tiempo prod.']])
      : [['creado', 'Creado'], ['autorizado', 'Autorizado'], ['modificacion', 'Modif. solicitada']];
    return {
      total: filas.length,
      columnas: columnas.map(([clave, label]) => ({ clave, label, formato: clave === 'tiempoProduccionH' ? 'horas' : 'fechaHora' })),
      filas: filas.slice(0, maxFilas).map(({ actividadMs, ...f }) => f),
      truncado: filas.length > maxFilas
    };
  }

  async _opcionesDeFiltro(alcance, usuario) {
    const opciones = { personas: alcance.equipo ? (alcance.personas || []) : [], tiendas: [], talleres: [] };
    if (['supervisor', 'administrador'].includes(alcance.rol)) opciones.tiendas = await reporteRepository.listarTiendas();
    if (alcance.rol === 'administrador') opciones.talleres = (await tallerRepository.listarTodos()).map(t => ({ id: t.id, nombre: t.nombre }));
    return opciones;
  }
}

module.exports = new ValeReporteService();
module.exports.MAX_FILAS_PDF = MAX_FILAS_PDF;
