# Correcciones 66 — Ajustes de Reportes 2 y gesto «atrás» del celular

Rama: `feat/vales-reportes-2`. Este archivo es el **registro cronológico** de los cambios; cómo funciona hoy el reporte de tienda, de punta a punta, está en `reporte_actividad_tienda.md`.

## Contadores: Recibidos según el ancho de su tarjeta

- La tarjeta de Recibidos decide su diseño por **su propio ancho**, no por el de la pantalla (consulta de contenedor). Si no alcanza para el total y las categorías lado a lado (unos 360 px útiles), el total pasa a una línea («Recibidos 3») y las categorías bajan en dos columnas iguales. Si alcanza, se mantiene el diseño de escritorio.
- Hasta 1023 px las tarjetas Ingresados y Urgentes van lado a lado y Recibidos ocupa todo el ancho (antes el corte era 640 px).

## Contadores: Atrasados y Sin entregar, «Entregados» y el PDF

- Maquetas aprobadas en Figma: PDF `24:2`, pantalla `26:2` (escritorio) y `26:43` (celular).
- **Nuevos contadores** (reporte de actividad de tienda), en dos filas: Ingresados · Urgentes · Sin entregar / Atrasados (Anteriores, Actuales) · Entregados (Con atraso, Sin atraso). «Anteriores» son los atrasados con entrega antes del período; no suman en Ingresados. Entregados + atrasados actuales + sin entregar = Ingresados.
- **Renombres** solo en Reportes 2: «Recibidos» → «Entregados» y la sección «No entregados» → «Sin entregar» (pantalla y PDF de los cuatro reportes). Reportes y Actividad conservan su nombre.
- **PDF:** el reporte de tienda lleva los contadores en una franja de dos filas bajo el encabezado (~9 % de la página). Backend: `contadores.atrasados {total, anteriores, actuales}` y `contadores.sinEntregar` en `valeReporteTiendaService.js`; dibujo en `_contadoresActividad` de `valeReportePdfService.js`.
- **Pantalla:** rejilla de seis columnas (tres tarjetas y dos); en celular, Ingresados y Urgentes lado a lado y el resto a ancho completo. Las tarjetas Atrasados y Entregados deciden su diseño por su propio ancho (consulta de contenedor).
- Ayuda actualizada en «Cómo funciona este reporte» (Sin entregar, Atrasados, Entregados).
- **Títulos de las agrupaciones** (solo Reportes 2, pantalla y PDF): «Atrasados antes del período» → **«Atrasados (anteriores al período)»** y «Atrasados en el período» → **«Atrasados (período actual)»**. Reportes y Actividad conservan los suyos. Los textos están en `reportes2/textos.js` (`tituloVigentes`, `seccionAtrasados`) y, en el PDF, en `TITULOS_REPORTES2` de `valeReportePdfService.js`; `htmlBloqueVigentes` recibe ahora un `titulo` opcional.

## PDF de Reportes 2: línea de filtros resaltada

- En el PDF de los reportes de actividad de Reportes 2, la línea de filtros bajo el título («Tiendas: Todas las tiendas», «Taller: …», etc.) va con fondo amarillo (`AMARILLO_RESALTE`) y tinta más oscura. Actividad y Rendimiento conservan la suya sin resaltar.

## Descargar PDF del reporte de tienda: modal «¿incluir el desglose?»

- Solo en el reporte de actividad de tienda: al presionar «Descargar PDF» se abre un modal que pregunta «¿Quieres incluir el desglose de Vales de Arte en el reporte?» con dos botones. **«Sí, incluir el desglose»** imprime el reporte completo, como hasta ahora. **«No, sin desglose»** imprime solo la cabecera, los contadores y la gráfica por tienda, sin las secciones de vales (atrasados anteriores, atrasados del período actual, sin entregar y entregados).
- Cuando el desglose se incluye, una **línea gris divide** el resumen (contadores y gráfica) del desglose (`_divisionDesglose`); si el desglose arrancaría en una página nueva, no se dibuja.
- Cerrar el modal sin elegir (X, Escape, clic fuera o «atrás» del celular) **cancela la descarga**.
- **Con una barra enfocada en la gráfica**, «Sí» imprime el desglose **de esa tienda**, con el título «DESGLOSE DE VALES DE ARTE: <TIENDA>»; los contadores y la gráfica del PDF siguen siendo los del filtro. El modal avisa qué tienda se imprimirá. Técnica: el PDF recibe `tiendaDesglose=<id>`; el servidor pide el reporte de esa tienda (si no es visible para el usuario responde 400) y usa solo sus secciones.
- Técnica: el PDF recibe `desglose=0` para omitirlo (`incluirDesglose` en `valeReporteTiendaService.js` y corte en `_actividad` de `valeReportePdfService.js`); el modal está en `reportes2/modalDesglosePdf.js` y se activa con `preguntarDesglose: true` en `actividadTienda.js`. Los otros tres reportes de Reportes 2 no preguntan. El modal reutiliza el componente de modales existente, sin mockup.

## Gráfica «Vales ingresados por tienda» (reporte de actividad de tienda)

