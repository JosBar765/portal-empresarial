# ARCHIVO DE ARREGLOS No. 4 AL MÓDULO DE: VALES DE ARTE

1. Actualmente, el asesor le pasa lo mismo que ya habíamos corregido. Cuando el asesor presiona la acción de ver propuesta no puede ver la propuesta. Más bien, en el modal el hipervínculo que le sale para el vale de arte, este debería ser para la propuesta.

2. La correción se solicita automáticamente al momento de rechazar la propuesta. No son dos acciones separadas. Al momento de rechazar, el vale cambia a `SOLICITAR CONFIRMACIÓN` y le cae al buzón del encargado general.

3. Rechazado no es un estado, es la acción que nos lleva a solicitar una corrección. Por lo que, una entidad vale de arte con estado `RECHAZADO` no debería existir. Sin embargo, en el historial si aparecerá cuando se rechazó el vale, pero el estado al que fluye el val de arte es a `SOLICITAR CONFIRMACIÓN`. Fue mal planteamiento.

4. El asesor, podrá ver sus equivalencia de los estados lógicos la acción `HISTORIAL`, el asesor no podrá ver todos los estados, solo los lógicos

5. Cambiar el color de la burbujita del estado de "Confirmado" a verde, actualmente es gris

6. Actualmente en `trabajo realizado`, el asesor solo puede ver el vale de arte. Necesito que integres la acción de ver propuesta también, ya que para este punto el vale tuvo que haber sido confirmado de recibido (por lo que ya existe una propuesta). Entonces, es importante poder ver tanto el vale como la propuesta.

7. El vale de arte que se genera a partir de la modificación se genera incorrectamente. Actualmente, el vale generado mantiene la información de los encabezados, pero la sección de "Boceto y Descripción" no muestra nada. Esto es debido a que el formulario de modificación solicita una justificación, la cuál no escribe en el documento. Te explicaré el flujo que debería seguir una modificación:
    - El asesor solicita la modificación
    - Al asesor le aparece el mismo formulario de creación de vale de arte, pero con la información precargada del vale original
        - No se precargará la antigua descripción, ni las imagenes anteriores ni el documento adjunto
        - El campo de justificación será el nuevo contenido de "Boceto y Descripción" del vale de arte de la modificación
    - El asesor no podrá agregar más imágenes y/o documentos
    - El sistema genera un nuevo vale de arte con el correlativo del vale original con el prefijo MOD
        - El vale de arte esperado es similar al vale de arte original, solo que con una nueva fecha de ingreso y fecha de entrega
        - La justificación irá en "Boceto y Descripción"
        - Se sigue la misma regla de marcación de urgente si la fecha de entrega es <3 días
        - El documento adjunto al vale de arte, será la propuesta dada para el vale de arte original
    - Para este punto el nuevo vale entra al buzón del asesor
    - El asesor puede confirmar la modificación
    - El asesor podrá ver, el nuevo vale de arte de la modificación realizada para el vale original. Ya de nada sirve el vale original para este punto.

8. Actualmente, el pdf se genera muy compactado. Cuando te indique que removieras los bordes lo hiciste bien, pero compactaste todo de más. Lo que quería era que redujeras en un 70% el espaciado entre secciones: información del vendedor, del cliente, de venta, y boceto y descripción. Entonces:
    - Revierte todos los cambios del espaciado, y reduci el 50% del espaciado exterior de las secciones, pero mantene el espaciado interno de cada sección para que la información siga siendo legible
    - La firma de autorización bajala más, unos 25 px. Actualmente no dejas suficiente espacio para firmar
    - El título de "Boceto y Descripción" casi que se sobreescriben con la información de la venta. Esto se debería solucionar con el espaciado exterior de las secciones

9. Quitaremos la columna de "Taller" de las vistas de los encargados y los técnicos.

10. El encargado general, al momento de ver la propuesta, en el modal se deben listar las propuestas individuales de los talleres de donde vinieron los vales. Ejemplo:
    - Un vale de arte se generó para caer en diseño y diseño uv/3d
    - Cuando ambos departamentos regresen el vale de arte con la propuesta el encargado general podrá ver desde el modal de propuestas individualmente cada uno de ellos
        - Propuesta diseño
        - Propuesta diseño uv/3d
        - ...

11. La fusión de las propuestas de los vales de arte NO la hace el sistema, eso es trabajo del encargado general. Por lo que, no solo debe permitir aprobar, debe permitir agregar su propuesta (la fusión en un documento pdf) y aprobar, para que se le retorne al asesor

12. El historial para cada uno de los encargados y técnicos, debe mostrar la información únicamente de su taller. De nada me sirve que el taller de diseño sepa cuando un técnico de uv/3d haya puesto su tarea en proceso. Que esa información sea individual. Los que verán todo serán el encargado general y el supervisor. Obviemos al administrador de momento

13. Actualmente, hay un error. Sabemos que para solicitar una modificación se necesita confirmar de recibido el vale de arte. Me pasa que eso se registra, pero en el momento que solicito la modificación ese registro de confirmación se borra. Necesito que se mantenga, ya habíamos quedado que el vale modificado es un nuevo vale. No quiero perder el registro de los confirmados cuando solicito una modificación para eso es la tabla de auditoría