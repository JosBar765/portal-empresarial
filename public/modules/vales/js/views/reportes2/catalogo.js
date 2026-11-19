import { TEXTOS_TIENDA, TEXTOS_TALLER, TEXTOS_DISENADOR, TEXTOS_ASESOR } from './textos.js';
import { renderActividadTienda, esqueletoActividadTienda, pdfActividadTienda } from './actividadTienda.js';
import { reporteTaller, reporteDisenador, reporteAsesor } from './actividadEquipos.js';

// Catálogo de Reportes 2: cada reporte nuevo se agrega aquí y la pestaña lo ofrece sola en el combo.
// { id, etiqueta, permiso, render(contenedor, periodo, { recargar, cambiarVentana }), esqueleto?(), pdf?(periodo) }
//  - permiso: el combo solo lista el reporte a quien lo tiene (el servidor lo exige igual).
//  - render pinta el reporte dentro de `contenedor` (puede ser async; si falla, la pestaña muestra el error).
//    `recargar()` vuelve a pedirlo; `cambiarVentana(ventana)` cambia el período de la pestaña.
//  - esqueleto devuelve el HTML de carga que se muestra mientras llega el reporte.
//  - pdf devuelve { blob, nombre }; sin pdf, el botón «Descargar PDF» queda deshabilitado.
//  - periodo es { tipo, fecha, desde, hasta }; aplicarPeriodoAQuery (barraPeriodoReportes.js) lo convierte en query.
export const CATALOGO = [
  {
    id: 'actividad-tienda',
    etiqueta: TEXTOS_TIENDA.etiqueta,
    permiso: 'vales.reporte_actividad_tienda',
    render: renderActividadTienda,
    esqueleto: esqueletoActividadTienda,
    pdf: pdfActividadTienda
  },
  { id: 'actividad-taller', etiqueta: TEXTOS_TALLER.etiqueta, permiso: 'vales.reporte_actividad_taller', ...reporteTaller },
  { id: 'actividad-disenador', etiqueta: TEXTOS_DISENADOR.etiqueta, permiso: 'vales.reporte_actividad_disenador', ...reporteDisenador },
  { id: 'actividad-asesor', etiqueta: TEXTOS_ASESOR.etiqueta, permiso: 'vales.reporte_actividad_asesor', ...reporteAsesor }
];
