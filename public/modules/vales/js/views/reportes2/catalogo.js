// Catálogo de Reportes 2: cada reporte nuevo se agrega aquí y la pestaña lo ofrece sola en el combo.
// { id, etiqueta, render(contenedor, periodo), pdf?(periodo) }
//  - render pinta el reporte dentro de `contenedor` (puede ser async; si falla, la pestaña muestra el error).
//  - pdf devuelve { blob, nombre }; sin pdf, el botón «Descargar PDF» queda deshabilitado.
//  - periodo es { tipo, fecha, desde, hasta }; aplicarPeriodoAQuery (barraPeriodoReportes.js) lo convierte en query.
export const CATALOGO = [];
