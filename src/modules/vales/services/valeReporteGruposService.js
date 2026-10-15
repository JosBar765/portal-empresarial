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
const { ROL, ESTADOS, ESTADOS_TALLER, ESTADOS_TERMINALES, ROLES_ENCARGADO_TALLER, enriquecer, enriquecerParaFila, esValeDeModificacion } = require('./valeHelpers');

const AGRUPACIONES = ['asesor', 'disenador', 'taller', 'tienda'];
const MAX_VALES = 1000;
const MAX_VIGENTES = 200;
// Estados en los que el vale ya está en los talleres, y por tanto se espera una propuesta.
const ESTADOS_CON_PROPUESTA = [ESTADOS.CREADO, ESTADOS.MODIFICADO, ESTADOS.APROBADO_DEPARTAMENTO, ESTADOS.PENDIENTE_CONFIRMACION, ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO];

const fechaDe = (valor) => String(valor || '').slice(0, 10);
// Fin del día de entrega (hora de Guatemala, UTC-6), para saber si la aprobación del Encargado llegó a tiempo.
const finDelDia = (fecha) => new Date(`${fecha}T23:59:59-06:00`).getTime();
// El vale ya llegó al asesor (propuesta lista para confirmar o ya confirmada): «entregado» para Asesor, Supervisor, Gerente y Administrador.
const ESTADOS_LLEGO_AL_ASESOR = [ESTADOS.PENDIENTE_CONFIRMACION, ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO];
const SECCIONES = ['atrasados', 'noEntregados', 'entregados'];
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
  // «Leticia Tzún · Encargado»: distingue a quien trabaja vales pero es encargado o asistente de un taller.
  etiquetaNombre(nombre, rolId, heredaDeRolId = null) {
    if (heredaDeRolId != null || rolId === ROL.ASISTENTE_DISENO) return `${nombre} · Asistente`;
    return ROLES_ENCARGADO_TALLER.includes(rolId) ? `${nombre} · Encargado` : nombre;
  }

  agrupacionValida(valor, porDefecto) {
    return AGRUPACIONES.includes(valor) ? valor : porDefecto;
  }

  // `alcance`: del servicio de reportes. `dentroDelRango(fechaIso)`: período elegido (sobre la fecha de entrega). Filtros ya
  // validados contra el alcance. `obtenerAprobaciones(valeIds, tallerIds)`: Map valeId -> momento (ms) de la última aprobación de
  // esos talleres, para el % a tiempo del Encargado.
  // `soloAtrasadosAntesDe(fechaIso)` (opcional): en lugar del período, devuelve los vales atrasados y abiertos cuya fecha de entrega
  // es ANTERIOR al período («atrasados antes del período») con las mismas reglas de alcance y filtros, como { total, truncado, vales }.
  async armar({ alcance, dentroDelRango, agruparPor, tiendaId, tallerId, asesorSel, disSel, obtenerAprobaciones, soloAtrasadosAntesDe = null }) {
    const todos = (await valeRepository.listarTodos())
      .filter(v => (soloAtrasadosAntesDe ? soloAtrasadosAntesDe(fechaDe(v.fecha_entrega)) : dentroDelRango(fechaDe(v.fecha_entrega))))
      .map(enriquecer)
      .filter(v => !soloAtrasadosAntesDe || (v.atrasado && !ESTADOS_TERMINALES.includes(v.estado)));
    const conTaller = await valeBuzonService._enriquecerConTaller(todos);

    // Alcance y filtros: todo sobre los vales con entrega en el período.
    const filas = (v) => v._filasTaller || [];
    const visibles = conTaller.filter(v => {
      if (alcance.rol === 'supervisor' && !(alcance.asesorIds || []).includes(v.asesor_id)) return false;
      if (alcance.rol === 'encargado' && !filas(v).some(f => (alcance.tallerIds || []).includes(f.taller_id))) return false;
      if (tiendaId && v.tienda_id !== tiendaId) return false;
      if (asesorSel.size && !asesorSel.has(v.asesor_id)) return false;
      if (tallerId && !filas(v).some(f => f.taller_id === tallerId)) return false;
      if (disSel.size && !filas(v).some(f => (!tallerId || f.taller_id === tallerId) && disSel.has(f.disenador_id))) return false;
      return true;
    });

    const propuestas = await propuestaRepository.listarUltimasPorVales(visibles.map(v => v.id));
    const conExtra = await propuestaRepository.listarValesConExtra();
    const talleres = new Map((await tallerRepository.listarTodos()).map(t => [t.id, t.nombre]));
    const tiendas = new Map((await reporteRepository.listarTiendas()).map(t => [t.id, t.nombre]));
    const idsPersonas = new Set();
    visibles.forEach(v => { idsPersonas.add(v.asesor_id); filas(v).forEach(f => { if (f.disenador_id) idsPersonas.add(f.disenador_id); }); });
    const usuarios = await reporteRepository.listarNombres([...idsPersonas]);
    const nombres = new Map(usuarios.map(u => [u.id, u.nombre]));
    const nombresConRol = new Map(usuarios.map(u => [u.id, this.etiquetaNombre(u.nombre, u.rol_id, u.hereda_de_rol_id)]));

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
      // Para el Encargado el atraso corre hasta que su taller aprueba (en revisión sigue contando); «terminado» solo clasifica.
      const aprobadoTaller = esTaller && (ESTADOS_VALE_TERMINADO_TALLER.includes(v.estado) || (propias(v).length > 0 && propias(v).every(f => f.estado === ESTADOS_TALLER.APROBADO)));
      const abierto = !ESTADOS_TERMINALES.includes(v.estado) && !aprobadoTaller;
      const asignados = [...new Set((esTaller ? propias(v) : filas(v)).map(f => f.disenador_id).filter(Boolean))].map(id => nombres.get(id) || `#${id}`);
      const atrasadoFicha = abierto && !!v.atrasado;
      const entregado = esTaller ? terminado : ESTADOS_LLEGO_AL_ASESOR.includes(v.estado);
      // Precedencia: un vale atrasado va solo en su sección; luego entregado; el resto, no entregado.
      const seccion = atrasadoFicha ? 'atrasados' : (entregado ? 'entregados' : 'noEntregados');
      return [v.id, {
        seccion,
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
      // Con un taller elegido (o para el Encargado, sus talleres) solo cuentan las filas de ese taller, no las de otros talleres del vale.
      const delTaller = tallerId ? filas(v).filter(f => f.taller_id === tallerId) : (esTaller ? propias(v) : filas(v));
      const dis = [...new Set(delTaller.map(f => f.disenador_id).filter(Boolean))].filter(id => !disSel.size || disSel.has(id));
      return dis.length ? dis.map(id => ({ id, nombre: nombresConRol.get(id) || `#${id}` })) : [{ id: 0, nombre: 'Sin diseñador asignado' }];
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
      (await reporteRepository.listarNombres(faltan)).forEach(u => grupos.set(u.id, { clave: `${agruparPor}:${u.id}`, id: u.id, nombre: agruparPor === 'disenador' ? this.etiquetaNombre(u.nombre, u.rol_id, u.hereda_de_rol_id) : u.nombre, vales: [] }));
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

    if (soloAtrasadosAntesDe) {
      const unicos = new Map();
      for (const g of lista) {
        for (const v of g.vales) {
          if (!v.atrasado) continue;
          if (!unicos.has(v.id)) unicos.set(v.id, { ...v, responsables: [] });
          unicos.get(v.id).responsables.push(g.nombre);
        }
      }
      const todosVigentes = [...unicos.values()]
        .map(({ responsables, ...v }) => ({ ...v, responsable: responsables.join(', ') }))
        .sort((a, b) => (b.diasAtraso || 0) - (a.diasAtraso || 0) || String(a.fechaEntrega).localeCompare(String(b.fechaEntrega)));
      return { total: todosVigentes.length, truncado: todosVigentes.length > MAX_VIGENTES, vales: todosVigentes.slice(0, MAX_VIGENTES) };
    }

    // Tres secciones (atrasados, no entregados, entregados): las mismas filas de la agrupación elegida, solo con los vales de cada una.
    const porSeccion = (clave) => lista
      .map(g => {
        const vales = g.vales.filter(v => v.seccion === clave);
        return vales.length ? {
          ...g, vales, total: vales.length, autorizados: vales.filter(v => v.autorizado).length,
          atrasados: vales.filter(v => v.atrasado).length, sinPropuesta: vales.filter(v => v.sinPropuesta).length
        } : null;
      })
      .filter(Boolean)
      .sort((a, b) => compararVales(a.vales[0], b.vales[0]) || b.total - a.total || a.nombre.localeCompare(b.nombre));

    // Tope de vales por respuesta: se recortan del final (los menos urgentes) y se avisa.
    let restante = MAX_VALES;
    const secciones = {};
    for (const clave of SECCIONES) {
      const grupos = porSeccion(clave);
      secciones[clave] = {
        total: grupos.reduce((s, g) => s + g.vales.length, 0),
        grupos: grupos.map(g => {
          const vales = g.vales.slice(0, Math.max(0, restante));
          restante -= vales.length;
          return { ...g, vales, recortado: vales.length < g.vales.length };
        }).filter(g => g.vales.length)
      };
    }
    const indicadoresTaller = esTaller ? await this._indicadoresTaller(visibles, fichas, alcance, obtenerAprobaciones) : null;
    const datosRendimiento = this._rendimiento({ alcance, visibles, fichas, esTaller, propias, filas, tallerId, asesorSel, disSel });
    const rendimiento = datosRendimiento && { ...datosRendimiento, totales: this._totalesRendimiento(datosRendimiento.filas) };
    return { agruparPor, secciones, totalVales, truncado: totalVales > MAX_VALES, indicadoresTaller, rendimiento };
  }

  // Reporte de rendimiento (solo Encargado/Asistente y Supervisor): por persona, dos cifras comparadas, su % y sus atrasados, sobre los
  // vales del período y con los filtros aplicados. Encargado: asignados vs entregados por diseñador (y él mismo). Supervisor: creados vs
  // autorizados por asesor (y él mismo). Alimenta la gráfica y la tabla comparativa.
  _rendimiento({ alcance, visibles, fichas, esTaller, propias, filas, tallerId, asesorSel, disSel }) {
    if (!alcance.equipo || !(alcance.personas || []).length) return null;
    if (esTaller) {
      const elegidas = disSel.size ? alcance.personas.filter(p => disSel.has(p.id)) : alcance.personas;
      const filasDe = (v) => (tallerId ? filas(v).filter(f => f.taller_id === tallerId) : propias(v));
      const ENTREGADA = [ESTADOS_TALLER.EN_REVISION, ESTADOS_TALLER.APROBADO];
      // Atrasado en su taller: corriendo (aún sin aprobar) o aprobado con atraso (el atraso se detuvo al aprobar el Encargado).
      const atrasadoEnSuTaller = (v, propia) => {
        const congelados = propia.map(f => f.atraso_congelado_en).filter(Boolean).map(String).sort();
        const aprobada = propia.every(f => f.estado === ESTADOS_TALLER.APROBADO) && congelados.length === propia.length;
        return enriquecerParaFila(v, aprobada ? { atraso_congelado_en: congelados[congelados.length - 1] } : null).atrasado;
      };
      const filasGrafica = elegidas.map(p => {
        let a = 0; let b = 0; let atrasados = 0;
        for (const v of visibles) {
          const propia = filasDe(v).filter(f => f.disenador_id === p.id);
          if (!propia.length) continue;
          a += 1;
          if (propia.every(f => ENTREGADA.includes(f.estado))) b += 1;
          if (atrasadoEnSuTaller(v, propia)) atrasados += 1;
        }
        return { id: p.id, nombre: p.nombre, a, b, atrasados };
      });
      return {
        clave: 'disenadores', persona: 'Diseñador', titulo: 'Asignaciones por diseñador', subtitulo: 'Vales con entrega en el período',
        series: [
          { clave: 'a', etiqueta: 'Asignados', ayuda: 'Vales con entrega en el período asignados a esa persona.' },
          { clave: 'b', etiqueta: 'Entregados', ayuda: 'De esos vales, los que su propuesta ya salió a revisión o está aprobada.' }
        ],
        filas: this._ordenarGrafica(filasGrafica)
      };
    }
    if (alcance.rol === 'supervisor') {
      const elegidas = asesorSel.size ? alcance.personas.filter(p => asesorSel.has(p.id)) : alcance.personas;
      const filasGrafica = elegidas.map(p => {
        const suyos = visibles.filter(v => v.asesor_id === p.id);
        return {
          id: p.id, nombre: p.nombre, a: suyos.length, b: suyos.filter(v => fichas.get(v.id).autorizado).length,
          atrasados: suyos.filter(v => fichas.get(v.id).atrasado).length
        };
      });
      return {
        clave: 'asesores', persona: 'Asesor', titulo: 'Vales por asesor', subtitulo: 'Vales con entrega en el período',
        series: [
          { clave: 'a', etiqueta: 'Creados', ayuda: 'Vales con entrega en el período creados por esa persona.' },
          { clave: 'b', etiqueta: 'Autorizados', ayuda: 'De esos vales, los que ya fueron autorizados.' }
        ],
        filas: this._ordenarGrafica(filasGrafica)
      };
    }
    return null;
  }

  // Más vales primero; a igualdad, por nombre. Quienes no tienen vales quedan al final con 0.
  _ordenarGrafica(filas) {
    return filas.sort((x, y) => y.a - x.a || y.b - x.b || x.nombre.localeCompare(y.nombre));
  }

  // Totales de la tabla comparativa y quién tiene el % más bajo (solo entre quienes tienen vales; hace falta más de una persona).
  _totalesRendimiento(filas) {
    const a = filas.reduce((s, f) => s + f.a, 0);
    const b = filas.reduce((s, f) => s + f.b, 0);
    const conVales = filas.filter(f => f.a > 0);
    let masBajo = null;
    if (conVales.length > 1) {
      const pct = (f) => f.b / f.a;
      const menor = Math.min(...conVales.map(pct));
      const empatados = conVales.filter(f => pct(f) === menor);
      if (empatados.length === 1 && menor < 1) masBajo = empatados[0].id;
    }
    return { a, b, atrasados: filas.reduce((s, f) => s + f.atrasados, 0), masBajo };
  }

  // Entrantes, entregados, % de efectividad, % entregados a tiempo y atrasados de los vales del período en los talleres del encargado.
  async _indicadoresTaller(visibles, fichas, alcance, obtenerAprobaciones) {
    const lista = visibles.map(v => ({ v, ficha: fichas.get(v.id) }));
    const entregados = lista.filter(x => x.ficha.terminado);
    const aprobaciones = entregados.length && obtenerAprobaciones ? await obtenerAprobaciones(entregados.map(x => x.v.id), alcance.tallerIds) : new Map();
    const conFecha = entregados.filter(x => aprobaciones.has(x.v.id));
    const aTiempo = conFecha.filter(x => aprobaciones.get(x.v.id) <= finDelDia(x.ficha.fechaEntrega)).length;
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
