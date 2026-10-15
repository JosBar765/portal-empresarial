// src/modules/vales/services/valeReporteGruposService.js
// Tabla unificada de Reportes: personas (o talleres/tiendas) como filas y, bajo cada una, los vales cuya FECHA DE ENTREGA
// cae en el período, con su pipeline, entrega y atraso. El orden de los vales (y el de las filas, por su peor vale) es:
// 0) sin asignar, 1) atraso, 2) paso más bajo del pipeline.
const valeRepository = require('../repositories/valeRepository');
const tallerRepository = require('../repositories/tallerRepository');
const propuestaRepository = require('../repositories/propuestaRepository');
const reporteRepository = require('../repositories/reporteRepository');
const valeBuzonService = require('./valeBuzonService');
const { calcularPipeline } = require('./valePipeline');
const { ROL, ESTADOS, ESTADOS_TALLER, ESTADOS_TERMINALES, ROLES_ENCARGADO_TALLER, hoyISO, enriquecer, enriquecerParaFila, esValeDeModificacion } = require('./valeHelpers');

const AGRUPACIONES = ['asesor', 'disenador', 'taller', 'tienda'];
const MAX_VALES = 1000;
const MAX_VIGENTES = 200;

const fechaDe = (valor) => String(valor || '').slice(0, 10);
const diasEntreFechas = (a, b) => Math.max(0, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5));
// Atraso del vale en SU taller: corre hasta que el Encargado aprueba; con todas sus filas aprobadas y su fecha registrada, queda detenido ahí.
function atrasoEnTaller(v, filasPropias) {
  const congelados = filasPropias.map(f => f.atraso_congelado_en).filter(Boolean).map(String).sort();
  const aprobadas = filasPropias.length > 0 && filasPropias.every(f => f.estado === ESTADOS_TALLER.APROBADO) && congelados.length === filasPropias.length;
  return enriquecerParaFila(v, aprobadas ? { atraso_congelado_en: congelados[congelados.length - 1] } : null);
}
// El vale ya llegó al asesor (propuesta lista para confirmar o ya confirmada): «entregado» para Asesor, Supervisor, Gerente y Administrador.
const ESTADOS_LLEGO_AL_ASESOR = [ESTADOS.PENDIENTE_CONFIRMACION, ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO];
const SECCIONES = ['atrasados', 'noEntregados', 'entregados'];
const ESTADOS_VALE_TERMINADO_TALLER = [ESTADOS.APROBADO_DEPARTAMENTO, ESTADOS.PENDIENTE_CONFIRMACION, ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO];
const redondear = (n) => Math.round(n * 10) / 10;

// Un vale está sin asignar cuando el encargado todavía no le ha dado diseñador («Por asignar»).
const sinAsignar = v => /Por asignar$/.test(v.pipeline.etiqueta);

