// src/modules/vales/services/valeRendimientoService.js
// Vista "Rendimiento" de Gerencia: métricas agregadas de solo lectura sobre
// atrasos, ciclo de vida y desempeño por taller/tienda. Reutiliza el mismo
// cálculo de atraso (`enriquecer`) y la misma ventana de tiempo que el
// dashboard de contadores, para que ambos números siempre coincidan.
const valeRepository = require('../repositories/valeRepository');
const tallerRepository = require('../repositories/tallerRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const valeBuzonService = require('./valeBuzonService');
const {
  ESTADOS, ESTADOS_TALLER, ESTADOS_TERMINALES, ROL,
  enriquecer, dentroDeVentana, hoyISO
} = require('./valeHelpers');

const DIA_MS = 24 * 60 * 60 * 1000;
// Con menos vales cerrados que esto, un porcentaje de cumplimiento es ruido:
// el frontend lo muestra atenuado en vez de compararlo de igual a igual.
const MUESTRA_MINIMA = 5;
const MAX_CRITICOS = 8;

const ETAPAS_EN_CURSO = [
  { clave: 'esperandoAutorizacion', label: 'Esperando autorización' },
  { clave: 'sinAsignar', label: 'Sin asignar' },
  { clave: 'enProduccion', label: 'En producción' },
  { clave: 'enRevision', label: 'En revisión' },
  { clave: 'porFusionar', label: 'Por fusionar' },
  { clave: 'pendienteConfirmacion', label: 'Pendiente de confirmación' },
  { clave: 'solicitandoModificacion', label: 'Modificación solicitada' }
];

const ETAPAS_CICLO = [
  { clave: 'autorizacion', label: 'Autorización' },
  { clave: 'asignacion', label: 'Asignación a técnico' },
  { clave: 'produccion', label: 'Producción y revisión' },
  { clave: 'confirmacion', label: 'Confirmación del asesor' }
];

// Las fechas llegan como strings "naive" de la BD (dateStrings) que ya
// representan la hora de pared de Guatemala; anclarlas todas al mismo
// offset (Z) hace que las DIFERENCIAS sean correctas sin importar la zona
// horaria del proceso Node.
function aMs(valor) {
  if (!valor) return null;
  const s = String(valor);
  const iso = s.length === 10 ? `${s}T00:00:00Z` : `${s.replace(' ', 'T')}Z`;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function diasEntre(desde, hasta) {
  const a = aMs(desde);
  const b = aMs(hasta);
  if (a == null || b == null || b < a) return null;
  return (b - a) / DIA_MS;
}

function promedio(valores) {
  const validos = valores.filter(Number.isFinite);
  if (!validos.length) return null;
  return Math.round((validos.reduce((s, n) => s + n, 0) / validos.length) * 10) / 10;
}

function porcentaje(n, total) {
  return total ? Math.round((n / total) * 1000) / 10 : null;
}

function sumarDias(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function inicioDe(vale) {
  return `${vale.fecha_creacion} ${vale.hora_creacion}`;
}

function cierreDe(vale) {
  return vale.confirmado_en || vale.atraso_congelado_en || vale.actualizado_en;
}

const esCerrado = (v) => ESTADOS_TERMINALES.includes(v.estado);

// Ventana equivalente inmediatamente anterior, para calcular la variación.
// "Todo" no tiene período anterior comparable.
function ventanaAnterior(ventana) {
  if (!ventana || !ventana.tipo || ventana.tipo === 'todo') return null;
  const ref = ventana.fecha || hoyISO();
  switch (ventana.tipo) {
    case 'dia': return { tipo: 'dia', fecha: sumarDias(ref, -1) };
    case 'semana': return { tipo: 'semana', fecha: sumarDias(ref, -7) };
    case 'mes': return { tipo: 'mes', fecha: new Date(Date.UTC(Number(ref.slice(0, 4)), Number(ref.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10) };
    case 'rango': {
      if (!ventana.desde) return null;
      const hasta = ventana.hasta || hoyISO();
      const largo = Math.round((aMs(hasta) - aMs(ventana.desde)) / DIA_MS) + 1;
      return { tipo: 'rango', desde: sumarDias(ventana.desde, -largo), hasta: sumarDias(ventana.desde, -1) };
    }
    default: return null;
  }
}

function finBucket(inicio, granularidad) {
  if (granularidad === 'dia') return inicio;
  if (granularidad === 'semana') return sumarDias(inicio, 6);
  return new Date(Date.UTC(Number(inicio.slice(0, 4)), Number(inicio.slice(5, 7)), 0)).toISOString().slice(0, 10);
}

function claveBucket(iso, granularidad) {
  if (granularidad === 'dia') return iso;
  if (granularidad === 'mes') return iso.slice(0, 7);
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

function limitesVentana(ventana, vales, hoy) {
  const ref = ventana.fecha || hoy;
  const primeraCreacion = vales.reduce((min, v) => (!min || v.fecha_creacion < min ? v.fecha_creacion : min), null);
  let desde;
  let hasta;
  switch (ventana.tipo) {
    case 'dia': desde = ref; hasta = ref; break;
    case 'semana': desde = claveBucket(ref, 'semana'); hasta = sumarDias(desde, 6); break;
    case 'mes':
      desde = `${ref.slice(0, 7)}-01`;
      hasta = new Date(Date.UTC(Number(ref.slice(0, 4)), Number(ref.slice(5, 7)), 0)).toISOString().slice(0, 10);
      break;
    case 'rango': desde = ventana.desde || primeraCreacion || hoy; hasta = ventana.hasta || hoy; break;
    default: desde = primeraCreacion || hoy; hasta = hoy;
  }
  if (hasta > hoy) hasta = hoy;
  if (desde > hasta) desde = hasta;
  return { desde, hasta };
}

function elegirGranularidad(desde, hasta) {
  const dias = Math.round((aMs(hasta) - aMs(desde)) / DIA_MS) + 1;
  if (dias <= 31) return 'dia';
  if (dias <= 200) return 'semana';
  return 'mes';
}

function listarBuckets(desde, hasta, granularidad) {
  const claves = [];
  const fin = aMs(hasta);
  for (let t = aMs(desde); t <= fin; t += DIA_MS) {
    const clave = claveBucket(new Date(t).toISOString().slice(0, 10), granularidad);
    if (claves[claves.length - 1] !== clave) claves.push(clave);
  }
  return claves;
}

function calcularKpis(vales) {
  const cerrados = vales.filter(esCerrado);
  const abiertos = vales.filter(v => !esCerrado(v));
  const aTiempo = cerrados.filter(v => !v.atrasado).length;
  const originales = vales.filter(v => !v.vale_original_id);
  const modificados = originales.filter(v => Number(v.modificado) > 0).length;
  return {
    creados: vales.length,
    cerrados: cerrados.length,
    aTiempoPct: porcentaje(aTiempo, cerrados.length),
    enCurso: abiertos.length,
    atrasadosAhora: abiertos.filter(v => v.atrasado).length,
    cicloDias: promedio(cerrados.map(v => diasEntre(inicioDe(v), cierreDe(v)))),
    originales: originales.length,
    modificadosPct: porcentaje(modificados, originales.length)
  };
}

function resumirGrupo(vales) {
  const cerrados = vales.filter(esCerrado);
  const abiertos = vales.filter(v => !esCerrado(v));
  const atrasados = vales.filter(v => v.atrasado);
  const originales = vales.filter(v => !v.vale_original_id);
  return {
    vales: vales.length,
    cerrados: cerrados.length,
    aTiempoPct: porcentaje(cerrados.filter(v => !v.atrasado).length, cerrados.length),
    muestraBaja: cerrados.length < MUESTRA_MINIMA,
    enCola: abiertos.length,
    atrasados: abiertos.filter(v => v.atrasado).length,
    atrasoPromDias: promedio(atrasados.map(v => v.diasAtraso)),
    modificadosPct: porcentaje(originales.filter(v => Number(v.modificado) > 0).length, originales.length)
  };
}

// Peor cumplimiento primero, pero las muestras pequeñas al final: un 0% sobre
// 1 solo vale cerrado no debe ocupar el primer lugar del ranking.
function ordenarRanking(a, b) {
  return Number(a.muestraBaja) - Number(b.muestraBaja)
    || (a.aTiempoPct ?? 101) - (b.aTiempoPct ?? 101)
    || b.vales - a.vales;
}

function etapaEnCurso(vale) {
  switch (vale.estado) {
    case ESTADOS.ESPERANDO_AUTORIZACION: return 'esperandoAutorizacion';
    case ESTADOS.CREADO:
    case ESTADOS.MODIFICADO: {
      const estados = (vale._filasTaller || []).map(f => f.estado);
      if (!estados.length || estados.includes(ESTADOS_TALLER.PENDIENTE_ASIGNACION)) return 'sinAsignar';
      if (estados.some(e => [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA].includes(e))) return 'enProduccion';
      return 'enRevision';
    }
    case ESTADOS.APROBADO_DEPARTAMENTO: return 'porFusionar';
    case ESTADOS.PENDIENTE_CONFIRMACION: return 'pendienteConfirmacion';
    case ESTADOS.SOLICITANDO_MODIFICACION: return 'solicitandoModificacion';
    default: return null;
  }
}

function primeraAsignacion(vale) {
  const fechas = (vale._filasTaller || []).map(f => f.fecha_asignacion).filter(Boolean).sort();
  return fechas[0] || null;
}

class ValeRendimientoService {
  async obtenerRendimiento(usuario, filtros = {}) {
    const ventana = valeBuzonService._resolverVentana(filtros);
    const hoy = hoyISO();

    let todos = (await valeRepository.listarTodos()).map(enriquecer);
    if (usuario.rolId === ROL.SUPERVISOR) {
      const asesorIds = new Set((await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id)).map(a => a.id));
      todos = todos.filter(v => asesorIds.has(v.asesor_id));
    }
    todos = await valeBuzonService._enriquecerConTaller(todos);

    const base = filtros.tiendaId ? todos.filter(v => v.tienda_id === Number(filtros.tiendaId)) : todos;
    const enVentana = base.filter(v => dentroDeVentana(v, ventana));

    const anteriorVentana = ventanaAnterior(ventana);
    const kpisActual = calcularKpis(enVentana);
    let kpisAnterior = null;
    if (anteriorVentana) {
      const previos = base.filter(v => dentroDeVentana(v, anteriorVentana));
      if (previos.length) {
        const k = calcularKpis(previos);
        kpisAnterior = { creados: k.creados, aTiempoPct: k.aTiempoPct, cicloDias: k.cicloDias, modificadosPct: k.modificadosPct };
      }
    }

    const { desde, hasta } = limitesVentana(ventana, enVentana, hoy);
    const granularidad = elegirGranularidad(desde, hasta);

    return {
      generadoEn: `${hoy} ${new Date().toISOString().slice(11, 19)}`,
      ventana: { ...ventana, desde, hasta },
      granularidad,
      muestraMinima: MUESTRA_MINIMA,
      kpis: { actual: kpisActual, anterior: kpisAnterior },
      tendencia: this._tendencia(enVentana, desde, hasta, granularidad),
      etapasCiclo: this._etapasCiclo(enVentana),
      enCurso: this._enCurso(enVentana),
      talleres: await this._porTaller(enVentana),
      tiendas: this._porTienda(enVentana),
      criticos: this._criticos(enVentana)
    };
  }

  _tendencia(vales, desde, hasta, granularidad) {
    const buckets = new Map(listarBuckets(desde, hasta, granularidad).map(clave => [clave, {
      inicio: granularidad === 'mes' ? `${clave}-01` : clave,
      creados: 0, cerrados: 0, aTiempo: 0, ciclos: []
    }]));
    vales.forEach(v => {
      const bCreado = buckets.get(claveBucket(String(v.fecha_creacion).slice(0, 10), granularidad));
      if (bCreado) bCreado.creados++;
      if (!esCerrado(v)) return;
      const cierre = cierreDe(v);
      const bCierre = cierre && buckets.get(claveBucket(String(cierre).slice(0, 10), granularidad));
      if (!bCierre) return;
      bCierre.cerrados++;
      if (!v.atrasado) bCierre.aTiempo++;
      bCierre.ciclos.push(diasEntre(inicioDe(v), cierre));
    });
    const hoy = hoyISO();
    const filas = [...buckets.values()];
    // Con pocos cierres por período, una tasa cruda salta entre 0% y 100%:
    // los sparklines usan un promedio móvil de los últimos períodos.
    const ancho = { dia: 7, semana: 3, mes: 2 }[granularidad];
    return filas.map((b, i) => {
      const grupo = filas.slice(Math.max(0, i - ancho + 1), i + 1);
      return {
        inicio: b.inicio,
        // El período que contiene hoy aún no terminó: sus totales parciales no
        // deben leerse como una caída real.
        parcial: finBucket(b.inicio, granularidad) >= hoy,
        creados: b.creados,
        cerrados: b.cerrados,
        aTiempoPct: porcentaje(b.aTiempo, b.cerrados),
        cicloDias: promedio(b.ciclos),
        aTiempoMovilPct: porcentaje(grupo.reduce((s, g) => s + g.aTiempo, 0), grupo.reduce((s, g) => s + g.cerrados, 0)),
        cicloMovilDias: promedio(grupo.flatMap(g => g.ciclos))
      };
    });
  }

  // Promedio por etapa solo con los vales que YA la completaron: un vale que
  // sigue atascado en una etapa no aporta a esa etapa hasta que la termine.
  _etapasCiclo(vales) {
    const muestras = { autorizacion: [], asignacion: [], produccion: [], confirmacion: [] };
    vales.forEach(v => {
      const asignado = primeraAsignacion(v);
      if (!v.vale_original_id) muestras.autorizacion.push(diasEntre(inicioDe(v), v.autorizado_en));
      muestras.asignacion.push(diasEntre(v.autorizado_en, asignado));
      muestras.produccion.push(diasEntre(asignado, v.fusionado_en));
      muestras.confirmacion.push(diasEntre(v.fusionado_en, v.confirmado_en));
    });
    return ETAPAS_CICLO.map(e => {
      const validas = muestras[e.clave].filter(Number.isFinite);
      return { ...e, dias: promedio(validas), n: validas.length };
    });
  }

  _enCurso(vales) {
    const acumulado = new Map(ETAPAS_EN_CURSO.map(e => [e.clave, { ...e, alDia: 0, atrasados: 0 }]));
    vales.filter(v => !esCerrado(v)).forEach(v => {
      const etapa = acumulado.get(etapaEnCurso(v));
      if (!etapa) return;
      if (v.atrasado) etapa.atrasados++; else etapa.alDia++;
    });
    return [...acumulado.values()];
  }

  async _porTaller(vales) {
    const talleres = await tallerRepository.listarActivos();
    const nombres = new Map(talleres.map(t => [t.id, t.nombre]));
    const porTaller = new Map();
    vales.forEach(v => {
      new Set((v._filasTaller || []).map(f => f.taller_id)).forEach(tallerId => {
        if (!porTaller.has(tallerId)) porTaller.set(tallerId, []);
        porTaller.get(tallerId).push(v);
      });
    });
    return [...porTaller.entries()]
      .map(([id, lista]) => ({ id, nombre: nombres.get(id) || `#${id}`, ...resumirGrupo(lista) }))
      .sort(ordenarRanking);
  }

  _porTienda(vales) {
    const porTienda = new Map();
    vales.forEach(v => {
      if (!porTienda.has(v.tienda_id)) porTienda.set(v.tienda_id, []);
      porTienda.get(v.tienda_id).push(v);
    });
    return [...porTienda.entries()]
      .map(([id, lista]) => ({ id, ...resumirGrupo(lista) }))
      .sort(ordenarRanking);
  }

  _criticos(vales) {
    return vales
      .filter(v => !esCerrado(v) && v.atrasado)
      .sort((a, b) => b.diasAtraso - a.diasAtraso || Number(b.urgente) - Number(a.urgente))
      .slice(0, MAX_CRITICOS);
  }
}

module.exports = new ValeRendimientoService();
