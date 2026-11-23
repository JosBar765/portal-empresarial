# Vales: counters in the tienda activity report PDF and new counters on screen

Branch: `feat/vales-reportes-2`. Owner approved the PDF mockup (Figma `24:2`); screen mockups approved too (Figma `26:2` desktop, `26:43` mobile).

## Scope
- Counter strip in the PDF of the tienda activity report, two rows (~9 % of the page): Ingresados, Urgentes, Sin entregar / Atrasados (Anteriores, Actuales), Entregados (Con atraso, Sin atraso).
- Same counters on screen, same order. Rename counter "Recibidos" to "Entregados" and section "No entregados" to "Sin entregar" in Reportes 2 only (Reportes and Actividad keep their names).
- Atrasados anteriores have a delivery date before the period, so they are not part of Ingresados; Entregados + Atrasados actuales + Sin entregar = Ingresados.

## Tasks
- [x] T1 Backend: `contadores.atrasados {total, anteriores, actuales}` and `contadores.sinEntregar` in `valeReporteTiendaService.js`. Route: inline (one small file).
- [x] T2 PDF: `_contadoresActividad` + section title "SIN ENTREGAR" for `actividad-*` in `valeReportePdfService.js`. Verified with a standalone script and a rasterized page (matches the mockup). Route: inline.
- [x] T3 Screen: counters in the new layout + renames in `views/reportes2/` and `reportes2.css` (6-column grid; container query on the grouped cards). Syntax-checked only; owner tests in the browser. Route: inline.
- [x] T4 Docs: guide, flujo §11.1, `correcciones_66.md` (the PDF now carries counters).
- [x] T5 Bar chart "Vales ingresados por tienda" (screen + PDF) when the filter spans more than one store; backend `contadores.porTienda`. Owner chose ranked bars over a pie (27 stores in the seed) and waived the mockup. Verified with a fake 27-store PDF and the chart HTML; owner tests in the browser.
- [x] T6 Clickable bars: pressing a bar focuses only the counters and the desglose on that store (extra request with its id); the selector, the chart and the PDF stay as they are; pressing it again removes the focus (`state.reporte2.tiendaElegida`). First version changed the selector itself; reworked after the owner clarified. Syntax-checked and HTML-tested with fake data; owner tests in the browser.
- [x] T7 PDF download modal for the tienda report: "include the Vales de Arte desglose?" (Yes = full report, No = header + counters + chart only; closing the modal cancels). `desglose=0` query param. Verified with fake-data PDFs (with and without desglose); owner tests the modal in the browser.
- [x] T8 With a bar focused in the chart, "Yes" in the PDF modal prints the desglose of that store (`tiendaDesglose`); counters and chart keep the filter; the modal names the store. Syntax-checked; PDF title tested with fake data; the focused-store server path needs the owner's data.