// Sin asignar primero; luego atrasados (más días arriba) y el paso más bajo del pipeline.
function compararVales(a, b) {
  if (sinAsignar(a) !== sinAsignar(b)) return sinAsignar(a) ? -1 : 1;
  if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
  if (a.atrasado && a.diasAtraso !== b.diasAtraso) return b.diasAtraso - a.diasAtraso;
  if (a.pipeline.paso !== b.pipeline.paso) return a.pipeline.paso - b.pipeline.paso;
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
  // validados contra el alcance.
  // `soloAtrasadosAntesDe(fechaIso)` (opcional): en lugar del período, devuelve los vales atrasados y abiertos cuya fecha de entrega
  // es ANTERIOR al período («atrasados antes del período») con las mismas reglas de alcance y filtros, como { total, truncado, vales }.
  // `corte`: fecha de la «foto». Es hoy salvo en un período ya cerrado, donde es su último día (cifras al cierre: no cambian después).
  async armar({ alcance, dentroDelRango, agruparPor, tiendaId, tallerId, asesorSel, disSel, soloAtrasadosAntesDe = null, corte = hoyISO() }) {
    const alCorte = corte < hoyISO();
    const todos = (await valeRepository.listarTodos())
      .filter(v => (soloAtrasadosAntesDe ? soloAtrasadosAntesDe(fechaDe(v.fecha_entrega)) : dentroDelRango(fechaDe(v.fecha_entrega))))
      .map(enriquecer)
      .filter(v => !soloAtrasadosAntesDe || (alCorte
        // Al cierre: vencido antes del corte y que entonces aún no se aprobaba (hoy abierto, o aprobado después del corte).
        ? (fechaDe(v.fecha_entrega) < corte && (!ESTADOS_TERMINALES.includes(v.estado) || fechaDe(v.atraso_congelado_en) > corte))
        : (v.atrasado && !ESTADOS_TERMINALES.includes(v.estado))));
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

    // Vista Taller (Encargado/Asistente): un vale está terminado (entregado) cuando el Encargado ya aprobó su parte; en revisión aún no cuenta.
    const esTaller = alcance.rol === 'encargado';
    const propias = (v) => filas(v).filter(f => (alcance.tallerIds || []).includes(f.taller_id));
    // Al cierre, una parte cuenta como aprobada solo si el Encargado la aprobó a más tardar en el corte.
    const aprobadaAlCorte = (f) => f.estado === ESTADOS_TALLER.APROBADO && (!alCorte || !f.atraso_congelado_en || fechaDe(f.atraso_congelado_en) <= corte);
    const terminadoTaller = (v) => {
      const p = propias(v);
      if (!p.length) return false;
      return (!alCorte && ESTADOS_VALE_TERMINADO_TALLER.includes(v.estado)) || p.every(aprobadaAlCorte);
    };

    // Cada vale, con los datos que muestra la mini tabla.
    const fichas = new Map(visibles.map(v => {
      const urlPropuesta = v.propuesta_general_url || propuestas.get(v.id) || null;
      const conEnlaces = conExtra.fusion.has(v.id) || conExtra.propuestas.has(v.id) || !!v.propuesta_general_nota;
      const pipeline = calcularPipeline(v, { rolId: ROL.ADMINISTRADOR });
      const terminado = esTaller ? terminadoTaller(v) : pipeline.terminado;
      // Para el Encargado el atraso corre hasta que su taller aprueba (en revisión sigue contando).
      const aprobadoTaller = esTaller && (ESTADOS_VALE_TERMINADO_TALLER.includes(v.estado) || (propias(v).length > 0 && propias(v).every(f => f.estado === ESTADOS_TALLER.APROBADO)));
      const alCierreTaller = alCorte && esTaller; // foto al cierre del período (vista Taller)
      const abierto = alCierreTaller ? !terminado : (!ESTADOS_TERMINALES.includes(v.estado) && !aprobadoTaller);
      const vencido = alCierreTaller ? fechaDe(v.fecha_entrega) < corte : !!v.atrasado;
      const asignados = [...new Set((esTaller ? propias(v) : filas(v)).map(f => f.disenador_id).filter(Boolean))].map(id => nombres.get(id) || `#${id}`);
      const atrasadoFicha = abierto && vencido;
      const entregado = esTaller ? terminado : ESTADOS_LLEGO_AL_ASESOR.includes(v.estado);
      // Precedencia: un vale atrasado va solo en su sección; luego entregado; el resto, no entregado.
      const seccion = atrasadoFicha ? 'atrasados' : (entregado ? 'entregados' : 'noEntregados');
      return [v.id, {
        seccion,
        id: v.id, correlativo: v.correlativo, cliente: v.cliente_nombre, esMod: esValeDeModificacion(v), urgente: !!Number(v.urgente),
        estado: v.estado, pipeline, terminado, disenadores: asignados.length ? asignados.join(', ') : 'Sin asignar',
        creadoEn: `${fechaDe(v.fecha_creacion)} ${String(v.hora_creacion || '00:00:00').slice(0, 8)}`,
        autorizado: !!v.autorizado_en, fechaEntrega: fechaDe(v.fecha_entrega),
        atrasado: abierto && vencido, diasAtraso: abierto ? (alCierreTaller ? diasEntreFechas(fechaDe(v.fecha_entrega), corte) : (v.diasAtraso || 0)) : 0, venceHoy: abierto && !!v.venceHoy,
        // Vista Taller: días de atraso con que se entregó (aprobó el Encargado); 0 si llegó a tiempo.
        diasTarde: esTaller && terminado ? atrasoEnTaller(v, propias(v)).diasAtraso : 0,
        tienePropuesta: !!urlPropuesta || conEnlaces, urlPropuesta, conEnlaces
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
        atrasados: g.vales.filter(v => v.atrasado).length
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
      // `sinEntregar`: de los atrasados que se arrastran, los que el taller aún no entrega (alimenta el contador «Atrasados sin entregar»).
      return { total: todosVigentes.length, truncado: todosVigentes.length > MAX_VIGENTES, sinEntregar: todosVigentes.filter(v => !v.terminado).length, vales: todosVigentes.slice(0, MAX_VIGENTES) };
    }

    // Tres secciones (atrasados, no entregados, entregados): las mismas filas de la agrupación elegida, solo con los vales de cada una.
    const porSeccion = (clave) => lista
      .map(g => {
        const vales = g.vales.filter(v => v.seccion === clave);
        return vales.length ? {
          ...g, vales, total: vales.length, autorizados: vales.filter(v => v.autorizado).length,
          atrasados: vales.filter(v => v.atrasado).length
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
    // Rendimiento «hasta hoy»: un vale cuya fecha de entrega aún no llega no puede contarse como no entregado; entra cuando llega su fecha.
    const exigibles = visibles.filter(v => fechaDe(v.fecha_entrega) <= corte);
    const indicadoresTaller = esTaller ? this._indicadoresTaller(exigibles, fichas) : null;
    const hastaHoy = exigibles.length < visibles.length; // solo se anuncia «hasta hoy» si de verdad quedó algo fuera
    const datosRendimiento = this._rendimiento({ alcance, visibles: exigibles, hastaHoy, aprobada: aprobadaAlCorte, fichas, esTaller, propias, filas, tallerId, asesorSel, disSel, nombresConRol });
    const rendimiento = datosRendimiento && { ...datosRendimiento, totales: this._totalesRendimiento(datosRendimiento.filas, datosRendimiento.sinAsignar) };
    return { agruparPor, secciones, totalVales, truncado: totalVales > MAX_VALES, indicadoresTaller, rendimiento };
  }

  // Reporte de rendimiento (solo Encargado/Asistente y Supervisor): por persona, dos cifras comparadas, su % y sus atrasados, sobre los
  // vales del período y con los filtros aplicados. Encargado: asignados vs entregados por diseñador (y él mismo). Supervisor: creados vs
  // autorizados por asesor (y él mismo). Alimenta la gráfica y la tabla comparativa.
  _rendimiento({ alcance, visibles, hastaHoy, aprobada, fichas, esTaller, propias, filas, tallerId, asesorSel, disSel, nombresConRol }) {
    if (!alcance.equipo || !(alcance.personas || []).length) return null;
    if (esTaller) {
      const filasDe = (v) => (tallerId ? filas(v).filter(f => f.taller_id === tallerId) : propias(v));
      const elegidas = disSel.size ? alcance.personas.filter(p => disSel.has(p.id)) : [...alcance.personas];
      if (!disSel.size) {
        // Quien tiene vales de la ventana aunque no figure entre los diseñadores del taller (p. ej. un asistente) también tiene su fila.
        const conocidos = new Set(elegidas.map(p => p.id));
        visibles.forEach(v => filasDe(v).forEach(f => {
          if (f.disenador_id && !conocidos.has(f.disenador_id)) { conocidos.add(f.disenador_id); elegidas.push({ id: f.disenador_id, nombre: nombresConRol.get(f.disenador_id) || `#${f.disenador_id}` }); }
        }));
      }
      const filasGrafica = elegidas.map(p => {
        let a = 0; let b = 0; let tarde = 0;
        for (const v of visibles) {
          const propia = filasDe(v).filter(f => f.disenador_id === p.id);
          if (!propia.length) continue;
          a += 1;
          if (propia.every(aprobada)) { // entregado = aprobado por el Encargado (al corte)
             b += 1; if (atrasoEnTaller(v, propia).atrasado) tarde += 1; }
        }
        return { id: p.id, nombre: p.nombre, a, b, tarde, sinEntregar: a - b };
      });
      // Vales de la ventana que ningún diseñador tiene todavía: fila «Sin asignar» de la tabla (sin filtro de diseñadores).
      let sinAsignar = null;
      if (!disSel.size) {
        const n = visibles.filter(v => { const f = filasDe(v); return f.length > 0 && f.every(x => !x.disenador_id); }).length;
        sinAsignar = { nombre: 'Sin asignar', a: n, b: 0, tarde: 0, sinEntregar: n };
      }
      return {
        clave: 'disenadores', sinAsignar, persona: 'Diseñador', titulo: 'Asignaciones por diseñador', subtitulo: hastaHoy ? 'Vales con entrega en el período, hasta hoy' : 'Vales con entrega en el período',
        series: [
          { clave: 'a', etiqueta: 'Asignados', ayuda: 'Vales con entrega en el período asignados a esa persona.' },
          { clave: 'b', etiqueta: 'Entregados', ayuda: 'De esos vales, los que su propuesta ya aprobó el Encargado.' }
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
  _totalesRendimiento(filasPersonas, sinAsignar = null) {
    const filas = sinAsignar ? [sinAsignar, ...filasPersonas] : filasPersonas;
    const a = filas.reduce((s, f) => s + f.a, 0);
    const b = filas.reduce((s, f) => s + f.b, 0);
    const suma = (clave) => filas.reduce((s, f) => s + (f[clave] || 0), 0);
    // Taller: entregas tarde y sin entregar; Supervisor: atrasados.
    return filas.some(f => 'tarde' in f) ? { a, b, tarde: suma('tarde'), sinEntregar: suma('sinEntregar') } : { a, b, atrasados: suma('atrasados') };
  }

  // Entrantes (vales con entrega en la ventana, hasta hoy), entregados (de ellos, los que el Encargado ya aprobó, con atraso o sin él), sin
  // entregar (los demás), % de efectividad (entregados / entrantes) y % entregados a tiempo (entregados sin atraso en su taller / entregados).
  // «Atrasados sin entregar»: los vencidos de la ventana sin aprobar; el servicio suma los que se arrastran de antes de la ventana.
  _indicadoresTaller(visibles, fichas) {
    const lista = visibles.map(v => ({ v, ficha: fichas.get(v.id) }));
    const entregados = lista.filter(x => x.ficha.terminado);
    const tarde = entregados.filter(x => x.ficha.diasTarde >= 1).length;
    return {
      entrantes: lista.length,
      entregados: entregados.length,
      sinEntregar: lista.length - entregados.length,
      efectividad: lista.length ? redondear(entregados.length / lista.length * 100) : null,
      aTiempo: entregados.length ? redondear((entregados.length - tarde) / entregados.length * 100) : null,
      // Atrasados sin entregar de la ventana (entrega ya vencida y sin aprobar); el servicio suma los que se arrastran de antes de la ventana.
      atrasadosSinEntregar: lista.filter(x => !x.ficha.terminado && x.ficha.atrasado).length
    };
  }
}

module.exports = new ValeReporteGruposService();
module.exports.AGRUPACIONES = AGRUPACIONES;
