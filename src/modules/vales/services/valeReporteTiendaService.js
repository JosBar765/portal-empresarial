// src/modules/vales/services/valeReporteTiendaService.js
// Reporte de actividad de tienda (pestaña Reportes 2): el armado del reporte de Actividad, agrupado solo por tienda y solo con vales autorizados.
const reporteRepository = require('../repositories/reporteRepository');
const valeReporteService = require('./valeReporteService');
const valeReporteGruposService = require('./valeReporteGruposService');
const valeReportePdfService = require('./valeReportePdfService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { esSupervisor, hoyISO } = require('./valeHelpers');

const { resolverVentanaReporte, rangoDe, etiquetaPeriodo, dentro, antesDe } = valeReporteService.periodo;

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
  // `filtros`: ventana, fecha, desde, hasta y tiendaId (entero o null, ya validado por el controlador).
  async obtenerReporte(usuario, filtros = {}) {
    const rango = rangoDe(resolverVentanaReporte(filtros));
    const acotado = esSupervisor(usuario);
    const tiendas = await tiendasVisibles(usuario);
    const tiendaId = filtros.tiendaId || null;
    if (tiendaId && !tiendas.some(t => t.id === tiendaId)) throw new ErrorDeNegocio(TEXTOS.tiendaAjena, 400);
    // Un supervisor sin tiendas queda con un id inexistente: un filtro vacío mostraría todas.
    const ids = tiendaId ? [tiendaId] : (acotado ? tiendas.map(t => t.id) : []);
    const tiendaSel = new Set(acotado && !ids.length ? [0] : ids);
    const corte = hoyISO();
    const argumentos = {
      alcance: { rol: 'tienda', equipo: true, personas: [] },
      dentroDelRango: (f) => dentro(f, rango), agruparPor: 'tienda', tiendaSel,
      tallerSel: new Set(), asesorSel: new Set(), disSel: new Set(), corte, soloAutorizados: true
    };
    const grupos = await valeReporteGruposService.armar(argumentos);
    const vigentes = await valeReporteGruposService.armar({ ...argumentos, soloAtrasadosAntesDe: (f) => antesDe(f, rango) });
    const { secciones, totalVales, truncado } = grupos;
    const nombres = tiendaId ? tiendas.filter(t => t.id === tiendaId).map(t => t.nombre).join(', ') : null;
    return {
      titulo: acotado ? TEXTOS.tituloSupervisor : TEXTOS.titulo,
      alcance: acotado ? 'supervisadas' : 'todas',
      periodo: { ...rango, corte, etiqueta: etiquetaPeriodo(rango), titulo: `Fecha de entrega: ${etiquetaPeriodo(rango)}` },
      tiendaId,
      resumenFiltros: [nombres ? `Tiendas: ${nombres}` : TEXTOS.tiendasTodas],
      conteos: {
        atrasadosAntes: vigentes.total,
        ...Object.fromEntries(SECCIONES.map(clave => [clave, secciones[clave].total]))
      },
      atrasadosVigentes: { total: vigentes.total, truncado: vigentes.truncado, grupos: vigentes.grupos },
      grupos: { agruparPor: 'tienda', secciones, totalVales, truncado },
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
