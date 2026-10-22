# Correcciones 55 — Rendimiento para Administrador y Gerente

Rama: `feat/rendimiento-admin-gerente` (desde `dev`). Plan: `odd/tasks/rendimiento-admin-gerente.md`.

## Qué cambia

- **Pestaña Rendimiento de Reportes para el Administrador y el Gerente** (alcance `administrador`, solo lectura para el Gerente). Una sola pestaña con dos bloques globales, cada uno con su gráfica y su tabla comparativa:
  - «Vales por asesor»: Creados vs Autorizados, la misma lógica del Supervisor sobre todos los asesores.
  - «Asignaciones por diseñador»: Asignados vs Entregados, la misma lógica del Encargado sobre todos los diseñadores, con la fila «Sin asignar».
- **Filtros:** tienda, taller, asesores y diseñadores se aplican igual que en Actividad. Sin filtro de personas aparecen quienes tienen vales en el período; con filtro, las personas elegidas (con ceros si no tienen).
- **Períodos:** Semana y Mes en curso siguen permitidos para ellos (sin restricción a períodos cerrados); los demás roles no cambian.
- **PDF:** el reporte de rendimiento dibuja la gráfica y la tabla de cada bloque.
- Sin métricas nuevas, sin cambios de permisos ni de base de datos.

## Forma de `grupos.rendimiento`

- Encargado/Asistente y Supervisor: sin cambios (un solo bloque con `clave`, `persona`, `series`, `filas`, `sinAsignar`, `totales`).
- Administrador y Gerente: `{ clave: 'global', bloques: [asesores, disenadores] }`; cada bloque tiene la forma de arriba y trae sus `totales`.

## Archivos

`valeReporteGruposService.js` (bloques por rol), `valeService.js` (comentario), `valeReportePdfService.js`, cliente: `views/reportes.js`. Sin migración nueva.
