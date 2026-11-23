# Vales: asesores report - amber urgent segment, focusable bars, PDF desglose of the focused asesor, selector panel fix

Branch: `feat/vales-reportes-2` (uncommitted work from earlier cycles lives in the same files, so no work-unit commits yet). Owner request (2026-11-20). Design: same as the tienda report (mockup waived: the owner asked for tweaks of existing UI).

## Decisions
- Urgent color red -> amber/yellow (`--color-warning` on screen, `AMBAR` in the PDF); the number inside the segment uses dark text for contrast.
- A single urgent vale always shows its number: the urgent segment gets a minimum width that fits one digit (screen and PDF). Bar length stays proportional except for that minimum.
- Amendment: the asesor name and the blue part of the bar focus ALL the asesor's vales; the amber part focuses ONLY the urgent ones (`soloUrgentes=1` filters `armar`); pressing the same target undoes it, the other target switches mode.
- Pressing an asesor bar focuses counters + desglose on that asesor (same as tienda): extra query `asesorIds=<id>` on top of the current filter; state `asesorElegida` / `asesorElegidaNombre`. Selector change clears it.
- The PDF already asks "include the desglose?" for asesores; with a focused bar "Yes" prints that asesor's desglose (`asesorDesglose=<id>`, title "DESGLOSE DE VALES DE ARTE: <ASESOR>").
- Selector panel (`.rep-selector-panel`) overflowed the window because it opens to the right (`left:0`) from a button at the right edge of the header: right-align it on wide screens inside Reportes 2 filters.

## Tasks
- [x] T1 Amber urgent segment + legend + single-urgent number (screen CSS/JS and PDF).
- [x] T2 Focusable asesor bars: name and blue part focus all the asesor's vales, amber part only the urgent ones (`asesorElegidaUrgentes`, `soloUrgentes=1`); query keeps the filter; selector change clears the focus.
- [x] T3 PDF desglose of the focused asesor (`asesorDesglose` + `soloUrgentes`; title "<NOMBRE> (solo urgentes)" in that mode; modal wording per mode).
- [x] T4 Selector panel no longer overflows the window.
- [x] T5 Docs: `reporte_actividad_asesores.md`, `reportes_2_guia.md` §9, `correcciones_68.md`.
