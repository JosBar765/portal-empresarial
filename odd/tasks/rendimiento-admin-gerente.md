# Rendimiento para Administrador y Gerente

Rama: `feat/rendimiento-admin-gerente` (desde `dev` c4be89a).

## Objetivo
La pestaña «Rendimiento» del módulo Reportes de Vales debe aparecer también para el Administrador y el Gerente (hoy solo Supervisor y Encargado/Asistente). «Actividad» ya les aparece.

## Decisión (usuario)
Opción 1: una sola pestaña con dos tablas globales: «Vales por asesor» (creados vs autorizados) y «Asignaciones por diseñador» (asignados vs entregados). Reusa la lógica existente; respeta filtros de tienda y taller; sin métricas nuevas.

## Evidencia
- `valeReporteGruposService.js:236,294`: `_rendimiento` devuelve `null` salvo taller y supervisor.
- `valeService.js:35`: rechaza `tipo=rendimiento` si no hay `grupos.rendimiento`.
- `reportes.js:34`: `tieneRendimiento` solo Supervisor y Encargado de taller.
- `valeReportePdfService.js:96-99`: PDF de rendimiento asume un solo bloque.

## Restricciones
- Solo lectura para Gerente (alcance `administrador` con `soloLectura`).
- Sin cambios de permisos ni de base de datos.
- Conservar ids DOM, clases y `data-*`; archivos CRLF.
- Rendimiento global: Semana/Mes en curso permitido (como hoy para el Administrador).

## Tareas
- [x] T1 · Backend: rendimiento global (dos bloques) en `valeReporteGruposService` y validación en `valeService`.
- [x] T2 · Frontend: pestaña, gráfica y tabla para dos bloques; menú de descarga.
- [x] T3 · PDF de rendimiento con dos bloques.
- [x] T4 · Documentación: `flujo_vale_de_arte.md`, changelog en `correcciones/`.

## Rutas
Delegated direct: un writer (4 archivos o más no triviales, lectura previa para escribir).

## Verificación
Sin tests ni linter en el proyecto. Comprobación: `node --check` de lo editado, llamada al servicio con usuario Administrador y Gerente en el servidor ya corriendo (cuenta `claude@grupopremia.com`), y PDF 200.

## Progreso
T1-T4 hechas por el writer (sin commit). `grupos.rendimiento` para Administrador/Gerente: `{ clave: 'global', bloques: [asesores, disenadores] }`; Supervisor/Encargado sin cambios. Verificado: servicio con Administrador y Gerente (con y sin tiendaId) devuelve los dos bloques; PDF generado (13 KB). Pendiente: render en navegador (no probado).
