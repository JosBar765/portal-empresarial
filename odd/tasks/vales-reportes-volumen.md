# Vales: reports with long periods (volume): on-demand drawing and PDF warning

Branch: `feat/vales-reportes-2` (uncommitted, mixed with earlier work). Owner request (2026-11-20): production gets ~160 vales/month and the platform started on 2026-10-09, so a 6-12 month period nears/exceeds the old list cap (`MAX_VALES = 1000`). Design: same UI (mockup waived: behavior changes only).

## Decisions (owner approved)
- Raise the screen/PDF list cap to 5000 as a safety valve (counters and per-group totals were already exact, computed before the cap). `MAX_VIGENTES` (200) stays.
- Draw on demand in the desglose: sections folded do not create rows until opened; inside each group show the first 50 vales with a "Ver N más" button that reveals the next 50 (owner changed 25 -> 50).
- PDF is allowed with the full desglose (measured with fake data: 1000 rows = 143 ms / 36 pages, 5000 rows = 535 ms / 169 pages / 511 KB; the cost is in the DB scan, not in the PDF). A WARNING (not a block) appears in the "include the desglose?" modal when the desglose has more than 100 rows. Reports without the modal (talleres, diseñadores) have no choice and no warning.
- Not done now: filter by date in SQL (every query still loads all vales); noted as a later optimization to measure first.

- Owner change (2026-11-20, after the first delivery): instead of cutting the lists at the cap, when the period has MORE than `MAX_VALES` (5000) vales the desglose is OMITTED entirely (server flag `desgloseOmitido`), with a prominent notice (not an error screen) in its place: counters and bar chart stay. Same note in the PDF. Per-asesor/tienda PDF desglose of a focused bar still prints (that re-query has few vales).

## Tasks
- [x] T1 Backend: `MAX_VALES` 1000 -> 5000 in `valeReporteGruposService.js`.
- [x] T2 Frontend: on-demand drawing in `views/reportes2/desglose.js` (folded sections lazy, 50 rows per group + "Ver N más").
- [x] T3 Frontend: PDF warning in the desglose modal when rows > 100 (count of the vales really in the view, incl. focus).
- [x] T4 Docs: guide §9, `reporte_actividad_*.md` (cap and limitation), `reportes_errores.md` not needed, `correcciones_70.md`.

T2/T3 verified: syntax check + pure tests (desglosePaginado.js, contarFilasDesglose) in scratchpad; nothing ran in a browser. Pagination is per section table (one flat table per section, group is a column), not per group block.
- [x] T5 Backend: `armar` omits the desglose (`desgloseOmitido`, lists empty, totals kept) when `totalVales > MAX_VALES`; PDF prints a note instead of the sections. Verified: node --check + PDF scratchpad test (omitted = 1 page, normal still prints). PENDING: valeReporteTiendaService/valeReporteEquiposService rebuild `grupos` and drop `desgloseOmitido`.
- [x] T6 Frontend: notice in place of the desglose when `desgloseOmitido`; no "Ver más"/PDF-row warning logic breaks; texts. Verified: syntax check + enfocarPayload test; nothing ran in a browser.
- [x] T7 Docs: `correcciones_70.md`, guide, `reporte_actividad_*.md` (replace the "truncated payload" limitation).
