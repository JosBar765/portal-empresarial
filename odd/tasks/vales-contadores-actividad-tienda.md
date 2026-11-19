# vales-contadores-actividad-tienda

## Objective
Counters at the top of "Reporte de actividad de tienda" (Reportes 2). Mockup approved by the owner in Figma (file N85CeWuBlGxZ7xCwK64Czg, frames "Contadores - reporte de actividad de tienda" desktop 20:2 and mobile 20:48).

## Rules (owner decisions)
- Order: Ingresados, Fueron urgentes, Recibidos.
- **Ingresados**: total of AUTHORIZED vales with delivery date inside the window (the same set the report counts; shown as "Ingresados" although the vales are the authorized ones). Respects the tienda filter and the scope by permission. Must count ALL of them, not only the rows kept after the 1000-vale truncation.
- **Fueron urgentes**: percentage of those Ingresados that were urgent (`vales.urgente`), detail "N de M vales"; 0% when there are none.
- **Recibidos**: of the Ingresados, those whose proposal already reached the asesor (same "Entregado" definition as the tienda report), split by the DAY it reached the asesor versus the vale's delivery date: **Con atraso** = arrived after the delivery date; **Sin atraso** = arrived on the delivery date; **Adelantados** = arrived before it. Total = sum of the three.
- Help texts do NOT show under the cards: they go in the collapsible note "Cómo funciona este reporte" (Ingresados, Recibidos with the three categories, Fueron urgentes).
- Desktop: three cards with the SAME height (Fueron urgentes sets it); Recibidos is wider: total on the left, the three categories in one row on the right. Mobile (<=640px): Ingresados and Fueron urgentes side by side, Recibidos below full width with "Recibidos 96" on one line and the three categories in a row under it.
- Colors from global.css tokens: Con atraso = danger, Sin atraso = success, Adelantados = info; each category with a dot (not color only).
- The PDF is NOT changed (not requested).

## Tasks
- [x] T1 Backend: `contadores` in the tienda report response (+ day-of-arrival derived from the vale history).
- [x] T2 Frontend: cards (desktop and mobile), data from `contadores`, note text in "Cómo funciona este reporte".
- [x] T3 Docs: flujo_vale_de_arte.md §11.1, correcciones_65.md (check next free number).

## Route
T1 and T2 delegated to separate writers (backend first). Same branch `feat/vales-reportes-2`.

## Verification
No test runner. node --check on touched JS, structural readback, contract check. No server, no DB commands; owner checks in the browser.

## Progress
Mockup approved. Starting T1.
T1 done: `contadores` added to the tienda report (opt-in flag `contadores` in `armar`, computed over all visible vales before truncation); node --check ok; no test runner.
T2+T3 done: `contadoresActividad.js` + opt-in `contadores: true` in the tienda config, CSS scoped to `.rep2-contadores`, notes added, docs (§11.1, correcciones_65); node --check ok; no test runner (exception), owner checks in browser.
