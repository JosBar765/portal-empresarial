// src/modules/vales/services/valeReporteTiendaService.js
// Reporte de actividad de tienda (pestaña Reportes 2): el armado del reporte de Actividad, agrupado solo por tienda y solo con vales autorizados.
const reporteRepository = require('../repositories/reporteRepository');
const valeReporteService = require('./valeReporteService');
const valeReporteGruposService = require('./valeReporteGruposService');
const valeReportePdfService = require('./valeReportePdfService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { esSupervisor, hoyISO } = require('./valeHelpers');

const MAX_TIENDAS_FILTRO = 500;

const { resolverVentanaReporte, rangoDe, etiquetaPeriodo, dentro, antesDe } = valeReporteService.periodo;
const { etiquetaTiendasFiltro } = valeReporteService;

const TEXTOS = {
  titulo: 'Actividad de tienda',
  tituloSupervisor: 'Actividad de mis tiendas',
  tiendasTodas: 'Tiendas: Todas',
  tiendaAjena: 'Esa tienda no existe o no está a tu cargo.'
};
const SECCIONES = ['atrasados', 'noEntregados', 'entregados'];

// Quien tiene `vales.supervisar` solo ve las tiendas bajo su supervisión; cualquier otro con el permiso del reporte ve todas.
const tiendasVisibles = (usuario) => (esSupervisor(usuario) ? reporteRepository.listarTiendasPorSupervisor(usuario.id) : reporteRepository.listarTiendas());
const paraMenu = (t) => ({ id: t.id, nombre: t.nombre, codigo: t.codigo ?? null, pais_nombre: t.pais_nombre ?? null, departamento_nombre: t.departamento_nombre ?? null });

class ValeReporteTiendaService {
  // `filtros`: ventana, fecha, desde, hasta, tiendaId (entero o null) y tiendaIds (enteros), ya validados por el controlador.
  async obtenerReporte(usuario, filtros = {}) {
    const rango = rangoDe(resolverVentanaReporte(filtros));
    const acotado = esSupervisor(usuario);
    const tiendas = await tiendasVisibles(usuario);
    const elegidas = [...new Set([filtros.tiendaId, ...(filtros.tiendaIds || [])].filter(Boolean))].slice(0, MAX_TIENDAS_FILTRO);
    // Una tienda fuera de las visibles del usuario no se filtra en silencio: responde 400 sin revelar si existe.
    if (elegidas.some(id => !tiendas.some(t => t.id === id))) throw new ErrorDeNegocio(TEXTOS.tiendaAjena, 400);
    // Un supervisor sin tiendas queda con un id inexistente: un filtro vacío mostraría todas.
    const ids = elegidas.length ? elegidas : (acotado ? tiendas.map(t => t.id) : []);
    const tiendaSel = new Set(acotado && !ids.length ? [0] : ids);
    const corte = hoyISO();
    const argumentos = {
      alcance: { rol: 'tienda', equipo: true, personas: [] },
      dentroDelRango: (f) => dentro(f, rango), agruparPor: 'tienda', tiendaSel,
      tallerSel: new Set(), asesorSel: new Set(), disSel: new Set(), corte, soloAutorizados: true
    };
    const grupos = await valeReporteGruposService.armar({ ...argumentos, contadores: true });
    const vigentes = await valeReporteGruposService.armar({ ...argumentos, soloAtrasadosAntesDe: (f) => antesDe(f, rango) });
    const { secciones, totalVales, truncado } = grupos;
    return {
      titulo: acotado ? TEXTOS.tituloSupervisor : TEXTOS.titulo,
      alcance: acotado ? 'supervisadas' : 'todas',
      periodo: { ...rango, corte, etiqueta: etiquetaPeriodo(rango), titulo: `Fecha de entrega: ${etiquetaPeriodo(rango)}` },
      tiendaIds: elegidas,
      // Nombra la selección (tienda, país o grupo) igual que el PDF de Actividad.
      resumenFiltros: [elegidas.length ? etiquetaTiendasFiltro(elegidas, tiendas) : TEXTOS.tiendasTodas],
      conteos: {
        atrasadosAntes: vigentes.total,
        ...Object.fromEntries(SECCIONES.map(clave => [clave, secciones[clave].total]))
      },
      atrasadosVigentes: { total: vigentes.total, truncado: vigentes.truncado, grupos: vigentes.grupos },
      grupos: { agruparPor: 'tienda', secciones, totalVales, truncado },
      contadores: grupos.contadores,
      filtros: { tiendas: tiendas.map(paraMenu) }
    };
  }

  async generarPdf(usuario, filtros) {
    const reporte = await this.obtenerReporte(usuario, filtros);
    // Mismas claves que el PDF de Actividad: sin evaluados y con el título propio del reporte.
    Object.assign(reporte, { tipo: 'actividad-tienda', rol: 'tienda', evaluados: [], tablas: [] });
    const ahora = new Date(Date.now() - 6 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16);
    const [f, h] = ahora.split(' ');
    const [y, m, d] = f.split('-');
    const pdf = await valeReportePdfService.generar(reporte, { generadoPor: usuario.nombre, ahora: `${d}/${m}/${y} ${h}` });
    return { reporte, pdf };
  }
}

module.exports = new ValeReporteTiendaService();
