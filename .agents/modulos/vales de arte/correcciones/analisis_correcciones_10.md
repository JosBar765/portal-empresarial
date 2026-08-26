# ARCHIVO DE ARREGLO No. 10 AL MÓDULO DE: VALES DE ARTE

1. Agregaremos un algoritmo de comprensión para las imágenes que sea Lossless y que no intervenga con la libería que estas usando actualmente para la generación de PDF

2. Actualmente, cuando ya se inició sesión y me dirigo al login puedo acceder a él, cosa que no debería ser así. Lo que necesito, es que si ya hay una sesión iniciada y me dirigo al login, que me redirecciones al dashboard. El login solo se muestra cuando se cierra la sesión o no hay sesión

3. Actualmente, hay un bug con el supervisor. Cuando el asesor solicita una modificación de un vale de arte, la propuesta se adjunta al final del vale de arte. Por lo que, el supervisor cuando revisa la solicitación de modificación y decide ver el vale de arte, visualiza: el vale de arte original con la propuesta adjunta al final. Esto no debería pasar, para esto, es que el asesor tiene ambas acciones: ver vale de arte y ver propuesta.
Recorda, que cuando se solicita una modificación todavía no se crea el vale de arte modificado (prefijo MOD). Entonces, el vale de arte para cuando se solicita una modificación debe ser el original, pero sin la propuesta adjunta al final.

4. Actualmente, cuando se autoriza la modificación, se crea un vale de arte de la modificación (el del prefijo MOD). Con esto todo bien, lo que me molesta es que el registo original del vale de arte se ve sobreescrito por el vale de arte con el prefijo MOD. Recordemos, que debemos mantener el registro de un vale de arte aún cuando su modificación es autorizada, ya que es un nuevo vale de arte el de la modificación. Por lo que, el vale de arte original no debe verse sobreescrito por el de la modificación

5. Vamos a alterar el flujo del vale de arte (posterior a esto, reescribe el archivo `..\flujo_vale_de_arte.md`). Ahora, cuando el asesor cree un vale de arte, este entará al buzón del supervisor. El supervisor debe autorizar para enviar el vale de arte, una vez autorizado ya sigue el flujo normal de los talleres. Esto implica un nuevo estado y una nueva acción para el supervisor.

6. Esto es exclusivo para el supervisor, cuando se realize una autorización de:
    - Creación: La cajita que está en blanco de `Firma y Autorización` al lado de `Cotización`. Será "firmada", lo que se pondrá será el nombre del supervisor concateado con la frase "CREACIÓN". Esta es la firma de autorización de creación por parte del Supervisor. El resultado esperado será (por ejemplo): Carlos Cornejo CREACIÓN.
    - Creación: La cajita que está en blanco de `Firma y Autorización` al lado de `Cotización`. Será "firmada", lo que se pondrá será el nombre del supervisor concateado con la frase "MODIFICACIÓN". Esta es la firma de autorización de modificación por parte del Supervisor. El resultado esperado será (por ejemplo): Carlos Cornejo MODIFICACIÓN.
La firma debe estar en color rojo.

7. Para el supervisor, en el sidebar, la opción de `Trabajo Realizado` ahora verá:
    - Vales de arte que autorizó (creación o modificación)
    - Vales de arte confirmados de recibido por los asesores
Esta será la jerarquía de agrupación, el ordenamiento será por fecha que se realizó la autorización o la confirmación

8. Implementar el sidebar para los encargados de taller, y en la opción de `Trabajo realizado` verán los vales aprobados por ellos. Recuerda mantener la jerarquía y ordenamiento de estos vales.

9. Para los encargados, la vista de `carga de trabajo` no se ordena por fecha de entrega más próxima. Que se ordene de esa manera. 

10. Vamos a corregir las notifaciones, te detallaré qué notificaciones mostrar para los actores:
    - Asesor
        * cuando el asesor crea un vale y se esper la aut. del supervisor
        * cuando se autoriza un vale (envío a talleres o modificación)
        * cuando un vale entra a su buzón para que confirme de recibido
        * cuando algún vale se llegue a atrasar (digamos, que cuando un vale de la vista empieza su conteo de condición de atraso, que le notifique) (ALERTA EN ROJO)
    - Supervisor
        * cuando un vale entra en solicitación de autorización de creación
        * cuando un vale entra en solicitación de autorización de modificación
        * cuando se autoriza una creación
        * cuando se autoriza una modificación
        * cuando un asesor marca un vale como recibido
        * cuando algún vale se llegue a atrasar (digamos, que cuando un vale de la vista empieza su conteo de condición de atraso, que le notifique) (ALERTA EN ROJO)
    - Encargados de talleres
        * cuando entra un vale a su buzón
        * cuando se asigna un vale
        * cuado un técnico comienza a trabajar un vale
        * cuando realiza una aprobación de un vale de arte
        * cuando algún vale se llegue a atrasar (digamos, que cuando un vale de la vista empieza su conteo de condición de atraso, que le notifique) (ALERTA EN ROJO)
    - Técnicos
        * cuando se le asigna un vale
        * cuando envíe una propuesta al vale de arte (si es vació que la alerta sea roja)
        * cuando algún vale se llegue a atrasar (digamos, que cuando un vale de la vista empieza su conteo de condición de atraso, que le notifique) (ALERTA EN ROJO)
    - Encargado general y su asistente: 
        * cuando un vale es aprobado por todos los talleres y entra a su buzón
        * cuando entra un vale modificacion (esperando reenvío)
        * cuando haya hecho un reenvío a los talleres (una notificación diferente para cada taller, solo emite un solo sonido)
        * cuando algún vale se llegue a atrasar (digamos, que cuando un vale de la vista empieza su conteo de condición de atraso, que le notifique) (ALERTA EN ROJO)
Para todas las notificaciones, ser lo más simple y breve posible. Por ejemplo: {dd/mm/aaaa hh:mm} – Vale: {correlativo} fue {qué pasó} por {actor} [a {actor}]
La parte de corchetes es opcional, para las notificaciones que lo requieran

11. Te explico, actualmente los asesores tienen un límite diario que es arbitrario. Acabo de preguntar a mi jefe, y esta regla cambia. Cómo funciona el límite de vales de arte en realidad es colectivo. Lo que quiere decir, que si un supervisor tiene a su cargo 6 asesores y cada asesor puede subir 1 vale de arte por día, el supervisor puede autorizar 6 vales de arte diarios. De lo contario, que no le permita autorizar, si no es hasta el día siguiente que se resetea este conteo diario.
Entonces, vamos a quitar el contador de vales restantes para los asesores, y se lo colocaremos al supervisor. Él tendrá ese contador el cuál contará de manera ascendente de la siguiente forma: vales_autorizados_crear/asesores.

## DOCUMENTACIÓN

Recuerda documentar estos cambios en la carpeta: `..\documentación` con la nomenclatura adecuada