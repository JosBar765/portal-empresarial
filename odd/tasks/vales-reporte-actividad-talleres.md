# Vales: talleres activity report (counters, grouped bar chart, pressable bars/counters, PDF)

Branch: `feat/vales-reportes-2` (another session works in the same folder: targeted edits only, review `git diff` per hunk, never `git add -A`, no commits without the owner asking). Owner request (2026-11-23): rebuild the report `actividad-taller` (#3 in the combo) with the **same design as the designers report** and the **counting logic of the tiendas report focused on talleres**, keeping the tiendas-style interaction.

## Owner spec
1. Same layout as designers: counters (Ingresados · Por vencer · Efectividad · Entregas a tiempo, then Atrasados and Entregados), foldable grouped bar chart per taller (assigned / delivered on time / delivered late in red with its number), E and T columns with legend, all talleres always visible, name without suffixes.
2. NO «Sin asignar» row: only what entered the taller and what it worked.
3. A vale that goes through several talleres counts once in the top counters and once in each taller's bars. The bars can add up to more than the counters: the notice is an **info icon next to the chart title that shows it on hover (also on focus/tap, for keyboard and phone)**; in the **PDF it is printed directly** as a note under the chart title (no hover there).
4. Interaction like tiendas: pressing a bar or the name focuses counters and desglose; green part = only delivered on time; red part = only late; counters filter the desglose. Pressing the taller name **suggests going to the designers report with that taller already chosen** (like tienda -> asesores).
5. Keep: Generar flow, per-user saved filters, traceable errors, PDF asking whether to print with filters, multiple taller selector.

## Decisions
- OWNER (2026-11-23): a shared vale is delivered, or late, for ALL its talleres at once (vale-level state, NOT per part like designers); delivered only when every Encargado approved. The general desglose lists each vale once with all its talleres in the column (no per-taller duplicate rows, no avatar circle); focusing a taller uses `grupos.porTaller` (one group per taller). This replaced my earlier per-part design.
- MINE: a vale is assigned to a taller when it has a row for it in scope.
- MINE: vales with no taller row yet («Sin taller») are left out of this report entirely (counters, chart and desglose), per owner point 2.
- MINE: reuse the designers machinery (per-part cards, `porGrupo` variants todos/entregados/tarde, `soloGrupoDesglose`, grouped chart and PDF chart) generalized by group, not copied.
- MINE: PDF effectiveness detail stays short («N de M vales»).

## Tasks
- [x] T1 Backend counting: `porParte` for taller in `armar`, vales without a taller dropped, `porTaller` summary (reuses `resumenPorGrupo`), `porGrupo` variants, counters on unique vales. Verified: `node --check`, pure test `probarContadoresDisenador.mjs` OK. NOT exercised: the wiring inside `armar` (needs DB).
- [x] T2 Backend wiring: equipos service (contadores for taller), controller params (`tallerDesglose`, `tallerModo`, `desglose`, counter filters), PDF group focus, log whitelist. Verified: `node --check`. NOT exercised: HTTP/DB.
- [x] T3 Frontend: grouped chart generalized (key, info icon with hover/focus/tap help, name suggests the designers report), taller texts, state, config in `actividadEquipos.js`, `paramsPdf`. Verified in the browser with real pieces and sample data (hover, focus, 320 px, name vs bar); regression scripts OK. NOT exercised: the generated report end to end.
- [x] T4 PDF: counters + grouped chart for talleres with the note printed under the title, «Por vencer» section. Verified: `probarPdfDisenadores.mjs` block (h). NOT looked at rendered.
- [x] T5 Docs: `reporte_actividad_talleres.md`, guide row, `correcciones_81.md`; Engram.
