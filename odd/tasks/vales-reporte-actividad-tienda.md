# vales-reporte-actividad-tienda

## Objective
First report of the "Reportes 2" tab: "Reporte de actividad de tienda", permission `vales.reporte_actividad_tienda`.
Same essence as the Reportes > Actividad report, focused exclusively on tiendas. Figma mockup validated by the owner (file N85CeWuBlGxZ7xCwK64Czg: desktop, mobile, empty/loading/error states, PDF 2 pages).

## Rules (owner decisions)
- Only AUTHORIZED vales count (never those waiting for authorization); same definition of "autorizado" as the existing Actividad report.
- Counted by delivery date inside the time window, EXCEPT block "Atrasados antes del período" (open, overdue, delivery before the window; also authorized only).
- Sections and their conditions are the same as Actividad: Atrasados antes del período, Atrasados en el período, No entregados, Entregados (Entregados = vale already reached the asesor).
- Grouped by tienda always (no "Agrupar por" control). Filter: tienda selector.
- Scope: whoever has permission `vales.supervisar` sees only the tiendas under their supervision; any other user with the report permission sees all tiendas.
- PDF: same layout as the Actividad PDF (Carta vertical, pdf-lib), title REPORTE DE ACTIVIDAD DE TIENDA, one group bar per tienda, no cliente column.
- Per-report permission: the Reportes 2 combobox lists only reports the user may see; backend enforces `requirePermission`.

## Tasks
- [x] T0 (written as `49_reporte_actividad_tienda.sql`, granted only to Administrador like 43_viaticos_reportes; not applied: owner runs `npm run migrate`) Permission `vales.reporte_actividad_tienda`: ONLY an idempotent migration in `database/migrations/` (never seed.sql/schema.sql: they are the initial state, migrations are the source of truth). Written by the parent, not by the code writer.
- [x] T1 Backend data: route, controller, service (+ repository if needed). Reuse existing report services where possible. Document the permission in the module README / permisos_por_permiso.md.
- [x] T2 Backend PDF: pdf service + route, file name `reporte-actividad-tienda-<fecha>.pdf`.
- [x] T3 (node --check ok; sin test runner; prueba en navegador pendiente del dueño) Frontend: catalog entry (with permission), render (header meta, tienda selector, vigentes card, sections with flat tables, pipeline), empty/loading/error states, mobile, PDF download.
- [x] T4 (correcciones_63.md creado) Docs: flujo_vale_de_arte.md, README.md, permisos_por_permiso.md, correcciones_63.md (check next free number).

## Route
T1+T2: one delegated writer (backend). T3+T4: second delegated writer after backend contract is known. Same branch as the shell: `feat/vales-reportes-2`.

## Verification
No test runner. node --check on touched JS, structural readback, contract check between backend and frontend. Do not run server or migrations: owner runs them locally.

## Progress
Shell committed as 6784a7f6.
