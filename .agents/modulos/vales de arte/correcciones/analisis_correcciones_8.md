# ARCHIVO DE ARREGLO No. 8 AL MÓDULO DE: VALES DE ARTE

1. Bajaremos unos pixeles la frase "Firma y Autorización" que está en la caja de la derecha de la cotización. El propósito es bajar el texto para dejar la caja vacía para la firma. Que esto no baje más o a haga más pequeña el área de "Boceto y Descripción"

2. Para el supervisor, en el mismo modal de "Autorización" de la modificación, pone dos hipervínculos, para que desde ese mismo panel pueda abrir tanto el vale de arte como la propuesta. Básicamente hace lo mismo de las acciones, pero desde el mismo modal

3. Actualmente, si se respeta la jerarquía determinada para todos los actores con respecto a los vales que ven en su buzón. Pero recorda que esto solo son agrupaciones, el ordenamiento principal es la fecha de entrega. Esto es más visible en los vales con atraso, los que más atraso acumulen deben aparecer primero que los que tinen menos atraso

4. Se agrega un nuevo contador al asesor: pendiente de confirmación. Funciona igual que los demás

5. Solo se puede generar una modificación, como quién dice, si el correlativo es MOD-... ya no permite otra modificación

6. Asegurate que el conteo de los vales lo lleve el servidor de alguna manera, o alguna secuencia en la base de datos fuera buena también

7. Asegurate que cuando un vale sea confirmado de recibido o se apruebe su modificación, el registro no siga a acumulando atraso

8. Supongamos el siguiente caso: hay 1000 vales de arte de distintos estados, con distintas acumulaciones de atraso, etc. Qué va a pasar con el tema de la jerarquía de agrupación y el ordenamiento de la lista de vales de arte? Me refiero, actualmente tenemos paginación de 50 vales de arte. Supongamos, que no hay ningún vale atrasado en los primeros 50. Pero, en los otros 50 que aparecerán con el scroll, hay vales atrasados. Estos se mueven hasta el principio de la lista? Para eso el usuario tendría que subir de regreso para poder ver los vales de arte. Además, los filtros se aplican solo a la tabla, cierto? qué pasa si hay más vales atrasados en la DB pero el filtro de atrasados solo se aplica al tabla. Como no se ha hecho el request de los otros vales cómo sabe el sistema que hay atrasados en realidad? Planteame soluciones para resolver esto. Las soluciones que me des, no las apliques todavía, documentalas en documentacion\ llamale al .md 'solucion_paginacion.md'. Ya luego aplicaremos alguna de estas soluciones en los arreglos 9.

## ACLARACIÓN

Actualice la estructura de la carpeta .agents/ analizala para entender donde se encuentran ahora los archivos. Los archivos no han cambiado, simplemente los reordene.