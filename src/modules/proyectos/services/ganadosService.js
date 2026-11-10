// src/modules/proyectos/services/ganadosService.js
// Cartera de clientes ganados: las empresas con venta confirmada en cualquier proyecto, para posventa y recompra.
// Alcance: el asesor ve las que vendió él; el supervisor, además, las de sus tiendas; gerencia y administración, todas.
// La recompra sugerida es la última venta más los meses del parámetro `ganados.meses_recompra`.
const ganadosRepository = require('../repositories/ganadosRepository');
const configService = require('./configService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');

const tiene = (usuario, permiso) => (usuario.permissions || []).includes(permiso);
const PERMISOS = ['proyectos.gestionar', 'proyectos.supervisar', 'proyectos.ver_gerencia', 'proyectos.administrar'];
const PERIODOS = [3, 6, 12, 24];
const DIAS_PROXIMA = 30;
const POR_PAGINA = 100;
const DIA_MS = 86400000;

const diaDe = (fecha) => new Date(fecha).toISOString().slice(0, 10);
// Suma meses a un día «AAAA-MM-DD» sin pasarse del fin de mes (31 ene + 1 mes = 28 feb).
const sumarMeses = (dia, meses) => {
  const [a, m, d] = dia.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)).getUTCDate();
  f.setUTCDate(Math.min(d, ultimo));
  return f.toISOString().slice(0, 10);
};
const hoyGT = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
const diasEntre = (desde, hasta) => Math.round((Date.parse(hasta) - Date.parse(desde)) / DIA_MS);

class GanadosService {
  _exigir(usuario) {
    if (!PERMISOS.some(p => tiene(usuario, p))) throw new ErrorDeNegocio('No tienes permiso para realizar esta acción.', 403);
  }

  async _ventas(usuario, clienteId = null) {
    const todos = tiene(usuario, 'proyectos.ver_gerencia') || tiene(usuario, 'proyectos.administrar');
    return ganadosRepository.ventas({ todos, usuarioId: usuario.id, tiendaIds: todos ? [] : await ganadosRepository.tiendasSupervisadas(usuario.id), clienteId });
  }

  // Agrupa las ventas por empresa: la última venta, el total por moneda (sin mezclarlas) y la recompra sugerida.
  async _empresas(usuario) {
    const [ventas, ajustes] = await Promise.all([this._ventas(usuario), configService.valores()]);
    const meses = ajustes['ganados.meses_recompra'];
    const hoy = hoyGT();
    const por = new Map();
    for (const v of ventas) { // vienen de la más reciente a la más antigua
      let e = por.get(v.cliente_id);
      if (!e) {
        const fecha = diaDe(v.fecha);
        const fechaRecompra = sumarMeses(fecha, meses);
        const dias = diasEntre(hoy, fechaRecompra);
        e = {
          id: v.cliente_id, nombre: v.nombre, ciudad: v.ciudad, pais: v.pais, nichoId: v.nicho_id, nicho: v.nicho, telefono: v.contacto_telefono || v.telefono || null, asesor: v.asesor || null,
          ultimaVenta: { fecha, monto: Number(v.monto), moneda: v.moneda, referencia: v.referencia || null },
          ventas: 0, totales: new Map(),
          recompra: { fecha: fechaRecompra, dias, estado: dias < 0 ? 'vencida' : dias <= DIAS_PROXIMA ? 'proxima' : 'lejana' }
        };
        por.set(v.cliente_id, e);
      }
      e.ventas += 1;
      e.totales.set(v.moneda, (e.totales.get(v.moneda) || 0) + Number(v.monto));
    }
    return {
      meses,
      empresas: [...por.values()].map(e => ({ ...e, totales: [...e.totales].map(([moneda, monto]) => ({ moneda, monto: Math.round(monto * 100) / 100 })).sort((a, b) => a.moneda.localeCompare(b.moneda)) }))
    };
  }

  _filtrar(empresas, consulta) {
    const periodo = PERIODOS.includes(aEntero(consulta.periodo)) ? aEntero(consulta.periodo) : null;
    const desde = periodo ? sumarMeses(hoyGT(), -periodo) : null;
    const nicho = aEntero(consulta.nicho);
    const recompra = ['vencida', 'proxima'].includes(consulta.recompra) ? consulta.recompra : null;
    const buscar = String(consulta.busqueda || '').trim().toLowerCase().slice(0, 100);
    return empresas
      .filter(e => (!desde || e.ultimaVenta.fecha >= desde) && (!nicho || e.nichoId === nicho) && (!recompra || e.recompra.estado === recompra)
        && (!buscar || e.nombre.toLowerCase().includes(buscar)))
      // Primero las que ya toca ofrecer de nuevo; a igual fecha, por nombre.
      .sort((a, b) => a.recompra.fecha.localeCompare(b.recompra.fecha) || a.nombre.localeCompare(b.nombre));
  }

  async listar(usuario, consulta = {}) {
    this._exigir(usuario);
    const { meses, empresas } = await this._empresas(usuario);
    const filtradas = this._filtrar(empresas, consulta);
    const pagina = Math.max(aEntero(consulta.pagina) || 1, 1);
    const nichos = [...new Map(empresas.map(e => [e.nichoId, e.nicho])).entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
    return {
      items: filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA), total: filtradas.length, pagina, porPagina: POR_PAGINA,
      hayMas: pagina * POR_PAGINA < filtradas.length, mesesRecompra: meses, nichos, periodos: PERIODOS,
      permisos: { crearVale: tiene(usuario, 'proyectos.gestionar') }
    };
  }

  // Para exportar: las mismas empresas y filtros, sin paginar.
  async paraExportar(usuario, consulta = {}) {
    this._exigir(usuario);
    const { empresas } = await this._empresas(usuario);
    return this._filtrar(empresas, consulta);
  }

  // ¿Esta empresa está en la cartera de quien pregunta? Sirve al prellenado del vale de recompra.
  async enAlcance(usuario, clienteId) {
    this._exigir(usuario);
    const id = aEntero(clienteId);
    if (!id) return false;
    return (await this._ventas(usuario, id)).length > 0;
  }
}

module.exports = new GanadosService();
