# Correcciones 55 — Rendimiento para Administrador y Gerente

Rama: `feat/rendimiento-admin-gerente` (desde `dev`). Plan: `odd/tasks/rendimiento-admin-gerente.md`.

## Qué cambia

- **Pestaña Rendimiento de Reportes para el Administrador y el Gerente** (alcance `administrador`, solo lectura para el Gerente). Contiene los dos reportes de rendimiento de los roles, tal cual los ven ellos, con un selector «Ventas | Taller» (se recuerda el último elegido):
  - **Ventas:** el del Supervisor (gráfica y tabla Creados vs Autorizados, con recibidos y sin recibir), sobre todos los asesores activos.
  - **Taller:** el del Encargado (contadores de efectividad, entregas a tiempo, atrasados sin entregar, entrantes, entregados y sin entregar; gráfica y tabla Asignados vs Entregados con la fila «Sin asignar»), sobre todos los diseñadores y asistentes de taller.
- **Personas:** cada reporte lista a todas las personas activas aunque no tengan vales (con ceros), como el Supervisor ve a todo su equipo. Quien tiene vales en el período sin figurar en la lista (p. ej. un asesor ya inactivo) también aparece.
- **Filtros:** Ventas filtra por tienda, taller y asesores; Taller, por taller y diseñadores (los de cada reporte, como en el rol correspondiente). La pantalla muestra solo los de la vista activa.
- **Períodos:** igual que el Supervisor y el Encargado, Semana y Mes solo se consultan cuando ya cerraron y sus cifras son las del cierre. Día, Hoy y Desde–Hasta muestran las cifras de hoy.
- **Contadores del taller:** usan la misma definición que el Encargado (vale terminado = parte aprobada por el Encargado al corte) sobre los vales que ya llegaron a algún taller (o al taller elegido), con el mismo ajuste de «Atrasados sin entregar» por los vales vencidos antes del período.
- **PDF:** imprime el reporte a la vista. Parámetro `enfoque=ventas|taller` en `GET /api/vales/reportes/pdf` (por defecto `ventas`; otro valor se rechaza). Con Taller incluye los contadores. El título lleva el enfoque.
- Sin métricas nuevas, sin cambios de permisos ni de base de datos.

## Forma de `grupos.rendimiento`

- Encargado/Asistente y Supervisor: sin cambios (un solo bloque con `clave`, `persona`, `series`, `filas`, `sinAsignar`, `totales`).
- Administrador y Gerente: `{ clave: 'global', vistas: { ventas, taller } }`; cada vista tiene la forma del bloque del Supervisor y del Encargado, respectivamente, con sus `totales`. `grupos.indicadoresTaller` se calcula para ellos con la definición de Taller.

## Archivos

`valeReporteGruposService.js` (vistas globales y filtros por vista), `valeReporteService.js` (período cerrado también para el Administrador, ajuste de atrasados), `reporteRepository.js` (`listarAsesores` acepta la tienda), `valeService.js` y `valeController.js` (`enfoque`), `valeReportePdfService.js`, cliente: `views/reportes.js`. Sin migración nueva.
