import { TEXTOS_TIENDA, TEXTOS_TALLER, TEXTOS_DISENADOR, TEXTOS_ASESOR } from './textos.js';
import { reporteTienda } from './actividadTienda.js';
import { reporteTaller, reporteDisenador, reporteAsesor } from './actividadEquipos.js';

// Catálogo de Reportes: cada reporte nuevo se agrega aquí y la pestaña lo ofrece sola en el combo.
// { id, orden, etiqueta, permiso, ruta, montarFiltros(destino, opciones, alCambiar), consulta(periodo), generar(periodo), render(contenedor, periodo, datos, ctx), esqueleto?(), pdf?(periodo) }
//  - orden: número fijo del reporte; el combo los lista en ese orden y lo muestra («1. Reporte de…»). Es del reporte, no de su posición: si alguien no ve el 1, ve 2, 3 y 4.
//    Un reporte nuevo toma el siguiente número libre (no reutilizar uno existente).
//  - permiso: el combo solo lista el reporte a quien lo tiene (el servidor lo exige igual).
//  - ruta: la del reporte en /api/vales/reportes; con `/opciones` se piden las opciones de sus filtros antes de generar.
//  - montarFiltros dibuja los selectores propios del reporte en la fila de filtros de la pestaña; `alCambiar()` avisa que cambió alguno (no consulta nada).
//  - consulta devuelve la query que se enviaría con el estado de ahora: sirve para saber si lo generado quedó viejo.
//  - generar consulta el reporte y devuelve sus datos (rechaza con ErrorReporte); render los pinta de forma síncrona dentro de `contenedor`.
//    ctx: { alCambiar, repintar, remontarFiltros(), verMes(ventana), irAReporte(id), puedeIrA(id) }; `irAReporte` abre otro reporte y lo genera (conserva el período).
//  - esqueleto devuelve el HTML de carga que se muestra mientras llega el reporte.
//  - pdf devuelve { blob, nombre }; sin pdf, el botón «Descargar PDF» queda deshabilitado.
//  - periodo es { tipo, fecha, desde, hasta }; aplicarPeriodoAQuery (barraPeriodoReportes.js) lo convierte en query.
export const CATALOGO = [
  { id: 'actividad-tienda', orden: 1, etiqueta: TEXTOS_TIENDA.etiqueta, permiso: 'vales.reporte_actividad_tienda', ...reporteTienda },
  { id: 'actividad-taller', orden: 3, etiqueta: TEXTOS_TALLER.etiqueta, permiso: 'vales.reporte_actividad_taller', ...reporteTaller },
  { id: 'actividad-disenador', orden: 4, etiqueta: TEXTOS_DISENADOR.etiqueta, permiso: 'vales.reporte_actividad_disenador', ...reporteDisenador },
  { id: 'actividad-asesor', orden: 2, etiqueta: TEXTOS_ASESOR.etiqueta, permiso: 'vales.reporte_actividad_asesor', ...reporteAsesor }
].sort((a, b) => a.orden - b.orden);

// Texto del combo: el número del reporte y su nombre.
export const etiquetaNumerada = (r) => `${r.orden}. ${r.etiqueta}`;
