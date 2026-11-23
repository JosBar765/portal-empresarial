# Correcciones 78: reporte de actividad de diseñadores (contadores, gráfica agrupada, PDF)

Fecha: 2026-11-21. Rama `feat/vales-reportes-2`. Pedido del dueño: construir el reporte de actividad de diseñadores (#4) a la altura del de tiendas y asesores. Tareas: `odd/tasks/vales-reporte-actividad-disenadores.md`. Referencia funcional: `reporte_actividad_disenadores.md`.

## Cambios

1. **Contadores.** Los cinco de siempre (sobre vales únicos) más **Efectividad** (entregados ÷ ingresados) y **Entregas a tiempo** (entregados sin atraso ÷ entregados). Antes este reporte no tenía contadores.
2. **Dos decimales en todos los porcentajes de los contadores** (Urgentes incluido, también en tiendas y asesores): `porcentajeDe`/`porcentajeONulo` en el servidor, `formatoPorcentaje.js` en pantalla y los equivalentes del PDF; sin ceros sobrantes y «—» sin base.
3. **Cada diseñador cuenta por su propia parte del vale** (decisión del dueño): un vale compartido es «entregado» para quien terminó su parte aunque otro esté pendiente (`valeReporteDisenadores.js`).
4. **Gráfica agrupada por diseñador:** barra «Asignados» y barra «Entregados» apilada con las entregas tarde en rojo y su número dentro; columnas **E** (efectividad individual) y **T** (entregas tardías) con leyenda. Barras pulsables con tres modos (todos / entregados / solo entregas tarde) y contadores pulsables como en los otros reportes.
5. **PDF:** franja de contadores de tres filas, la misma gráfica agrupada con su columna y leyenda, y el PDF con filtros de la vista (`disenadorDesglose`, `disenadorModo`, `desgloseEstado`, `desgloseUrgentes`; el enfoque filtra el reporte ya armado, sin segunda consulta).

## Decisiones mías, por confirmar con el dueño

- Efectividad = entregados ÷ ingresados (incluye vales cuya entrega aún no llega); el rendimiento antiguo la calculaba sobre los vencidos y con un decimal.
- Color de «entregados a tiempo»: azul oscuro (`--color-primary-dark`) en lugar de verde, por daltonismo.
- Modos al presionar: nombre o barra azul = todos; parte oscura = entregados; parte roja = solo entregas tarde. «Otros (N diseñadores)» en el PDF sin barras.

## Notas y límites

- Hay reglas duplicadas entre frontend y servidor (filtro por contador, enfoque de grupo, modo → estado y formato de porcentajes), cada una con su prueba en `scripts/reportes/` (ver `reporte_actividad_disenadores.md` §10).
- No probado en el navegador ni con datos reales; el PDF no se vio dibujado (solo verificación estructural con datos de prueba).
