# Vales: reporte de actividad de asesores with the tienda selector, counters and chart

Branch: `feat/vales-reportes-2`. Owner request (2026-11-19): the asesores report gets the same counters, a "Vales ingresados por asesor" bar chart and the desglose grouped by asesor, driven by a tienda selector; the tienda report is renamed "de tiendas"; pressing a store NAME in the tienda chart suggests (modal) going to the asesores report of that store. Design: same as the tienda report (mockup waived by the owner).

## Decisions (mine, to be confirmed by the owner)
- The tienda selector is ADDED to the existing asesores multi-select (nothing removed). Own state: `state.reporte2.asesorTiendaId`.
- Asesor bars are not interactive (no focus). The PDF modal "include the desglose?" also applies to this report.
- Bar press = focus counters/desglose (as before); name press = modal to the asesores report.

## Tasks
- [x] T1 Rename "Reporte de actividad de tienda" -> "de tiendas" (label, PDF title, service titles, current docs).
- [x] T2 Backend: `porAsesor` counter, shared `completarContadores`, tienda filter + `contadores` + `incluirDesglose` in `valeReporteEquiposService` (asesor), controller params.
- [x] T3 PDF: generic bar chart (`_graficaBarras`) for tiendas and asesores.
- [x] T4 Frontend: generic bar chart component, composite filter (tienda + asesores), asesor report config, texts.
- [x] T5 Name press in the tienda chart: modal + navigation to the asesores report (`irAReporte`).
- [x] T6 Docs: `reporte_actividad_asesores.md`, `correcciones_67.md`, guide, flujo §11.1, README.
- [x] T7 Stacked bars in the asesores chart (non-urgent blue + urgent red, legend, urgent count inside the red segment when it fits); `porAsesor` carries `urgentes`; PDF stacked too. Palette validated. Syntax-checked; HTML and PDF tested with fake data.