- Barras horizontales de mayor a menor bajo los contadores, en pantalla y en el PDF. Muestra cuántos vales ingresó cada tienda y su porcentaje del total de Ingresados; la que más mete va en azul y las demás en gris. El nombre de la tienda se lee completo (nunca se recorta con «…»): los nombres van alineados a la derecha, junto al arranque de las barras, y la columna mide lo que el nombre más largo. Sin subtítulo con la frase de quién lidera (el dueño lo quitó); barras un 25 % más gruesas.
- **Cuándo aparece:** cuando el filtro abarca más de una tienda (todas, todas las de un país o de un grupo) y al menos una tiene vales en el período; sale aunque solo una haya metido vales (una barra al 100 %), para que no aparezca y desaparezca según el día. Si el filtro es una sola tienda, no se muestra. El servidor manda `contadores.porTienda` en `null` si el filtro es una sola tienda.
- **Por qué barras y no un pie:** con decenas de tiendas (el seed trae 27) las porciones de un pie no se distinguen; las barras comparan mejor. Decisión del dueño tras la recomendación; no hubo mockup (dispensado).
- **Pantalla** (`reportes2/graficaBarras.js`, antes `graficaTiendas.js`): 10 tiendas visibles y «Ver las N restantes» despliega el resto; en celular el nombre y el valor van en una línea y la barra debajo. **PDF** (`_graficaTiendas` en `valeReportePdfService.js`): las 10 mayores y una fila «Otras (N tiendas)» sin barra, porque suma varias tiendas y no es comparable con una sola. En pantalla y en el PDF el porcentaje va en la punta de cada barra y la columna de la derecha lleva solo la cantidad (el largo de la barra reserva el lugar del porcentaje).
- **Barras pulsables** (solo pantalla): presionar una barra (o su nombre o cifra) **enfoca los contadores y el desglose en esa tienda**, y la barra lleva un borde; presionarla de nuevo quita el enfoque. El selector de tienda, la gráfica y el PDF **no cambian**. Los datos de la tienda se piden aparte (`tiendaId`), en paralelo con los del filtro vigente (`grafica` en `actividadTienda.js`, `state.reporte2.tiendaElegida`). Elegir otra tienda en el selector descarta el enfoque; si la tienda enfocada ya no está en la gráfica (cambió el período), el enfoque se descarta solo. Si la elegida está entre las ocultas, la lista se muestra desplegada.
- Los vales por tienda se cuentan sobre todos los vales ingresados, sin el tope de 1000 de las listas (`_contadores` de `valeReporteGruposService.js`).

## Desglose de Vales de Arte: los atrasados anteriores entran al contenedor

- Solo en la pantalla de Reportes 2 (los cuatro reportes de actividad). El contenedor que se titulaba «Vales por tienda» (o taller, diseñador, asesor) ahora se llama **«Desglose de Vales de Arte»**, para poder nombrarlo como una sección.
- «Atrasados (anteriores al período)» deja de ser un bloque suelto sobre el contenedor y pasa a ser su **primera sección**, con la misma tabla y el mismo pliegue que las demás (clave propia `atrasadosAnteriores`, abierta por defecto). Ya no se recuerda su pliegue en `vales:rep2VigentesPlegado`; ahora lo guarda como cualquier sección.
- Si el período no tiene vales pero hay atrasados anteriores, se muestra esa sección y debajo el aviso de «sin vales en este período».
- El PDF no cambia. «Reportes» conserva su bloque de atrasados.

## Contadores: se quita «Adelantados»

- Recibidos queda solo con **Con atraso** y **Sin atraso**. «Sin atraso» incluye los que llegaron el mismo día o antes de la fecha de entrega (y los que no tienen fecha de llegada registrada); el total de Recibidos no cambia.
- Backend: `_contadores` de `valeReporteGruposService.js` ya no calcula la llegada al asesor; la respuesta ya no trae `recibidos.adelantados`. Frontend: dos cajitas (dos columnas al bajar) y el texto de ayuda actualizado. La nota de `correcciones_65.md` describe el diseño anterior.

## Reporte de tienda: sin círculo de iniciales

- La columna Tienda muestra solo el nombre. Talleres, diseñadores, asesores y la pestaña Reportes conservan el círculo.

## El gesto «atrás» del celular ya no saca del módulo

- **Problema:** con un modal o el visor de documentos abierto (por ejemplo, «Ver vale» o un PDF desde un reporte), el botón o gesto «atrás» salía de Vales de Arte y llevaba al dashboard, porque el módulo no manejaba el historial del navegador.
- **Qué cambia:** mientras haya una capa abierta se mantiene una entrada propia en el historial; «atrás» cierra solo la capa de arriba. Si el modal pide confirmar (cambios sin guardar) y el usuario no confirma, la entrada se repone y el siguiente «atrás» también se queda en el módulo.
- **Dónde:** `utils/historialCapas.js` (nuevo) y su uso en `components/modal.js` y `components/visorDocumento.js`. Es el mismo mecanismo de Viáticos; los componentes se copian entre módulos, no se importan.
- **Límite:** la descarga directa del PDF de un reporte la gestiona el navegador del teléfono fuera de la página; este arreglo cubre los modales y visores propios del módulo.
- Pendiente de probar en un celular real.
