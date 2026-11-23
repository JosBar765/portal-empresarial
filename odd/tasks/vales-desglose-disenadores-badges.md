# Vales: designers desglose with badges, one row per shared vale, expandable per-designer state

Branch: `feat/vales-reportes-2` (another session works in the same folder: targeted edits only, no commits unless the owner asks). Owner request (2026-11-23): in the designers report desglose use the same logic as talleres: no avatar circle, no role text («Encargado»/«Asistente»), designer names as badges, a shared vale shows ONE row with one badge per designer, expandable to the individual state of each designer.

## Decisions (owner)
- A shared vale falls in the section of the WHOLE vale, like in talleres: if one designer finished and the other did not, it is an overdue vale (or «por vencer» if not yet due). Desglose numbers match the top counters.
- The per-designer state (own part) lives in the expansion and in the chart/E/T (owner's earlier option 1 stays).
- With a designer focused (chart bar) the rows follow that designer's part (same numbers as the bar) and still show all the vale's designers.

## Tasks
- [x] T1 Server: `armar` for disenador: per-vale detail (`disenadoresDelVale`, `partes`), plain names, unified vale-level sections grouped by designer set, per-part copy for focus (`seccionesPorParte`, `gruposPorParte`).
- [x] T2 Wiring: equipos service (`grupos.porParte`), `soloGrupoDesglose`, `enfocarPayload`.
- [x] T3 Frontend: badges from the row (no avatar), expandable per-designer detail (also card mode), texts.
- [x] T4 PDF: per-designer lines under shared vales.
- [x] T5 Tests, docs, Engram.

Verified: 9 scripts in scripts/reportes pass (new probarDesgloseDisenadores.mjs, PDF block (i)); browser check of the real table with sample data. NOT exercised: armar against the DB and the full PDF.

## Update 2026-11-23 (later)

Owner reinforced the rule («justos pagan por pecadores»): the vale-level state applies to the designers chart too, so the per-designer state and the expandable detail were removed (see correcciones_83.md). Also: «Por vencer» in all four reports, PDF prints every bar, and a read-only DB verification script (736 checks passed).
