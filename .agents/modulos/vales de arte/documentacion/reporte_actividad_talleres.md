# Reporte de actividad de talleres

> **Actualización 2026-11-23 (`correcciones_83.md`):** el estado de un vale compartido es el del vale completo también al filtrar, y diseñadores usa la misma regla y el mismo desglose; ver `correcciones_83.md`.

Reporte 3 del combo de Reportes (`actividad-taller`, permiso `vales.reporte_actividad_taller`). Desde 2026-11-23 tiene **el mismo diseño que el de diseñadores** (ver `reporte_actividad_disenadores.md`) con **la lógica de conteo de tiendas enfocada a talleres**.

## Qué cuenta

- Solo lo que **entró a un taller** y lo que ese taller trabajó. Un vale que todavía no llega a ningún taller no se cuenta (no hay fila «Sin asignar» ni «Sin taller»).
- **Regla de los vales compartidos (dueño, 2026-11-23):** un vale que pasa por varios talleres se **entrega, o se atrasa, para todos sus talleres a la vez**. No existe «entregado a tiempo en un taller y atrasado en el otro»: el vale está entregado solo cuando **todos** sus Encargados lo aprobaron (la definición de vale completo que ya usaba el reporte). **Asignado** = el vale tiene al menos una fila de ese taller dentro del alcance. (Esto difiere del reporte de diseñadores, donde cada diseñador cuenta por su propia parte.)
- **Contadores y desglose:** cuentan vales únicos y por eso **cuadran** (mismas cifras de Atrasados actuales, Por vencer y Entregados). En el desglose general cada vale sale **una sola vez**, con todos sus talleres juntos en la columna («Diseño, Diseño UV/3D»), sin fila por taller y sin el círculo de iniciales (`valeReporteTalleres.js`).
- **Gráfica:** el vale cuenta **en la barra de cada uno de sus talleres** (con el mismo estado), así que la suma de las barras puede ser mayor que los totales.
  - En pantalla el aviso es un **ícono de información junto al título de la gráfica**: la ayuda sale al pasar el mouse, al enfocarlo con teclado o al tocarlo en celular.
  - En el **PDF** la misma nota va impresa directamente bajo el título de la gráfica (no hay hover en papel).

## Contadores

Los mismos del reporte de diseñadores: primera fila **Ingresados · Por vencer · Efectividad · Entregas a tiempo**; debajo Atrasados (anteriores, actuales) y Entregados (con y sin atraso). Sin Urgentes. «Por vencer» son los vales abiertos aún dentro del plazo. Efectividad = entregados ÷ ingresados; Entregas a tiempo = entregados sin atraso ÷ entregados; hasta dos decimales.

## Gráfica «Vales asignados y entregados por taller»

- Plegable (como las demás); salen **todos** los talleres, de más a menos asignados.
- Dos barras por taller: asignados (azul) y entregados apilada (verde a tiempo, roja tarde con su número). Columnas **E** y **T** a la derecha, con su leyenda.
- Interacción (como tiendas):
  - La barra «Asignados» enfoca contadores y desglose en ese taller.
  - La parte verde enfoca solo lo entregado a tiempo; la roja, solo las entregas tarde.
  - Al enfocar un taller el desglose muestra los vales de ese taller (incluidos los compartidos) **siempre con todos los talleres del vale** en la columna: el enfoque filtra los grupos unidos que incluyen ese taller (`ids` del grupo), igual en pantalla (`enfoque.js`) y en servidor/PDF (`soloGrupoDesglose`).
  - El **nombre del taller sugiere ir al reporte de diseñadores** con ese taller ya elegido en su selector (mismo modal que tienda → asesores).
  - Presionar de nuevo el mismo lugar o cambiar el selector de talleres quita el enfoque.
- Los contadores son pulsables y filtran el desglose, como en diseñadores.

## Servidor y PDF

- `valeReporteGruposService.armar` con `agruparPor: 'taller'` y `entregadoPorTaller`: ficha por parte del taller, descarta vales sin taller y devuelve `contadores.porTaller` (resumen por taller), `porGrupo` (variantes todos / entregados / tarde) y contadores sobre vales únicos. Reutiliza `valeReporteDisenadores.js` (`resumenPorGrupo`).
- Parámetros nuevos del PDF: `tallerDesglose=<id>` (taller enfocado) y `tallerModo=entregados|tarde`, además de `desglose=0`, `desgloseEstado` y `desgloseUrgentes` (ver `reporte_actividad_tienda.md`).
- El PDF lleva la franja de contadores de 72 pt, la gráfica por taller con la nota impresa y el desglose (sección «Por vencer»).

## Prueba

`node scripts/reportes/probarPdfDisenadores.mjs` (bloque «h» de talleres) y las de diseñadores. El conteo por parte de taller dentro de `armar` necesita la base de datos y no se ejercitó aquí.
