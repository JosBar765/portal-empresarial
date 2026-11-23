# Correcciones 65 — Contadores en el reporte de actividad de tienda (Reportes 2)

Rama: `feat/vales-reportes-2`. Maqueta aprobada por el dueño en Figma («Contadores - reporte de actividad de tienda», escritorio y móvil).

## Problema

El reporte de actividad de tienda solo mostraba listas; no daba un resumen rápido de cuántos vales ingresaron, cuántos fueron urgentes y cuántos ya llegaron al asesor, ni si llegaron con atraso.

## Qué cambia

- **Tres tarjetas** arriba del reporte (después del encabezado y antes de «Atrasados antes del período»), en este orden: **Ingresados**, **Fueron urgentes** y **Recibidos**. Solo en el reporte de tienda; los de talleres, diseñadores y asesores no cambian.
- **Ingresados:** vales autorizados con entrega en el período.
- **Fueron urgentes:** porcentaje de los ingresados marcados como urgentes, con el detalle «N de M vales»; 0 % si no hay vales.
- **Recibidos:** de los ingresados, los que ya llegaron al asesor, separados por el día de llegada frente a la fecha de entrega: «Con atraso» (llegó después), «Sin atraso» (el mismo día) y «Adelantados» (antes). El total es la suma. Cada categoría lleva punto y rótulo, no solo color.
- Los contadores respetan el filtro de tienda y el alcance por permiso, y cuentan todos los vales aunque las listas se recorten a 1000. El PDF no los incluye.
- **Ayuda:** no se muestra bajo las tarjetas; está en «Cómo funciona este reporte» (Ingresados, Recibidos y Fueron urgentes).
- **Diseño:** las tres tarjetas tienen la misma altura en escritorio (columnas 1fr, 1fr y 2fr). En móvil, Ingresados y Fueron urgentes van lado a lado y Recibidos ocupa todo el ancho con sus tres categorías en tres columnas.
- Sin migración.

## Archivos

- Backend: `valeReporteGruposService.js` (`contadores` opcional en `armar`, `_contadores`, `llegadaAlAsesor`) y `valeReporteTiendaService.js` (activa la bandera y devuelve `contadores`).
- `js/views/reportes2/contadoresActividad.js` (nuevo): `htmlContadores`; `actividadReporte.js`: opción `contadores` que lo pinta; `actividadTienda.js`: la activa; `textos.js`: textos y notas de ayuda.
- `css/reportes2.css`: estilos acotados a `.rep2-contadores`.
