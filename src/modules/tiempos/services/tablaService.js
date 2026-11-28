// src/modules/tiempos/services/tablaService.js
// Lo que ven los usuarios: la tabla publicada (para consultar) y el cálculo de un pedido. La tabla se guarda en memoria un minuto
// (o hasta que se publique otra versión: `invalidar()`).
const tablaRepository = require('../repositories/tablaRepository');
const { calcularPedido } = require('../calculo/motor');
const { resumenTexto } = require('../calculo/resumen');
const { hacerDiaHabil, esFechaISO, fechaLarga } = require('../calculo/fechas');
const { errorDeValidacion, sinTabla } = require('../errores');
const { extrasDe, textoExtra } = require('../calculo/extras');

const TTL_MS = 60 * 1000;
let cache = null;
let cargadoEn = 0;

const entero = (v) => (typeof v === 'number' ? v : (typeof v === 'string' && /^\d{1,9}$/.test(v.trim()) ? Number(v.trim()) : v));
// Lo que se eligió de cada extra: solo valores simples (sí/no, número o clave de opción) y como mucho 50.
function limpiarExtras(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  const limpio = {};
  for (const [k, v] of Object.entries(x).slice(0, 50)) {
    if (typeof k !== 'string' || k.length > 80) continue;
    limpio[k] = typeof v === 'boolean' || v === null ? v : (typeof v === 'number' || typeof v === 'string' ? entero(v) : '__invalido__');
  }
  return limpio;
}
const hoyGuatemala = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

class TablaService {
  invalidar() { cache = null; cargadoEn = 0; }

  async tablaPublicada() {
    if (cache && Date.now() - cargadoEn < TTL_MS) return cache;
    const version = await tablaRepository.versionPublicada();
    if (!version) throw sinTabla();
    cache = await tablaRepository.cargarTabla(version);
    cargadoEn = Date.now();
    return cache;
  }

  // Para las pantallas: todo lo necesario para elegir y para consultar, con «Cliente» ya calculado en cada rango
  // y, en cada producto, las claves de los extras que se le ofrecen (en el orden de la tabla).
  async catalogo() {
    const t = await this.tablaPublicada();
    const margen = t.parametros.margen_dias === undefined ? 1 : t.parametros.margen_dias;
    const lineasVisibles = new Set(t.lineas.filter(l => l.activo).map(l => l.clave));
    const productos = Object.values(t.productos).filter(p => p.activo && lineasVisibles.has(p.linea)).map(p => ({
      clave: p.clave, nombre: p.nombre, linea: p.linea, categoria: p.categoria, grupo: p.grupo,
      etapas: p.etapas.map(e => ({ clave: e, nombre: t.etapas[e] ? t.etapas[e].nombre : e })), avisos: p.avisos,
      extras: extrasDe(t, p).map(e => e.clave),
      minimo: p.rangos[0] ? p.rangos[0].desde : 1,
      rangos: p.rangos.map(r => ({
        desde: r.desde, hasta: r.hasta, aConvenir: r.aConvenir, dias: r.dias,
        cliente: r.aConvenir ? null : Object.values(r.dias).reduce((a, b) => a + b, 0) + margen
      }))
    }));
    return {
      version: { numero: t.version.numero, fecha: t.version.fecha }, lineas: t.lineas.filter(l => l.activo).map(l => ({ clave: l.clave, nombre: l.nombre })), productos,
      extras: t.extras.filter(e => e.activo).map(e => ({
        clave: e.clave, tipo: e.tipo, nombre: e.nombre, etiqueta: e.etiqueta, ayuda: e.ayuda, aviso: e.aviso, resumen: textoExtra(e),
        diasFijos: e.diasFijos, unidades: e.unidades, opciones: e.opciones
      })),
      parametros: t.parametros, avisosGenerales: t.avisosGenerales
    };
  }

  // Festivos de Guatemala (los de una sola fecha y los que se repiten cada año) de `anio` a `anio + 2`: Map fecha → nombre.
  async festivosMapa(anio) {
    const filas = await tablaRepository.feriadosGuatemala();
    const mapa = new Map();
    for (const f of filas) {
      if (f.seRepite) { for (let a = anio; a <= anio + 2; a++) mapa.set(`${a}${f.fecha.slice(4)}`, f.nombre); } else mapa.set(f.fecha, f.nombre);
    }
    return mapa;
  }

  async festivos(anio) { return new Set((await this.festivosMapa(anio)).keys()); }

  // Para el calendario de la pantalla: festivos entre dos fechas, [{ fecha, nombre }].
  async festivosEntre(desde, hasta) {
    if (!esFechaISO(desde) || !esFechaISO(hasta) || desde > hasta) throw errorDeValidacion('Revisa las fechas.', { desde: 'Fechas no válidas.' });
    const mapa = await this.festivosMapa(Number(desde.slice(0, 4)));
    return [...mapa.entries()].filter(([f]) => f >= desde && f <= hasta).sort(([a], [b]) => (a < b ? -1 : 1)).map(([fecha, nombre]) => ({ fecha, nombre }));
  }

  // `entrada`: { fechaOrden?, piezas: [{ productoClave, cantidad, extras?: { clave: valor }, urgente? }] } (también acepta colores, moldesGrande, lanyard y uv).
  async calcular(entrada) {
    const cuerpo = entrada && typeof entrada === 'object' ? entrada : {};
    if (!Array.isArray(cuerpo.piezas) || !cuerpo.piezas.length) throw errorDeValidacion('Agrega al menos una pieza.', { piezas: 'Agrega al menos una pieza.' });
    const tabla = await this.tablaPublicada();
    const maximo = Number.isInteger(tabla.parametros.max_piezas) ? tabla.parametros.max_piezas : 20;
    if (cuerpo.piezas.length > maximo) throw errorDeValidacion(`Un pedido admite hasta ${maximo} piezas.`, { piezas: `Un pedido admite hasta ${maximo} piezas.` });
    const fechaOrden = cuerpo.fechaOrden || hoyGuatemala();
    if (!esFechaISO(fechaOrden)) throw errorDeValidacion('Elige la fecha de la orden.', { fechaOrden: 'Elige la fecha de la orden.' });
    const piezas = cuerpo.piezas.map(p => {
      const x = p && typeof p === 'object' ? p : {};
      return {
        productoClave: typeof x.productoClave === 'string' ? x.productoClave : '', cantidad: entero(x.cantidad),
        colores: x.colores === undefined || x.colores === null || x.colores === '' ? undefined : entero(x.colores),
        moldesGrande: x.moldesGrande === true, lanyard: x.lanyard === true, uv: typeof x.uv === 'string' && x.uv ? x.uv : null, urgente: x.urgente === true,
        extras: limpiarExtras(x.extras)
      };
    });
    const festivos = await this.festivos(Number(fechaOrden.slice(0, 4)));
    const resultado = calcularPedido(tabla, { fechaOrden, piezas }, { esHabil: hacerDiaHabil(festivos) });
    if (resultado.estado === 'invalida') {
      const campos = {};
      resultado.piezas.forEach((p, i) => { if (p.estado === 'invalida') for (const [k, v] of Object.entries(p.errores)) campos[`piezas.${i}.${k}`] = v; });
      throw errorDeValidacion('Revisa los datos marcados.', campos);
    }
    return {
      ...resultado, fechaOrden, fechaEntregaTexto: resultado.fechaEntrega ? fechaLarga(resultado.fechaEntrega) : null,
      resumen: resumenTexto({ ...resultado, fechaOrden })
    };
  }
}

module.exports = new TablaService();
