# ARCHIVO DE ARREGLOS No. 5 AL MÓDULO DE: VALES DE ARTE

1. Actualmente, la generación de pdf me gusta pero haremos los siguientes cambios:
    - En la misma línea de los campos `NOMBRE` y `CORREO` pondremos `TELÉFONO`. Así tendremos toda la infomración del asesor de ventas en una sola línea.
    - La caja de cotización, la reduciremos en un 50%. Que esto no afecte el espacio de la firma de autorización
Lo que busco con estos cambios es ampliar un poco el tamaño del campo `BOCETO Y DESCRIPCIÓN`

2. Va mira, actualmente el encargado general sí reenvía el vale de arte modificado. Pero pasa algo, cuando hablamos de una modificación siempre tiene que retornar al encargado general no importando si la modificación se mande a uno o más talleres. 
Te pongo de ejemplo lo que pasa ahora:
    - El encargao general reenvía la modificación a un solo taller,
    - El taller adjunta la modificación y la envía
    - Luego este vale de arte va de largo con el asesor
En realidad lo que debería pasar es que esa corrección retorna al encargado general para fusionarla (en caso hayan más talleres) y luego aprobar. Ya que, la corrección sobrescribe la propuesta original del taller que cometió el error o se solicita la modificación. Si el vale original solo salió para un taller, igual tiene que retornar con el encargado general para que apruebe la modificación. Recorda que todo esto de la fusión está fuera del alcance del sistema.

3. Modificar los contadores. Vamos a dejar únicamente lo siguientes contadores para los siguientes actores:
    - Asesor: mantenemos los mismos que tiene hasta ahora
    - Encargados de taller: pendiente de asignación, asignados, en proceso, en revisión, aprobados hoy
    - Encargado general: vales por fusionar
    - Supervisor: por autorizar modificación, modificados, pendientes confirmación asesor
    - Técnico: asignados sin atraso, asignados con atraso, vale que se está trabajando (este ya lo tiene, lo mantenemos)
Para los encargados (general y de talleres), supervisor y asesores vamos a agregar un contador de atrasados en general. Recorda que estos siempre funcionan como filtros, y el motivo de este último contador de atrasados es la siguiente:
    * Supongamos que el encargado quiere ver los pendientes de asignación (presiona el contador), pero quiere ver los atrasados (presiona el contador de atrasados). Ahora, el encargado puede ver los pendientes de asignación atrasados. Nótese como el contador de atrasados es el único que se puede combinar.

# DOCUMENTACIÓN

Posterior a estos cambios, generame un archivo llamado `correcciones_6.md` donde documentarás los cambios aplicados a este archivo. El propósito es tener trazabilidad de los cambios que se han hecho. Además, generame un archivo llamado `flujo_vale_de_arte.md` donde sea un dibujo ascii que represente el flujo del vale de arte. Que ya perdí el hilo de como lo llevamos.