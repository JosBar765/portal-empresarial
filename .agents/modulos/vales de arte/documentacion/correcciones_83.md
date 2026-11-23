# Correcciones 83: un vale compartido es del vale completo, «Por vencer» en todos y el PDF imprime todo

Fecha: 2026-11-23. Rama `feat/vales-reportes-2`. Pedido del dueño tras revisar discrepancias de contabilidad y claridad de los reportes de Reportes.

## Regla (dueño): «justos pagan por pecadores»

Un vale que pasa por varios diseñadores o varios talleres se **entrega, o se atrasa, para todos a la vez**. No hay estado por parte: si uno de los dos se atrasa, el vale está atrasado para los dos, y solo cuenta como entregado cuando todos lo cerraron. Vale para **contadores, gráfica, desglose y PDF**, y no depende de filtros ni del alcance del usuario.

- **Diseñadores:** se elimina el conteo «por su propia parte» (la opción 1 de `correcciones_78.md`). La gráfica (asignados, entregados, entregas tarde, E y T) usa la ficha del vale completo; un vale compartido aparece en la barra de cada diseñador **con el mismo estado**. Por eso la suma de las barras puede superar los totales, y el ícono de la gráfica lo explica.
- **Desglose de diseñadores y talleres:** cada vale sale **una sola vez**, con un badge por diseñador o por taller (sin círculo de iniciales ni rol). Enfocar a uno deja los vales donde participa y la fila sigue mostrando a todos. Se elimina el detalle desplegable por diseñador (`correcciones_82.md`), porque el estado ya es el mismo para todos. Un solo código (`valeReporteTalleres.js`) une los grupos de ambos reportes.
- **Filtros:** el estado del vale se calcula siempre con todas sus filas (`propias` en `valeReporteGruposService.js`), así que filtrar por un taller o ser un Encargado con acceso parcial no cambia si un vale está entregado.
- Se quitan `parteEntregada`, `abiertoDeParte`, `fichaPorParte`, `agruparPorDisenadores`, `textoDeParte` y la copia `grupos.porParte`.

## «Por vencer» en los cuatro reportes

La tarjeta, la sección del desglose, el filtro de contador, las notas y el PDF de tiendas, talleres, diseñadores y asesores dicen **«Por vencer»** (antes tiendas y asesores decían «Sin entregar»). El reporte de rendimiento y los demás PDF no cambian.

## El PDF imprime todo

- La gráfica de **tiendas y asesores** imprime **todas** las barras (antes las 10 primeras y una fila «Otras (N)»); si no caben en la página, siguen en la siguiente.
- La nota de la gráfica de diseñadores se imprime ajustada en líneas bajo el título (igual que talleres), con el mismo texto del ícono de la pantalla. La prueba de márgenes detectó que como una sola línea se salía de la página.

## Pantalla = PDF (se conserva de `correcciones_82.md`)

Textos de las tarjetas compartidos (`detalleUrgentes`, `detalleEfectividad`, `detalleATiempo`), notas de la gráfica compartidas (`NOTA_TALLERES`, `NOTA_DISENADORES`), mismo orden de la gráfica y tarjeta de Efectividad del PDF con «(N atrasados)». Lo fija `scripts/reportes/probarTextosPantallaPdf.mjs`.

## Verificación

- 10 scripts de `scripts/reportes/` en verde (se reescribió `probarDesgloseDisenadores.mjs`; `probarPdfDisenadores.mjs` ahora comprueba que 14 tiendas salen completas).
- **Contra la base local (solo lectura):** `node scripts/reportes/verificarReportesContraBD.mjs` generó los cuatro reportes de agosto a noviembre de 2026 (hasta 71 vales por mes, 15 compartidos), con y sin filtro de taller, y pasaron **736 comprobaciones**: identidad Entregados + Atrasados actuales + Por vencer = Ingresados, desglose = contadores sección por sección, cada vale una sola vez, el filtro no cambia el estado de ningún vale, gráfica = pares vale-taller / vale-diseñador, y el PDF dice lo mismo que la pantalla (tarjetas, títulos con su total, todos los correlativos y la gráfica).
- Los reportes de tiendas y asesores cuentan «entregado» como «ya llegó al asesor» y los de talleres y diseñadores como «aprobado por el Encargado»; por eso sus cifras de un mismo mes difieren (p. ej. noviembre: 40 y 42 entregados). Es la definición documentada, no una discrepancia.
- **No verificado:** el PDF dibujado (solo texto y márgenes decodificados) y el aspecto en pantalla con estos datos reales.

## Segunda pasada contra la base: un bug real

- `node scripts/reportes/verificarReportesMismaSeleccion.mjs` (solo lectura) genera los cuatro reportes sobre la **misma ventana** (noviembre 2026) y la **misma selección** (un taller y una tienda), y comprueba: mismos vales y contadores entre tiendas y asesores, y entre talleres y diseñadores; la vista enfocada de **todas** las barras (contadores = desglose enfocado) y el PDF de varias barras y variantes (entregados, tarde, urgentes); el filtro por cada contador (número del contador = vales del desglose; pantalla = PDF); y el PDF general con y sin desglose.
- **Bug encontrado (solo diseñadores):** las filas de diseñadores también traen `talleresDelVale`, y al unir el desglose se tomaba esa lista antes que la de diseñadores: los grupos y los badges salían con los **talleres** y enfocar un diseñador no encontraba sus vales (36 fallas). `valeReporteTalleres.js` ahora usa `disenadoresDelVale` cuando existe. Prueba nueva en `probarDesgloseDisenadores.mjs` y comprobación de nombres de grupo en la verificación.
- Resultado tras corregir: `verificarReportesMismaSeleccion.mjs` **551 comprobaciones OK** y `verificarReportesContraBD.mjs` **736 OK**.
- **Comportamiento conocido (no es un descuadre):** con una barra enfocada, las tarjetas de la pantalla muestran las cifras de esa barra, mientras el PDF imprime siempre las tarjetas y la gráfica generales y solo el **desglose** enfocado (el modal del PDF lo avisa).
