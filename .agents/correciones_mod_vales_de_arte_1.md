# ARCHIVO DE ARREGLO No. 1 AL MÓDULO DE: VALES DE ARTE

## VISTA DE ASESOR

1. Al formulario de `crear vale` agregar para el teléfono un combobox con los códigos de área telefónica para los países

2. Corregir label del campo `cotización`:
    - Actualmente -> Cotización (Q)
    - Corrección -> No. Cotización

3. Actualmente, cuando se adjuntan documentos, se coloca hasta el final de `boceto y descripción` un mensaje que dice "Hay docuentos adjuntos". Mejor, que sea un checkbox que se muestre antes del número de página. Aparecerá marcado cuando haya documentos adjuntos.

4. Cuando se genera un pdf, el conteo de páginas también se ve afectado por los documentos adjuntos. Ejemplo: si la generación del vale de arte resultó en 1 página, y se adjunta un documento de 2 páginas. La numeración será la siguiente:
    - Página 1: Vale de arte
    - Página 2: primera página del documento adjunto
    - Página 3: segunda página del documento adjunto
El número de página actual/total se debe mostrar en TODAS las páginas, aún en las de los documentos adjuntos

5. En la lista de los vales de arte, el asesor solo debe ver 4 estados:
    - Creado: cuando el asesor crea el vale de arte
    - Aprobado: cuando el encargado autoriza la propuesta del técnico
    - Vendido: cuando el asesor realiza la venta del vale de arte
    - Cancelado: cuando el asesor cancela la venta del vale de arte
Estos estados no son creados en la base de datos y no alteran el flujo normal de estados de un vale de arte, son lógicos. Supongamos, un vale se encuentra `Asignado` a un técnico, el asesor deberá ver -> Creado. Y no es hasta que un encargado autorize un vale de arte que el asesor podrá ver `Aprobado`. De lo contario, el vale permanecerá visible para el asesor con el estado de `Creado`.
En caso, el proceso es de modificación, los estados visibles serán:
    - Solicitando Modificación: cuando el asesor solicite a su supervisor una autorización de modificación
    - Modificado: cuando se aprobó la modificación
    - Aprobado: cuando el encargado autoriza la propuesta del técnico 
    - Vendido: cuando el asesor realiza la venta del vale de arte
    - Cancelado: cuando el asesor cancela la venta del vale de arte

6. Estos estados lógicos, afectan los filtros de la lista de vales de arte

7. Hay que corregir un error, cuando un vale de arte recibe una propuesta aprobada no puede visualizarla en el modal. Al momento de presionar la acción de: `Ver propuesta`, el hipervínculo debería ser hacia el vale de arte realizado, la propuesta. Actualmente, el hipervínculo abre el vale de arte, esto es exclusivo de la acción `Ver vale de arte` el ícono del ojo

8. Actualmente, el asesor de ventas tiene en la misma lista de vales de arte sus vales aprobados, creados/modificados, solicitados de modificación, vendidos y cancelados. Deseo que se agregue un sidebar a la vista del asesor con dos opciones:
    - Buzón: acá estará el mini dashboard y el buzón de los vales de arte, ya no mostraremos aquí los vales vendidos y cancelados. Quitamos de acá las métricas diarias relacionados con esos vales.
    - Trabajo realizado: mismo formato que con el buzón, pero acá en el mini dashboard solo se mostrará las metricas relacionadas con los vales vendidos y cancelados. Y en la lista de los vales solo se veran los vendidos y cancelados.

### ORDEN DE LOS VALES DE ARTE

Recordar, que el criterio de orden principal en que se ponen los vales de arte es qué tan próximos están a la fecha de entrega. Este orden puede modificarse según el `Punto 2` de `Cambios generales`. 
Los vales también tienen una `jerarquía general` detallada en el `Punto 2` de `Cambios generales` y su jerarquía individual, la cual es aplicable solo a la vista del actor. Para este actor es:

1. Estado de `Aprobado`
2. Estado de `Solicitados de modificación`
3. Estado de `Modificado`
4. Estado de `Creado`
4. Estado de `Vendido`
4. Estado de `Cancelado`

## VISTA ENCARGADO

