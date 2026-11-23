# Correcciones 86: los reportes muestran todo y el desglose va por fecha de entrega

Fecha: 2026-11-23. Pedido del dueño: ningún reporte debe esconder filas tras un «Ver N restantes», todo el desglose va ordenado por fecha de entrega y el texto sobre las urgentes en la gráfica de asesores va en blanco.

## Salen todos, siempre

- **Gráfica de barras (tiendas y asesores):** ya no hay «Ver las N restantes» ni «Ver menos»; se dibujan todas las barras (antes solo 10).
- **Desglose de vales:** ya no hay «Ver N más (quedan M)»; cada sección dibuja todas sus filas (antes, 50 por tanda). Se eliminó `desglosePaginado.js`.
- **Atrasados antes del período:** el bloque muestra todos los vales (antes 5 y «Ver los N restantes»), y el servidor ya no recorta a 200 (`MAX_VIGENTES` sin tope), así que el aviso «Se muestran los N más atrasados de M» no aparece.
- Sigue vigente la válvula de más de 5000 vales (`desgloseOmitido`): ahí el desglose no se lista y el reporte lo dice.

## El desglose va por fecha de entrega

- Todas las secciones (Atrasados, Entregados, No entregados) ordenan sus vales por fecha de entrega, de la más próxima a la más lejana, y a igualdad por id. Antes: atrasados por días de atraso, entregados por días de atraso con que se entregaron y no entregados por fecha de ingreso.
- **Pantalla:** cada sección es una sola tabla ordenada por fecha de entrega, sin importar a qué persona, taller o tienda pertenece cada fila.
- **PDF:** los vales de cada grupo van por fecha de entrega y los grupos por la fecha de su primer vale (en talleres y diseñadores, antes por nombre).
- **Atrasados antes del período:** también por fecha de entrega (antes, por días de atraso).
- Código: `valeReporteGruposService.js` (`COMPARADORES`, `MAX_VIGENTES`), `valeReporteTalleres.js` (orden de vales y grupos), `desglose.js` (`htmlTablaSeccion`).

## Texto de las urgentes en blanco

El número del tramo ámbar (urgentes) de la gráfica de asesores va en blanco, en pantalla (`.rep2-gt-seg--urgente`) y en el PDF.

## Verificación

- Con datos reales (BD local): 400 filas de los cuatro reportes, todas en orden de fecha de entrega, dentro de cada grupo y entre grupos; sin recorte de vigentes.
- Scripts de unidad y de verificación contra la BD en verde; la prueba de desglose de diseñadores se actualizó al nuevo orden de grupos.
- PDF de asesores renderizado: números de las urgentes en blanco y atrasados por fecha de entrega.

## Ajustes de presentación (pantalla y PDF)

- **Encabezado del PDF de actividad:** «Fecha de entrega: …» va en negrita (los cuatro reportes de actividad); «Generado: …» sigue en gris.
- **Gráfica de talleres y diseñadores:** las dos barras de cada persona quedan más juntas (3 px) y se distinguen mejor de la persona siguiente (12 px). Se fijó el alto de línea de la cifra (`.rep2-gd-cant`), que mantenía cada línea en 16 px.
