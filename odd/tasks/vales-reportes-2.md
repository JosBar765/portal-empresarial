# vales-reportes-2

## Objective
New sidebar tab "Reportes 2" in Vales de Arte: a shell that hosts many report types.
Global controls: report combobox, time window selector, "Actualizar" and "Descargar PDF" buttons.
The window and Actualizar apply to whichever report is selected; the PDF is the one of the selected report.

## Scope (this feature only)
- Shell only: no concrete report yet. A report catalog (id, label, render, pdf) that new reports plug into.
- Reuse permission `vales.ver_reportes` (no migration).
- No Figma mockup needed (owner decision).

## Tasks
- [x] T1 Frontend shell: sidebar item `reportes2`, section `#reportes2-vista`, `views/reportes2.js`, catalog, dispatch in `buzon.js`, `sidebar.js`, `socket.js` exclusion, CSS.
- [x] T2 Docs: `flujo_vale_de_arte.md` new section, `README.md`, `documentacion/correcciones_62.md`.

## Route
T1: delegated writer (2+ non-trivial files). T2: same writer.

## Acceptance
- Tab shows only with `vales.ver_reportes`; selecting it hides the buzón table like Reportes.
- Combobox lists the catalog; the time bar and Actualizar re-run the selected report; PDF button enabled only if the selected report defines a pdf.
- Existing Reportes tab unchanged.

## Verification
No test runner in the project: manual check in the running local server (user starts it).

## Progress
Branch `feat/vales-reportes-2` created from updated `dev`.
T1/T2 written (delegated writer); verified by structural readback only (no runner, no server started). Exception: no RED/GREEN, no runnable test. Manual browser check pending (user). Not committed yet. Changelog is correcciones_62.md (60 and 61 already existed).
