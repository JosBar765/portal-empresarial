# Correcciones 43 — Reportes: tres indicadores de ventas, sin gráfica y evaluación de una o varias personas

Rama: `feature/reportes-vales` (continúa las correcciones 42, aún sin commit).

## Qué cambió

- **Supervisor y Asesor:** el reporte solo tiene **Vales creados, Autorizados y Modificaciones solicitadas** (tarjetas, tabla «Por asesor», listado de vales y PDF). Se quitan rechazados, confirmados, tiempos, ciclo, abiertos/atrasados, «por mí» y cupo. Encargado, Diseñador y Administrador conservan sus indicadores.
- **Se quita la gráfica «Actividad»** en todos los roles (el campo `serie` ya no se devuelve).
- **Listado de ventas:** columnas Creado, Autorizado y Modif. solicitada; solo entran los vales con alguna de esas acciones en el período.
- **Evaluar a una o varias personas** (Supervisor: asesores; Encargado: diseñadores y él mismo):
  - Selector con búsqueda, «Seleccionar todos», «Quitar selección», cuenta de elegidos y Aplicar/Cancelar; se cierra con Esc o clic fuera.
  - Fichas «Evaluando a:» con × para quitar a cada persona y «Limpiar». Pulsar una fila de la tabla evalúa solo a esa persona.
  - Con selección, tarjetas, tabla, listado y PDF muestran solo a los elegidos; con una sola persona la tabla se omite porque las tarjetas ya son suyas.
  - El filtro viaja como `personaIds` (ids separados por coma, máximo 50); el servidor rechaza a cualquier persona fuera del equipo («Esa persona no está a tu cargo.»).
- **PDF:** mismo formato; añade «Evaluado: …» / «Evaluados (N): …» bajo el título y el archivo se llama `reporte-vales-<fecha>-<nombre>.pdf` (o `-N-personas`).

## Archivos

`services/valeReporteService.js`, `services/valeReportePdfService.js`, `controllers/valeController.js`; `js/views/reportes.js`, `js/state.js`, `css/reportes.css`.

## Verificación

Con los 50 vales de prueba (septiembre y octubre): el Supervisor ve 26 creados, 25 autorizados y 2 modificaciones en septiembre, y la tabla suma 26; con 1 asesor, 3 asesores y una persona ajena (400) los resultados cuadran; el PDF con evaluados se revisó en pantalla; el Encargado conserva sus indicadores y filtra por varios diseñadores. En el navegador se probaron el selector, las fichas, Esc y el atajo de fila. No se revisó la vista móvil.

## Ajuste posterior: Encargado y Diseñador simplificados

- **Encargado:** tarjetas Asignaciones hechas, Propuestas recibidas, Aprobados y Atrasados ahora. La tabla «Por diseñador» queda con Comenzados, Entregados, Aprobados y Atrasados (también para el Administrador).
- **Diseñador:** tarjetas Vales comenzados, Propuestas entregadas, Aprobados por el encargado y Atrasados ahora.
- Se quitan devueltos, tiempos de producción y revisión, entregas a tiempo, fusiones, cola y por revisar; el listado de vales no cambia.
