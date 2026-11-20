// src/modules/vales/services/valeReporteEquiposService.js
// Reportes de actividad de talleres, diseñadores y asesores (pestaña Reportes 2): el armado del reporte de Actividad con la misma
// forma que el de tienda, agrupado por otra entidad y solo con vales autorizados. El alcance se decide por permiso, no por rol.
const reporteRepository = require('../repositories/reporteRepository');
const tallerRepository = require('../repositories/tallerRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const valeReportePeriodo = require('./valeReportePeriodo');
const valeReporteGruposService = require('./valeReporteGruposService');
const valeReportePdfService = require('./valeReportePdfService');
const { aplicarFiltroPdf } = require('./valeReporteFiltroDesglose');
const valeCatalogoService = require('./valeCatalogoService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { esSupervisor, esAdministrador, esDeTaller, hoyISO } = require('./valeHelpers');

const MAX_ELEGIDOS = 500;

const { resolverVentanaReporte, rangoDe, etiquetaPeriodo, dentro, antesDe } = valeReportePeriodo.periodo;
const { etiquetaTalleresFiltro, etiquetaTiendasFiltro } = valeReportePeriodo;

const TEXTOS = {
  ajeno: 'Esa selección no existe o no está a tu cargo.',
  tiendaAjena: 'Esa tienda no existe o no está a tu cargo.',
  tiendasTodas: 'Tiendas: Todas',
  sinAcceso: 'Este reporte no está disponible para tu alcance.'
};
const paraMenuTienda = (t) => ({ id: t.id, nombre: t.nombre, codigo: t.codigo ?? null, pais_nombre: t.pais_nombre ?? null, departamento_nombre: t.departamento_nombre ?? null });
const SECCIONES = ['atrasados', 'noEntregados', 'entregados'];

// Por tipo de reporte: cómo se agrupa, qué filtro usa y cuál es su definición de «entregado» (taller: aprobado por el Encargado; asesor: ya llegó al asesor).
const TIPOS = {
  taller: { agruparPor: 'taller', clave: 'tallerIds', menu: 'talleres', titulo: 'Actividad de talleres', tituloAcotado: 'Actividad de mis talleres', todos: 'Talleres: Todos', entregadoPorTaller: true },
  disenador: { agruparPor: 'disenador', clave: 'disenadorIds', menu: 'disenadores', titulo: 'Actividad de diseñadores', tituloAcotado: 'Actividad de mis diseñadores', todos: 'Diseñadores: Todos', entregadoPorTaller: true, uno: 'Diseñador', varios: 'Diseñadores' },
  asesor: { agruparPor: 'asesor', clave: 'asesorIds', menu: 'asesores', titulo: 'Actividad de asesores', tituloAcotado: 'Actividad de mis asesores', todos: 'Asesores: Todos', entregadoPorTaller: false, uno: 'Asesor', varios: 'Asesores' }
};

const idsDe = (texto) => String(texto || '').split(',').map(Number).filter(Boolean);

class ValeReporteEquiposService {
  // Alcance por permiso: `vales.gestionar_taller` (sus talleres), `vales.supervisar` (sus asesores y su zona); ambos se unen; sin ninguno, todo.
  // El administrador nunca se acota, como en Actividad.
  async _acceso(usuario) {
    const sup = esSupervisor(usuario) && !esAdministrador(usuario);
    const enc = esDeTaller(usuario);
    let tallerEnc = [];
    if (enc) {
      try {
        const idEfectivo = await valeCatalogoService.idEncargadoEfectivo(usuario);
        tallerEnc = (await tallerRepository.listarActivos()).filter(t => t.encargado_id === idEfectivo).map(t => t.id);
      } catch (error) {
        throw new ErrorDeNegocio(error.message, 403);
      }
    }
    const tallerSup = sup ? (await tallerRepository.listarIdsPorSupervisor(usuario.id)).map(t => t.id) : [];
    // Él también crea vales: aparece como «(yo)» junto a sus asesores.
    const asesoresSup = sup ? await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id) : [];
    return {
      sup, enc, global: !sup && !enc,
      tallerEnc: new Set(tallerEnc), tallerSup: new Set(tallerSup), talleres: new Set([...tallerEnc, ...tallerSup]),
      asesoresSup: new Set([...asesoresSup.map(a => a.id), ...(sup ? [usuario.id] : [])]), asesoresSupLista: asesoresSup
    };
  }

  // Opciones del filtro del tipo, ya acotadas al alcance del usuario.
  async _opciones(tipo, usuario, acceso) {
    if (tipo === 'taller') {
      const talleres = (await tallerRepository.listarTodos()).filter(t => acceso.global || acceso.talleres.has(t.id));
      const tiendasDeTaller = new Map();
      (await reporteRepository.listarTiendasPorTaller()).forEach(r => tiendasDeTaller.set(r.taller_id, [...(tiendasDeTaller.get(r.taller_id) || []), r.tienda_id]));
      // El país de un taller sale de sus tiendas (talleres.tienda_id es nulo en los centrales).
      const paisDeTienda = new Map((await reporteRepository.listarTiendas()).map(t => [t.id, t.pais_nombre]));
      return talleres.map(t => ({
        id: t.id, nombre: t.nombre, tiendaIds: tiendasDeTaller.get(t.id) || [],
        paises: [...new Set((tiendasDeTaller.get(t.id) || []).map(id => paisDeTienda.get(id)).filter(Boolean))]
      }));
    }
    if (tipo === 'disenador') {
      return (await reporteRepository.listarDisenadores())
        .map(d => ({ id: d.id, nombre: valeReporteGruposService.etiquetaNombre(d.nombre, d.rol_id, d.hereda_de_rol_id), tallerIds: idsDe(d.taller_ids) }))
        .filter(d => acceso.global || d.tallerIds.some(id => acceso.talleres.has(id)));
    }
    if (acceso.sup) {
      return [{ id: usuario.id, nombre: `${usuario.nombre} (yo)` }, ...acceso.asesoresSupLista.filter(a => a.id !== usuario.id).map(a => ({ id: a.id, nombre: a.nombre, tiendaId: a.tienda_id ?? null }))];
    }
    // `tiendaId`: el selector de asesores del reporte se acota a la tienda elegida sin volver a consultar.
    return (await reporteRepository.listarAsesores()).map(a => ({ id: a.id, nombre: a.nombre, tiendaId: a.tienda_id ?? null }));
  }

  // Un vale entra si lo permite alguna de las partes del alcance: la del supervisor (sus asesores, en talleres de su zona) o la del taller (sus talleres).
  _permitirVale(tipo, acceso) {
    if (acceso.global) return null;
    if (tipo === 'asesor') return (v) => acceso.asesoresSup.has(v.asesor_id);
    const en = (ids, filas) => filas.some(f => ids.has(f.taller_id));
    return (v, filas) => (acceso.sup && acceso.asesoresSup.has(v.asesor_id) && en(acceso.tallerSup, filas)) || (acceso.enc && en(acceso.tallerEnc, filas));
  }

  _resumen(tipo, config, elegidas, opciones) {
    if (!elegidas.length) return config.todos;
    if (tipo === 'taller') return etiquetaTalleresFiltro(elegidas, opciones);
    if (elegidas.length === 1) return `${config.uno}: ${(opciones.find(o => o.id === elegidas[0]) || {}).nombre || elegidas[0]}`;
    return `${config.varios}: ${elegidas.length} seleccionados`;
  }

  // Tipo válido, alcance del usuario y opciones del filtro: lo comparten el reporte y su endpoint de opciones para no diverger.
  async _contexto(tipo, usuario) {
    const config = TIPOS[tipo];
    if (!config) throw new ErrorDeNegocio('El tipo de reporte no es válido.');
    const acceso = await this._acceso(usuario);
    // Un encargado de taller sin supervisión no tiene asesores que mostrar: no se le ofrece el reporte.
    if (tipo === 'asesor' && !acceso.global && !acceso.sup) throw new ErrorDeNegocio(TEXTOS.sinAcceso, 403);
    const opciones = await this._opciones(tipo, usuario, acceso);
    // Solo el reporte de asesores: además lleva el filtro de tienda.
    const tiendas = tipo === 'asesor' ? await (acceso.sup ? reporteRepository.listarTiendasPorSupervisor(usuario.id) : reporteRepository.listarTiendas()) : [];
    return { config, acceso, opciones, tiendas };
  }

  // Opciones de los filtros sin recorrer vales: las mismas que lleva el reporte generado.
  async obtenerOpciones(tipo, usuario) {
    const { config, acceso, opciones, tiendas } = await this._contexto(tipo, usuario);
    return { alcance: acceso.global ? 'todas' : 'acotadas', filtros: { [config.menu]: opciones, ...(tipo === 'asesor' ? { tiendas: tiendas.map(paraMenuTienda) } : {}) } };
  }

  // `filtros`: ventana, fecha, desde, hasta y la lista del tipo (tallerId/tallerIds, disenadorIds o asesorIds), ya validados por el controlador.
  async obtenerReporte(tipo, usuario, filtros = {}) {
    const rango = rangoDe(resolverVentanaReporte(filtros));
    const { config, acceso, opciones, tiendas } = await this._contexto(tipo, usuario);
    const elegidas = [...new Set((tipo === 'taller' ? [filtros.tallerId, ...(filtros.tallerIds || [])] : (filtros[config.clave] || [])).filter(Boolean))].slice(0, MAX_ELEGIDOS);
    // Una selección fuera de lo visible del usuario no se filtra en silencio: responde 400 sin revelar si existe.
    if (elegidas.some(id => !opciones.some(o => o.id === id))) throw new ErrorDeNegocio(TEXTOS.ajeno, 400);
    // Solo el reporte de asesores: además lleva el filtro de tienda (tiendaId/tiendaIds), los contadores y la gráfica por asesor.
    const conTiendas = tipo === 'asesor';
    const tiendasElegidas = conTiendas ? [...new Set([filtros.tiendaId, ...(filtros.tiendaIds || [])].filter(Boolean))].slice(0, MAX_ELEGIDOS) : [];
    if (tiendasElegidas.some(id => !tiendas.some(t => t.id === id))) throw new ErrorDeNegocio(TEXTOS.tiendaAjena, 400);

    const acotado = !acceso.global;
    // Acotado y sin talleres: un id inexistente, porque un filtro vacío mostraría todos.
    const permitidos = acceso.talleres.size ? [...acceso.talleres] : [0];
    let tallerSel = new Set();
    if (tipo === 'taller') tallerSel = new Set(elegidas.length ? elegidas : (acotado ? permitidos : []));
    else if (tipo === 'disenador' && acotado) tallerSel = new Set(permitidos);
    const corte = hoyISO();
    const argumentos = {
      alcance: { rol: tipo, equipo: true, personas: [] },
      dentroDelRango: (f) => dentro(f, rango), agruparPor: config.agruparPor,
      tiendaSel: new Set(tiendasElegidas), tallerSel, asesorSel: new Set(tipo === 'asesor' ? elegidas : []), disSel: new Set(tipo === 'disenador' ? elegidas : []),
      corte, soloAutorizados: true, entregadoPorTaller: config.entregadoPorTaller, permitirVale: this._permitirVale(tipo, acceso), soloUrgentes: tipo === 'asesor' && filtros.soloUrgentes === true
    };
    const grupos = await valeReporteGruposService.armar({ ...argumentos, contadores: conTiendas });
    const vigentes = await valeReporteGruposService.armar({ ...argumentos, soloAtrasadosAntesDe: (f) => antesDe(f, rango) });
    const { secciones, totalVales, truncado, desgloseOmitido } = grupos;
    return {
      titulo: acotado ? config.tituloAcotado : config.titulo,
      alcance: acotado ? 'acotadas' : 'todas',
      periodo: { ...rango, corte, etiqueta: etiquetaPeriodo(rango), titulo: `Fecha de entrega: ${etiquetaPeriodo(rango)}` },
      [config.clave]: elegidas,
      resumenFiltros: [this._resumen(tipo, config, elegidas, opciones), ...(conTiendas ? [tiendasElegidas.length ? etiquetaTiendasFiltro(tiendasElegidas, tiendas) : TEXTOS.tiendasTodas] : [])],
      conteos: {
        atrasadosAntes: vigentes.total,
        ...Object.fromEntries(SECCIONES.map(clave => [clave, secciones[clave].total]))
      },
      atrasadosVigentes: { total: vigentes.total, truncado: vigentes.truncado, grupos: vigentes.grupos },
      grupos: { agruparPor: config.agruparPor, secciones, totalVales, truncado, desgloseOmitido }, // `desgloseOmitido`: demasiados vales para listarlos
      ...(conTiendas ? { tiendaIds: tiendasElegidas, contadores: valeReporteGruposService.completarContadores(grupos.contadores, vigentes, secciones) } : {}),
      filtros: { [config.menu]: opciones, ...(conTiendas ? { tiendas: tiendas.map(paraMenuTienda) } : {}) }
    };
  }

  async generarPdf(tipo, usuario, filtros) {
    // Contadores y gráfica del PDF son siempre los del filtro: «solo urgentes» solo acota el desglose del asesor enfocado.
    const reporte = await this.obtenerReporte(tipo, usuario, { ...filtros, soloUrgentes: false });
    const config = TIPOS[tipo];
    // Quienes se eligieron en el filtro se nombran en la línea de evaluados, como en el PDF de Actividad.
    const evaluados = tipo === 'taller' ? [] : reporte.filtros[config.menu].filter(o => reporte[config.clave].includes(o.id)).map(o => ({ id: o.id, nombre: o.nombre }));
    // `incluirDesglose` (solo lo manda el PDF de asesores): false imprime sin el desglose de vales.
    Object.assign(reporte, { tipo: `actividad-${tipo}`, rol: tipo, evaluados, tablas: [], incluirDesglose: filtros.incluirDesglose !== false });
    // Con un asesor enfocado en la gráfica, el desglose es el suyo (contadores y gráfica siguen siendo los del filtro); `obtenerReporte` ya responde 400 si no es visible.
    if (tipo === 'asesor' && reporte.incluirDesglose && filtros.asesorDesglose) {
      const soloUrgentes = filtros.soloUrgentes === true;
      const deAsesor = await this.obtenerReporte('asesor', usuario, { ...filtros, asesorIds: [filtros.asesorDesglose], soloUrgentes });
      const nombre = (reporte.contadores?.porAsesor || []).find(a => a.id === filtros.asesorDesglose)?.nombre
        || (reporte.filtros.asesores || []).find(a => a.id === filtros.asesorDesglose)?.nombre || deAsesor.resumenFiltros[0];
      Object.assign(reporte, { grupos: deAsesor.grupos, atrasadosVigentes: deAsesor.atrasadosVigentes, desgloseDe: soloUrgentes ? `${nombre} (solo urgentes)` : nombre });
    }
    // El filtro por contador (solo asesores) se aplica al desglose ya elegido; contadores y gráfica siguen siendo los del filtro general.
    const filtrado = tipo === 'asesor' && reporte.incluirDesglose ? aplicarFiltroPdf(reporte, filtros) : reporte;
    const ahora = new Date(Date.now() - 6 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16);
    const [f, h] = ahora.split(' ');
    const [y, m, d] = f.split('-');
    const pdf = await valeReportePdfService.generar(filtrado, { generadoPor: usuario.nombre, ahora: `${d}/${m}/${y} ${h}` });
    return { reporte: filtrado, pdf };
  }
}

module.exports = new ValeReporteEquiposService();
