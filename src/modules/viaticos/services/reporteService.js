// src/modules/viaticos/services/reporteService.js
// Casos de uso de los reportes: inversión por solicitante y reparto por categoría (siempre lo AUTORIZADO, nunca lo liquidado).
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idOpcional } = require('../../../core/utils/validar');
const repo = require('../repositories/reporteRepository');
const { REPORTES } = require('../constantes');
const { aCentavos } = require('../dinero');
const { cuerpoObjeto } = require('../validacion');
const { msg } = require('../mensajes');
const solicitudService = require('./solicitudService');
const calculo = require('./reporteCalculoService');
const { generarPdfReporte } = require('./pdf/reportePdfService');

const nombreDeCategoria = clave => msg(`reporte.categoria.${clave}`);

// Ventana (mismos `desde`/`hasta` y semana actual por omisión que Gestiones) y filtros opcionales.
function leerFiltros(query) {
  const { desde, hasta } = solicitudService.leerParametrosDeLista(query);
  const parametros = cuerpoObjeto(query);
  return {
    desde,
    hasta,
    monedaId: idOpcional(parametros.monedaId, 'Moneda'),
    paisId: idOpcional(parametros.paisId, 'País'),
    solicitanteId: idOpcional(parametros.solicitanteId, 'Solicitante')
  };
}

class ReporteService {
  async opciones(query) {
    const { desde, hasta } = leerFiltros(query);
    const [monedas, paises] = await Promise.all([repo.monedasConMovimiento({ desde, hasta }), repo.paisesConMovimiento({ desde, hasta })]);
    return {
      monedas: monedas.map(({ id, codigo, nombre, simbolo }) => ({ id, codigo, nombre, simbolo })),
      paises,
      monedaPorDefecto: monedas.length > 0 ? monedas[0].id : null
    };
  }

  async generar(query) {
    const filtros = leerFiltros(query);
    const { desde, hasta, solicitanteId } = filtros;
    const [moneda, pais] = await Promise.all([this.resolverMoneda(filtros), this.resolverPais(filtros.paisId)]);
    const vacio = { desde, hasta, moneda, pais };
    if (!moneda) return { ...vacio, ...this.armar([], solicitanteId) };
    const filas = await repo.listarSolicitudes({ desde, hasta, monedaId: moneda.id, paisId: filtros.paisId });
    return { ...vacio, ...this.armar(filas, solicitanteId) };
  }

  // Sin `monedaId`: la de mayor total autorizado en la ventana (sin tasas de cambio no se mezclan monedas).
  async resolverMoneda({ desde, hasta, monedaId }) {
    if (monedaId !== null) {
      const moneda = await repo.obtenerMoneda(monedaId);
      if (!moneda) throw new ErrorDeNegocio(msg('reporte.monedaNoExiste', { id: monedaId }), 404);
      return moneda;
    }
    const [mayor] = await repo.monedasConMovimiento({ desde, hasta });
    return mayor ? { id: mayor.id, codigo: mayor.codigo, nombre: mayor.nombre, simbolo: mayor.simbolo } : null;
  }

  async resolverPais(paisId) {
    if (paisId === null) return null;
    const pais = await repo.obtenerPais(paisId);
    if (!pais) throw new ErrorDeNegocio(msg('reporte.paisNoExiste', { id: paisId }), 404);
    return pais;
  }

  // Los totales usan el total_solicitado guardado; las categorías, el cálculo por partes. Si no cuadran se avisa en el log y se conservan las categorías.
  armar(filas, solicitanteId) {
    const conCategorias = filas.map(fila => {
      const categorias = calculo.categoriasDeSolicitud(fila);
      const suma = Object.values(categorias).reduce((a, b) => a + b, 0);
      const guardado = aCentavos(fila.totalSolicitado);
      if (suma !== guardado) {
        console.error(`[Viáticos] Reportes: las categorías de ${fila.correlativo} suman ${suma} centavos y su total guardado es ${guardado}.`);
      }
      return { fila, categorias, total: guardado };
    });
    const { solicitantes, resumen } = calculo.agruparPorSolicitante(
      conCategorias.map(({ fila, total }) => ({ solicitanteId: fila.solicitanteId, nombre: fila.solicitanteNombre, total }))
    );
    const delAlcance = solicitanteId === null ? conCategorias : conCategorias.filter(({ fila }) => fila.solicitanteId === solicitanteId);
    const montos = calculo.sumarCategorias(delAlcance.map(({ categorias }) => categorias));
    const nombreAlcance = delAlcance.length > 0 && solicitanteId !== null ? delAlcance[0].fila.solicitanteNombre : null;
    return {
      resumen,
      solicitantes,
      reparto: { alcance: { solicitanteId, nombre: nombreAlcance }, ...calculo.repartirPorCategoria(montos, nombreDeCategoria) }
    };
  }

  // PDF con los mismos datos del JSON; el nombre del archivo es ASCII seguro (las fechas ya están validadas).
  async generarPdf(query) {
    const datos = await this.generar(query);
    const buffer = await generarPdfReporte({ ...datos, generado: solicitudService.instante().hoy });
    return { buffer, nombreArchivo: `${REPORTES.PDF_NOMBRE_ARCHIVO}-${datos.desde}_${datos.hasta}.pdf` };
  }
}

module.exports = new ReporteService();
