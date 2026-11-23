// src/modules/tiempos/services/tablaService.js
// Lo que ven los usuarios: la tabla publicada (para consultar) y el cálculo de un pedido. La tabla se guarda en memoria un minuto
// (o hasta que se publique otra versión: `invalidar()`).
const tablaRepository = require('../repositories/tablaRepository');
const { calcularPedido } = require('../calculo/motor');
const { resumenTexto } = require('../calculo/resumen');
const { hacerDiaHabil, esFechaISO, fechaLarga } = require('../calculo/fechas');
const { errorDeValidacion, sinTabla } = require('../errores');

const TTL_MS = 60 * 1000;
const MAX_PIEZAS = 20;
let cache = null;
let cargadoEn = 0;

const entero = (v) => (typeof v === 'number' ? v : (typeof v === 'string' && /^\d{1,9}$/.test(v.trim()) ? Number(v.trim()) : v));
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

  // Para las pantallas: todo lo necesario para elegir y para consultar, con «Cliente» ya calculado en cada rango.
  async catalogo() {
    const t = await this.tablaPublicada();
    const margen = t.parametros.margen_dias === undefined ? 1 : t.parametros.margen_dias;
    const productos = Object.values(t.productos).filter(p => p.activo).map(p => ({
      clave: p.clave, nombre: p.nombre, linea: p.linea, grupo: p.grupo, permiteMoldes: p.permiteMoldes, permiteLanyard: p.permiteLanyard,
      etapas: p.etapas.map(e => ({ clave: e, nombre: t.etapas[e] ? t.etapas[e].nombre : e })), avisos: p.avisos,
      minimo: p.rangos[0] ? p.rangos[0].desde : 1,
      rangos: p.rangos.map(r => ({
        desde: r.desde, hasta: r.hasta, aConvenir: r.aConvenir, dias: r.dias,
        cliente: r.aConvenir ? null : Object.values(r.dias).reduce((a, b) => a + b, 0) + margen
      }))
    }));
    return {
      version: { numero: t.version.numero, fecha: t.version.fecha }, lineas: t.lineas, productos,
      extras: Object.values(t.extras).map(e => ({ clave: e.clave, nombre: e.nombre, aviso: e.aviso, rangos: e.rangos })),
      parametros: t.parametros, avisosGenerales: t.avisosGenerales
    };
  }

  // Festivos de Guatemala (los de cada año y los que se repiten) para el año de la orden y los dos siguientes.
  async festivos(anio) {
    const filas = await tablaRepository.feriadosGuatemala();
    const set = new Set();
    for (const f of filas) {
      if (f.seRepite) { for (let a = anio; a <= anio + 2; a++) set.add(`${a}${f.fecha.slice(4)}`); } else set.add(f.fecha);
    }
    return set;
  }

  // `entrada`: { fechaOrden?, piezas: [{ productoClave, cantidad, colores?, moldesGrande?, lanyard?, uv?, urgente? }] }
  async calcular(entrada) {
    const cuerpo = entrada && typeof entrada === 'object' ? entrada : {};
    if (!Array.isArray(cuerpo.piezas) || !cuerpo.piezas.length) throw errorDeValidacion('Agrega al menos una pieza.', { piezas: 'Agrega al menos una pieza.' });
    if (cuerpo.piezas.length > MAX_PIEZAS) throw errorDeValidacion(`Un pedido admite hasta ${MAX_PIEZAS} piezas.`, { piezas: `Un pedido admite hasta ${MAX_PIEZAS} piezas.` });
    const fechaOrden = cuerpo.fechaOrden || hoyGuatemala();
    if (!esFechaISO(fechaOrden)) throw errorDeValidacion('Elige la fecha de la orden.', { fechaOrden: 'Elige la fecha de la orden.' });
    const piezas = cuerpo.piezas.map(p => {
      const x = p && typeof p === 'object' ? p : {};
      return {
        productoClave: typeof x.productoClave === 'string' ? x.productoClave : '', cantidad: entero(x.cantidad),
        colores: x.colores === undefined || x.colores === null || x.colores === '' ? undefined : entero(x.colores),
        moldesGrande: x.moldesGrande === true, lanyard: x.lanyard === true, uv: typeof x.uv === 'string' && x.uv ? x.uv : null, urgente: x.urgente === true
      };
    });
    const tabla = await this.tablaPublicada();
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
