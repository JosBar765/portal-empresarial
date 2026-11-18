# Pestaña «Reportes» del módulo de viáticos

Rama: `module/viaticos`. Estado: análisis cerrado con el dueño (2026-11-17); T0 (mockup) en curso. Estrategia de entrega: la rama es la unidad de PR del dueño (sin cadena).

## Objetivo
Una pestaña **Reportes** que aparece solo con el permiso nuevo `viaticos.reportes` (además de `viaticos.ver`, que da acceso al módulo). Gerencia mide cuánta plata se invierte en cada solicitante y cómo se reparte (hospedaje, combustible, comida, etc.). Se consulta en pantalla y se puede imprimir en PDF.

## Decisiones del dueño
- Selector de ventana de tiempo FIJO arriba (siempre visible).
- «Invertido» = lo AUTORIZADO: al autorizarse la solicitud el dinero ya se entregó. El pastel va por lo autorizado. **Lo liquidado NO se muestra en ningún reporte.**
- Reporte de inversión por solicitante y reporte del reparto por categoría con un diagrama de pastel.
- Consulta visual y opción de imprimir en PDF.

## Decisiones del padre (supuestos por confirmar con el mockup)
- **Qué solicitudes cuentan:** estado guardado `autorizada` o `liquidada` (incluye en curso y terminado, que son derivados). No cuentan «esperando autorización» ni «rechazada». Los viajes de 1 día o menos no llevan importes y no entran.
- **Una moneda a la vez:** el sistema no tiene tasas de cambio, así que un selector de moneda obligatorio (por omisión la de más movimiento del período); más un filtro opcional de país.
- **Ventana de tiempo:** por fecha de AUTORIZACIÓN (momento en que se entrega el dinero; sale de `viaticos_historial`/`viaticos_movimientos`), no por fecha de creación ni de viaje. Por confirmar con el dueño si prefiere la fecha del viaje.
- **Reporte 1 — Inversión por solicitante:** barras horizontales ordenadas de mayor a menor + tabla (solicitante, solicitudes, total autorizado, % del total, promedio por solicitud).
- **Reporte 2 — Reparto por categoría:** pastel con Hospedaje, Combustible, Alimentación, Depreciación y Otros gastos (los gastos libres agrupados), con monto y % en la leyenda; global por omisión y por solicitante al elegir uno (clic en el reporte 1 o selector).
- **Gráficos:** SVG propio, sin librerías (el proyecto no admite frameworks).
- **PDF:** generado en el servidor con `pdf-lib` (mismo formato siempre, también en celular), con encabezado, ventana, moneda, ranking, pastel y tabla; el dueño no objetó esta recomendación.
- **Permiso:** migración `43_viaticos_reportes.sql` (`viaticos.reportes`, solo Administrador por omisión, el resto por rol desde Administración).
- **Datos:** los importes por categoría se calculan de las partes de la solicitud (hospedajes, comidas con su valor guardado, gastos por tipo, combustible por km/rendimiento/precio, depreciación km × valor), con la misma lógica de `calculoService`.
- **Mockup obligatorio** (CLAUDE.md): Figma del módulo (https://www.figma.com/design/UxBfvT3cceaLEvnYsnJeZA), celular, tablet y PC, sin código antes de la aprobación.

## Tareas
- [x] T0. Mockup en Figma (celular, tablet, PC) y aprobación del dueño.
- [x] T1. Migración 43 (permiso) y consultas/servicio de reportes (inversión por solicitante, reparto por categoría).
- [x] T2. Endpoints `GET /reportes/...` con `viaticos.reportes`, PDF del reporte.
- [x] T3. Frontend: pestaña, barra fija, ranking, pastel SVG y tabla, estados vacío y de error, responsive.
- [x] T4. Documentación del módulo.
- [ ] T5. Pruebas por API y navegador.

## Rutas
T0: trabajador de diseño delegado. T1/T2 (servidor) y T3 (frontend): escritores delegados, uno a la vez.

## Pruebas
Sin runner automatizado; RED/GREEN no aplica (excepción registrada). Los importes por categoría se verifican contra una solicitud de prueba conocida (p. ej. `VIA-GT-39`).

## Evidencia T0 (2026-11-17)
Mockup creado (trabajador de diseño delegado; el padre revisó la captura del marco de PC): página «Reportes», https://www.figma.com/design/UxBfvT3cceaLEvnYsnJeZA/?node-id=59-87. Marcos: `59:88` PC, `59:377` PC con solicitante seleccionado, `61:199` tablet, `61:490` celular, `64:293` estados (vacío, cargando, error), `64:330` PDF carta. Supuestos del diseño por confirmar: las tarjetas de resumen siempre muestran los totales globales (aunque haya un solicitante elegido); el pastel es una dona con el total al centro (el PDF usa un pastel en grises); en celular el panel de «Filtros» (moneda y país) no está dibujado; el PDF es de una sola página (la paginación n/total no está dibujada).

**Mockup aprobado por el dueño (2026-11-17)**, sin cambios.

## Evidencia T1/T2 (2026-11-17, escritor delegado; revisado por el padre)
- Migración 43 (permiso `viaticos.reportes`, Administrador), `reporteRepository`, `reporteService`, `reporteCalculoService`, `reporteController`, `reportePdfService`; endpoints `GET /reportes/opciones`, `GET /reportes` y `GET /reportes/pdf`. Docs: contrato, modelo de datos y README. Los importes por categoría se calculan en el servicio con `calcularCombustible`/`calcularDepreciacion`; la ventana filtra por la fecha de autorización (primer renglón `autorizada` de `viaticos_historial`).
- Escritor: `--check` de 8 archivos, cálculo con 6 solicitantes y casos de redondeo, PDF de 6 solicitantes (1 página) y de 60 (3 páginas) válidos. En el PDF el ranking dibuja solo las 10 primeras barras; la tabla lista a todos.
- Padre: `--check` repetido y prueba de SOLO LECTURA contra la BD local (ventana 2026, GTQ): 10 solicitudes, 2 solicitantes, total Q 9,602.79; la suma de las 5 categorías es exactamente Q 9,602.79 (sin avisos de descuadre) y los porcentajes suman 100.0; el reparto de un solicitante también cuadra.
- Sin probar por HTTP ni el PDF a la vista: la migración 43 no está aplicada.

## Evidencia T3 (2026-11-17, escritor delegado; revisado por el padre)
- Pestaña «Reportes» (`bar-chart-outline`, entre Gestiones y Configuración) visible solo con `viaticos.reportes`; `views/reportes.js`, `components/barrasRanking.js`, `components/graficoPastel.js` (SVG propio), `css/informes.css`; barra fija con ventana de tiempo propia (`state.ventanaReportes`), moneda y país, botón Imprimir / PDF que abre `/reportes/pdf` con los mismos filtros; ranking y tabla clicables que cambian solo el reparto; estados vacío, cargando y error; tablas como tarjetas a 640 px o menos; plano del frontend actualizado.
- Escritor: `--check` de 8 archivos, geometría del pastel (vacío, 100 %, cinco categorías), anchos de barra y escape de `<script>`; 27 claves de texto presentes. Padre: `--check` repetido y revisión del cableado de la pestaña (constantes, `panel.js`, `index.html`).
- El escritor no consultó Figma (siguió el encargo). Sin probar en el navegador: la migración 43 no está aplicada (T5).
- No hay recarga en tiempo real: el reporte se recarga al abrir la pestaña o cambiar un filtro.

## Próximo paso
T5: pruebas por API y navegador, cuando el servidor local tenga las migraciones 42 y 43.
