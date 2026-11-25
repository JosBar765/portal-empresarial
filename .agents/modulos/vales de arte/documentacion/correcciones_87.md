# Correcciones 87: con filtro de talleres, el reporte de diseñadores muestra a todos los de cada vale

Fecha: 2026-11-25. Pedido del dueño: un vale compartido muestra siempre a todos sus diseñadores, también al filtrar por taller.

## Defecto

Con un filtro de talleres, la fila del desglose solo mostraba a los diseñadores de los talleres elegidos (por ejemplo, «Alma Boror» en un vale de Alma Boror y Jose Alfaro). Con datos locales de agosto a noviembre, filtrando el taller Diseño, eran 29 de 124 filas. El reporte de talleres no lo tenía.

## Cambio

- El filtro de talleres decide **qué vales aparecen**, no a quiénes muestra la fila: la lista de diseñadores del vale sale de todas sus filas (`valeReporteGruposService.js`). Aplica a pantalla y PDF.
- La **gráfica** no cambia: sigue mostrando solo a los diseñadores de los talleres elegidos. Por eso una fila puede nombrar a alguien sin barra.
- Cada fila recuerda de qué barras viene (`valeReporteTalleres.js`): un vale sin diseñador en el taller elegido y con diseñador en otro sigue saliendo al enfocar «Sin asignar».
- «Los de cada vale» son los diseñadores **asignados hoy**; quien fue reemplazado no aparece (pendiente de gerencia, ver `correcciones_85.md`).

## Verificación

- `probarDesgloseDisenadores.mjs`: caso «Sin asignar» en el taller elegido y diseñador en otro (falló antes del ajuste).
- `verificarReportesContraBD.mjs`: dos comprobaciones nuevas o cambiadas. Con filtro de taller cada fila muestra a los mismos que sin filtro (falló antes del cambio: 29 filas). Enfocar cada barra deja exactamente sus vales (sustituye a «pares vale-diseñador», que suponía una barra por cada nombre mostrado).
- Todo en verde contra la BD local; PDF de diseñadores filtrado por taller renderizado y revisado.
