// src/modules/vales/services/valeReporteGruposService.js
// Tabla unificada de Reportes: personas (o talleres/tiendas) como filas y, bajo cada una, los vales cuya FECHA DE ENTREGA
// cae en el período, con su pipeline, entrega, atraso y propuesta. El orden de los vales (y el de las filas, por su peor vale) es:
// 0) sin asignar, 1) atraso, 2) paso más bajo del pipeline, 3) sin propuesta adjunta.
const valeRepository = require('../repositories/valeRepository');
const tallerRepository = require('../repositories/tallerRepository');
const propuestaRepository = require('../repositories/propuestaRepository');
const reporteRepository = require('../repositories/reporteRepository');
const valeBuzonService = require('./valeBuzonService');
const { calcularPipeline } = require('./valePipeline');
const { ROL, ESTADOS, ESTADOS_TALLER, ESTADOS_TERMINALES, enriquecer, esValeDeModificacion } = require('./valeHelpers');

const AGRUPACIONES = ['asesor', 'disenador', 'taller', 'tienda'];
const MAX_VALES = 1000;
// Estados en los que el vale ya está en los talleres, y por tanto se espera una propuesta.
const ESTADOS_CON_PROPUESTA = [ESTADOS.CREADO, ESTADOS.MODIFICADO, ESTADOS.APROBADO_DEPARTAMENTO, ESTADOS.PENDIENTE_CONFIRMACION, ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO];

const fechaDe = (valor) => String(valor || '').slice(0, 10);
// Fin del día de entrega (hora de Guatemala, UTC-6), para saber si una entrega a revisión llegó a tiempo.
const finDelDia = (fecha) => new Date(`${fecha}T23:59:59-06:00`).getTime();
const ESTADOS_VALE_TERMINADO_TALLER = [ESTADOS.APROBADO_DEPARTAMENTO, ESTADOS.PENDIENTE_CONFIRMACION, ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO];
const redondear = (n) => Math.round(n * 10) / 10;

// Un vale está sin asignar cuando el encargado todavía no le ha dado diseñador («Por asignar»).
const sinAsignar = v => /Por asignar$/.test(v.pipeline.etiqueta);

// Sin asignar primero; luego atrasados (más días arriba), el paso más bajo del pipeline y los que no tienen propuesta.
function compararVales(a, b) {
  if (sinAsignar(a) !== sinAsignar(b)) return sinAsignar(a) ? -1 : 1;
  if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
  if (a.atrasado && a.diasAtraso !== b.diasAtraso) return b.diasAtraso - a.diasAtraso;
  if (a.pipeline.paso !== b.pipeline.paso) return a.pipeline.paso - b.pipeline.paso;
  if (a.sinPropuesta !== b.sinPropuesta) return a.sinPropuesta ? -1 : 1;
  return String(a.fechaEntrega).localeCompare(String(b.fechaEntrega)) || a.id - b.id;
}

class ValeReporteGruposService {
  agrupacionValida(valor, porDefecto) {
    return AGRUPACIONES.includes(valor) ? valor : porDefecto;
  }

