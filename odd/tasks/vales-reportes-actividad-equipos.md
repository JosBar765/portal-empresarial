# vales-reportes-actividad-equipos

## Objective
Three more reports in the "Reportes 2" tab, same idea as "Reporte de actividad de tienda" (see `vales-reporte-actividad-tienda.md`):
- Reporte de actividad de talleres (permission `vales.reporte_actividad_taller`)
- Reporte de actividad de diseñadores (permission `vales.reporte_actividad_disenador`)
- Reporte de actividad de asesores (permission `vales.reporte_actividad_asesor`)
No Figma mockup (owner decision): same layout and behavior as the tienda report.

## Rules (owner decisions + same as the tienda report)
- Only AUTHORIZED vales count (`vales.autorizado_en` not null); delivery date inside the window; only exception: block "Atrasados antes del período" (open, overdue, delivery before the window, authorized).
- Sections: Atrasados antes del período, Atrasados en el período, No entregados, Entregados. Same PDF layout (Carta vertical, pdf-lib), one group bar per group, no cliente column.
- "Entregado" for TALLERES and DISEÑADORES: the Encargado of the taller already approved the proposal (in review does NOT count yet), as in Actividad for Encargado/Diseñador views (correcciones_53). For ASESORES: the vale already reached the asesor (as the tienda report).
- Grouping: talleres by taller, diseñadores by diseñador, asesores by asesor. Filters like Actividad: talleres use the global cascade Taller filter; diseñadores and asesores use the multi-select of people (same components as Reportes).
- Scope by PERMISSION, not role: `vales.gestionar_taller` sees only its talleres and the diseñadores of those talleres; `vales.supervisar` sees only its asesores (and itself) and its zone; anyone else with the report permission sees everything. Reuse the scope rules that the Actividad report already applies to the Encargado/Asistente and Supervisor roles, expressed by permission.
- Per-report permission: combobox lists only allowed reports; backend `requirePermission`. Tab keeps `vales.ver_reportes`.
- Permissions only through a migration (never seed.sql/schema.sql); granted only to Administrador; the owner assigns the rest.

## Tasks
- [ ] T0 Migration `50_reportes_actividad_equipos.sql` (3 permissions, Administrador only). Written by the parent.
- [x] T1 Backend (service `valeReporteEquiposService.js`; `armar` gains `entregadoPorTaller` and `permitirVale`; verified by node --check, no test runner): 3 data endpoints + 3 PDFs, reusing the tienda report service/PDF machinery and the Actividad machinery (`armar`, `soloAutorizados`, `soloAtrasadosAntesDe`).
- [ ] T2 Frontend: 3 catalog entries reusing `reportes2/actividadTienda.js` structure (extract shared render into a common module instead of copying).
- [ ] T3 Docs: flujo_vale_de_arte.md §11.1, README, permisos_por_permiso.md, correcciones_64.md (check next free number).

## Route
T1 and T2 delegated to separate writers (backend first). Same branch: `feat/vales-reportes-2`.

## Verification
No test runner. node --check on touched JS, structural readback, contract check between backend and frontend. No server, no DB commands: the owner runs them locally.

## Progress
Tienda report committed (be625ece). Starting T0/T1.