1. Actualmente, la vista de carga de trabajo no se actualiza en tiempo real. Secuencia de ejemplo:
    - Encargado asigna un vale de arte
    - Abre el panel de carga de trabajo, y en ese momento ningún técnico está trabajando algo
    - El técnico A comienza a trabajar un vale asignado
    - El panel de carga de trabajo no actualiza en tiempo real eso. Se tiene que cerar y volver a abrir el panel de carga de trabajo
Lo que debería pasar:
    - Encargado asigna un vale de arte
    - Abre el panel de carga de trabajo, y en ese momento ningún técnico está trabajando algo
    - El técnico A comienza a trabajar un vale asignado
    - El panel de carga de trabajo se actualiza automáticamente (sin salirse de él) y muestra el vale en el que está trabajando el técnico

### ORDEN DE LOS VALES DE ARTE

Recordar, que el criterio de orden principal en que se ponen los vales de arte es qué tan próximos están a la fecha de entrega. Este orden puede modificarse según el `Punto 2` de `Cambios generales`. 
Los vales también tienen una `jerarquía general` detallada en el `Punto 2` de `Cambios generales` y su jerarquía individual, la cual es aplicable solo a la vista del actor. Para este actor es:

1. Estado de `En Revisión`
2. Estado de `Creado`
3. Estado de `En Proceso`
4. Estado de `Asignado`
4. Estado de `Aprobado`

## VISTA TÉCNICO

1. Actualmente, el técnico tiene en la misma lista de vales de arte sus vales aprobados, desaprobados, asignados y el que está en proceso. Deseo que se agregue un sidebar a la vista del técnico con dos opciones:
    - Buzón: acá estará el mini dashboard y el buzón de sus asignaciones, ya no mostraremos aquí los vales aprobados y desaprobados. Quitamos de acá las métricas diarias relacionados con esos vales.
    - Trabajo realizado: mismo formato que con el buzón, pero acá en el mini dashboard solo se mostrará las metricas relacionadas con los vales aprobados y desaprobados. Y en la lista de los vales solo se veran los aprobados y desaprobados.

## VISTA SUPERVISOR

1. Cambiar el alert() de "Autorizar modificación" por un modal similar al de la confirmación de venta del asesor, pero que diga de autorizar la modificación

## CAMBIOS GENERALES

Estos son los cambios que se aplicarán a todas las vistas/roles.

1. El sonido de notifación SOLO debe sonar del lado que cae la notificación. Ejemplo: Cuando se crea un vale, solo suena la vista del encargado. Cuando un técnico realiza un trabajo y se lo envía a su encargado, solo suena la vista del encargado. Etc.

2. Las tablas actualmente solo filtran por los estados de los vales de arte. Se necesita agregar opciones de ordenamiento de filas por correlativo, fecha de igreso, creado, etc. Tipo excel. Este ordenamiento se puede poner o quitar, ya que, es importante respetar el orden detallado en cada actor en `ORDEN DE LOS VALES DE ARTE` y su jerarquía individual. La jerarquia general es:
    - Urgentes atrasados
    - Atrasados
    - Urgentes
    - Normales
Esta jerarquía es aplicable para cada nivel de la jerarquía individual, Ejemplo: para tres vales `Aprobados` con distintas condiciones
    a. Aprobado urgente atrasado
    b. Aprobado atrasado
    c. Aprobado urgente
    d. Aprobado
Y así para todos los niveles de la jerarquía individual

3. Las fechas, deben mostrarse en formato dd/mm/aaaa.

4. Solo la fecha de ingreso se muestra fecha y hora dd/mm/aaaa hh:mm

5. Asegurarse de aplicar idempotencia a las acciones. Esto que no solo sea validado por el frontend, que sea validado por el core del sistema supongo.

6. Actualmente, cuando se genera una modificación, se coloca el texto: "\*\*\*\*\*\*MODIFICACION\*\*\*\*\*\*". Lo que se solicita es que:
    - El formulario de modificación ya no permita adjuntar documentos nuevos. Quitar esta opción
    - El texto y las nuevas imágenes se agreguen al final del vale de arte original. Todo el contenido de la modificación deberá estar en vuelto (al principio y al final del contenido de modificación) con "\*\*\*\*\*\*MODIFICACION\*\*\*\*\*\*"
    - Al pié de página, en la parte izquierda, se deberá indicar con texto "MODIFICAR". Así para todas las páginas del vale de arte (inclusive los documentos adjuntos)

7. No almacenar las imágenes usadas para al creación del vale de arte, únicamente la descripción