  // `alcance`: del servicio de reportes. `dentroDelRango(fechaIso)`: período elegido (sobre la fecha de entrega). Filtros ya
  // validados contra el alcance. `obtenerEntregas(valeIds, tallerIds)`: Map valeId -> momento (ms) de la primera entrega a
  // revisión de esos talleres, para el % a tiempo del Encargado.
  async armar({ alcance, dentroDelRango, agruparPor, tiendaId, tallerId, asesorSel, disSel, obtenerEntregas }) {
    const todos = (await valeRepository.listarTodos())
      .filter(v => dentroDelRango(fechaDe(v.fecha_entrega)))
      .map(enriquecer);
    const conTaller = await valeBuzonService._enriquecerConTaller(todos);

    // Alcance y filtros: todo sobre los vales con entrega en el período.
    const filas = (v) => v._filasTaller || [];
    const visibles = conTaller.filter(v => {
      if (alcance.rol === 'supervisor' && !(alcance.asesorIds || []).includes(v.asesor_id)) return false;
      if (alcance.rol === 'encargado' && !filas(v).some(f => (alcance.tallerIds || []).includes(f.taller_id))) return false;
      if (tiendaId && v.tienda_id !== tiendaId) return false;
      if (asesorSel.size && !asesorSel.has(v.asesor_id)) return false;
      if (tallerId && !filas(v).some(f => f.taller_id === tallerId)) return false;
      if (disSel.size && !filas(v).some(f => disSel.has(f.disenador_id))) return false;
      return true;
    });

    const propuestas = await propuestaRepository.listarUltimasPorVales(visibles.map(v => v.id));
    const conExtra = await propuestaRepository.listarValesConExtra();
    const talleres = new Map((await tallerRepository.listarTodos()).map(t => [t.id, t.nombre]));
    const tiendas = new Map((await reporteRepository.listarTiendas()).map(t => [t.id, t.nombre]));
    const idsPersonas = new Set();
    visibles.forEach(v => { idsPersonas.add(v.asesor_id); filas(v).forEach(f => { if (f.disenador_id) idsPersonas.add(f.disenador_id); }); });
    const nombres = new Map((await reporteRepository.listarNombres([...idsPersonas])).map(u => [u.id, u.nombre]));

    // Vista Taller (Encargado/Asistente): un vale está terminado cuando su parte ya salió a revisión o se aprobó.
    const esTaller = alcance.rol === 'encargado';
    const propias = (v) => filas(v).filter(f => (alcance.tallerIds || []).includes(f.taller_id));
    const terminadoTaller = (v) => {
      const p = propias(v);
      if (!p.length) return false;
      return ESTADOS_VALE_TERMINADO_TALLER.includes(v.estado)
        || p.every(f => [ESTADOS_TALLER.EN_REVISION, ESTADOS_TALLER.APROBADO].includes(f.estado));
    };

    // Cada vale, con los datos que muestra la mini tabla.
    const fichas = new Map(visibles.map(v => {
      const urlPropuesta = v.propuesta_general_url || propuestas.get(v.id) || null;
      const requierePropuesta = ESTADOS_CON_PROPUESTA.includes(v.estado);
      const conEnlaces = conExtra.fusion.has(v.id) || conExtra.propuestas.has(v.id) || !!v.propuesta_general_nota;
      const pipeline = calcularPipeline(v, { rolId: ROL.ADMINISTRADOR });
      const terminado = esTaller ? terminadoTaller(v) : pipeline.terminado;
      const abierto = !ESTADOS_TERMINALES.includes(v.estado) && !(esTaller && terminado);
      const asignados = [...new Set((esTaller ? propias(v) : filas(v)).map(f => f.disenador_id).filter(Boolean))].map(id => nombres.get(id) || `#${id}`);
      return [v.id, {
        id: v.id, correlativo: v.correlativo, cliente: v.cliente_nombre, esMod: esValeDeModificacion(v), urgente: !!Number(v.urgente),
        estado: v.estado, pipeline, terminado, disenadores: asignados.length ? asignados.join(', ') : 'Sin asignar',
        creadoEn: `${fechaDe(v.fecha_creacion)} ${String(v.hora_creacion || '00:00:00').slice(0, 8)}`,
        autorizado: !!v.autorizado_en, fechaEntrega: fechaDe(v.fecha_entrega),
        atrasado: abierto && !!v.atrasado, diasAtraso: abierto ? (v.diasAtraso || 0) : 0, venceHoy: abierto && !!v.venceHoy,
        tienePropuesta: !!urlPropuesta || conEnlaces, sinPropuesta: requierePropuesta && !urlPropuesta && !conEnlaces, urlPropuesta, conEnlaces
      }];
    }));

    // Claves de agrupación de cada vale (un vale de varios talleres cuenta bajo cada uno).
    const clavesDe = (v) => {
      if (agruparPor === 'asesor') return [{ id: v.asesor_id, nombre: nombres.get(v.asesor_id) || `#${v.asesor_id}` }];
      if (agruparPor === 'tienda') return [{ id: v.tienda_id, nombre: tiendas.get(v.tienda_id) || `Tienda ${v.tienda_id}` }];
      if (agruparPor === 'taller') {
        const ids = filas(v).length ? filas(v).map(f => f.taller_id) : String(v.talleres_solicitados || '').split(',').map(Number).filter(Boolean);
        const unicos = [...new Set(ids)].filter(id => !tallerId || id === tallerId);
        return unicos.length ? unicos.map(id => ({ id, nombre: talleres.get(id) || `Taller ${id}` })) : [{ id: 0, nombre: 'Sin taller' }];
      }
      const dis = [...new Set((esTaller ? propias(v) : filas(v)).map(f => f.disenador_id).filter(Boolean))].filter(id => !disSel.size || disSel.has(id));
      return dis.length ? dis.map(id => ({ id, nombre: nombres.get(id) || `#${id}` })) : [{ id: 0, nombre: 'Sin diseñador asignado' }];
    };

    const grupos = new Map();
    for (const v of visibles) {
      for (const clave of clavesDe(v)) {
        if (!grupos.has(clave.id)) grupos.set(clave.id, { clave: `${agruparPor}:${clave.id}`, id: clave.id, nombre: clave.nombre, vales: [] });
        grupos.get(clave.id).vales.push(fichas.get(v.id));
      }
    }
    // Las personas elegidas explícitamente aparecen aunque no hayan creado vales (con ceros).
    const elegidas = agruparPor === 'asesor' ? asesorSel : (agruparPor === 'disenador' ? disSel : new Set());
    if (elegidas.size) {
      const faltan = [...elegidas].filter(id => !grupos.has(id));
      (await reporteRepository.listarNombres(faltan)).forEach(u => grupos.set(u.id, { clave: `${agruparPor}:${u.id}`, id: u.id, nombre: u.nombre, vales: [] }));
    }

    const totalVales = visibles.length;
    const lista = [...grupos.values()].map(g => {
      g.vales.sort(compararVales);
      return {
        ...g,
        total: g.vales.length,
        autorizados: g.vales.filter(v => v.autorizado).length,
        atrasados: g.vales.filter(v => v.atrasado).length,
        sinPropuesta: g.vales.filter(v => v.sinPropuesta).length
      };
    }).sort((a, b) => {
      if (!a.vales.length || !b.vales.length) return a.vales.length ? -1 : (b.vales.length ? 1 : a.nombre.localeCompare(b.nombre));
      return compararVales(a.vales[0], b.vales[0]) || b.total - a.total || a.nombre.localeCompare(b.nombre);
    });

    // Tope de vales por respuesta: se recortan del final (los menos urgentes) y se avisa.
    let restante = MAX_VALES;
    const recortado = lista.map(g => {
      const vales = g.vales.slice(0, Math.max(0, restante));
      restante -= vales.length;
      return { ...g, vales, recortado: vales.length < g.vales.length };
    });
    const indicadoresTaller = esTaller ? await this._indicadoresTaller(visibles, fichas, alcance, obtenerEntregas) : null;
    return { agruparPor, grupos: recortado, totalVales, truncado: totalVales > MAX_VALES, indicadoresTaller };
  }

  // Entrantes, entregados, % de efectividad, % entregados a tiempo y atrasados de los vales del período en los talleres del encargado.
  async _indicadoresTaller(visibles, fichas, alcance, obtenerEntregas) {
    const lista = visibles.map(v => ({ v, ficha: fichas.get(v.id) }));
    const entregados = lista.filter(x => x.ficha.terminado);
    const entregas = entregados.length && obtenerEntregas ? await obtenerEntregas(entregados.map(x => x.v.id), alcance.tallerIds) : new Map();
    const conFecha = entregados.filter(x => entregas.has(x.v.id));
    const aTiempo = conFecha.filter(x => entregas.get(x.v.id) <= finDelDia(x.ficha.fechaEntrega)).length;
    return {
      entrantes: lista.length,
      entregados: entregados.length,
      efectividad: lista.length ? redondear(entregados.length / lista.length * 100) : null,
      aTiempo: conFecha.length ? redondear(aTiempo / conFecha.length * 100) : null,
      atrasados: lista.filter(x => x.ficha.atrasado).length
    };
  }
}

module.exports = new ValeReporteGruposService();
module.exports.AGRUPACIONES = AGRUPACIONES;
