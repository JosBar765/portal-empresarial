# Correcciones 67 — Reporte de actividad de asesores con contadores y gráfica; «de tiendas»

Rama: `feat/vales-reportes-2`. Cómo funcionan hoy los reportes: `reporte_actividad_tienda.md` y `reporte_actividad_asesores.md`. Diseño: el del reporte de tiendas (el dueño dispensó el mockup).

## Problema

El reporte de actividad de asesores solo listaba vales agrupados por asesor, filtrados por asesores elegidos. No daba un resumen ni permitía ver la actividad de una tienda concreta, y el reporte de tiendas no tenía forma de llevar de una tienda a sus asesores.

## Qué cambia

- **Reporte de asesores con el selector de tienda.** El mismo selector en cascada del reporte de tiendas (con su propio valor, `state.reporte2.asesorTiendaId`) se suma al selector de asesores, que no se quita. La tienda acota todo el reporte.
- **Los mismos contadores** (Ingresados, Urgentes, Sin entregar, Atrasados con anteriores y actuales, Entregados con y sin atraso), calculados sobre la tienda elegida.
- **Gráfica «Vales ingresados por asesor»:** una barra por cada asesor que haya metido un vale, con el mismo diseño que la de tiendas (porcentaje en la punta, cantidad a la derecha). Solo informa: no se pulsa. En el PDF, «VALES INGRESADOS POR ASESOR» con las 10 mayores y «Otras (N asesores)».
- **Gráfica apilada:** cada barra de asesor se divide en un tramo azul (vales no urgentes) y un tramo rojo (urgentes, el color de la insignia «URGENTE»), para ver en la misma barra cuántos fueron urgentes; con leyenda, cantidad de urgentes dentro del tramo rojo si cabe y el detalle «N vales · U urgentes» al pasar el cursor. Al significar el color «urgente», no se resalta la barra mayor. La de tiendas no cambia. Backend: `porAsesor` ahora trae `urgentes`. PDF: `_graficaBarras` con `{ apilada: true }`. La paleta (azul de la app y el rojo de urgente) pasó el validador de paletas.
- **Desglose de Vales de Arte** con las mismas categorías, agrupado por asesor.
- **PDF del reporte de asesores:** franja de contadores, gráfica, línea divisoria y desglose, y el mismo modal «¿incluir el desglose?» (`desglose=0`).
- **Del reporte de tiendas al de asesores:** presionar el **nombre** de una tienda en la gráfica abre un modal «¿Quieres ir al reporte de actividad de asesores de <tienda>?». «Sí» abre el reporte de asesores con esa tienda y el mismo período, sin asesores elegidos; «No» o cerrar el modal deja todo igual. Presionar la **barra** sigue enfocando contadores y desglose. El modal solo se ofrece a quien tiene el permiso del reporte de asesores.
- **Renombre:** «Reporte de actividad de tienda» pasa a **«Reporte de actividad de tiendas»** (combo, título del reporte y del PDF). Los permisos y las rutas (`actividad-tienda`) no cambian.

## Detalles técnicos

- Backend: `_filtrosReporteEquipo` lee `tiendaId`, `tiendaIds` y `desglose` para asesores; `valeReporteEquiposService.obtenerReporte` valida la tienda con las reglas de alcance (400 si no es visible), la pasa como `tiendaSel` a `armar` y devuelve `tiendaIds`, `filtros.tiendas` y `contadores`. `valeReporteGruposService._contadores` calcula `porAsesor` cuando se agrupa por asesor y `completarContadores` (nuevo, compartido con el de tiendas) suma Atrasados y Sin entregar.
- PDF: `_graficaTiendas` pasó a `_graficaBarras(ctx, lista, titulo, unidadOtras)`, genérico.
- Frontend: `graficaTiendas.js` pasó a `graficaBarras.js` (genérico; interacción opcional). `actividadReporte.js` recibe `graficaClave` (`porTienda` o `porAsesor`) y, en el contexto de render, `irAReporte(id)` y `puedeIrA(id)` que entrega el shell de la pestaña (`reportes2.js`). Modal nuevo: `reportes2/modalIrAAsesores.js`.
- Nombre pulsable: el nombre de cada tienda es un botón (`rep2-gt-nombre--boton`) con subrayado al pasar el cursor.

## Pendiente de probar con datos reales

El reporte de asesores con tienda (alcance de quien supervisa incluido), la navegación desde el reporte de tiendas, el PDF de asesores con y sin desglose y la gráfica por asesor.
