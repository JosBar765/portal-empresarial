# ARCHIVO DE ARREGLOS No. 5 AL MÓDULO DE: VALES DE ARTE

1. Necesito, que para el `ENCARGADO GENERAL` implementemos el sidebar (el que incluye la pestaña de trabajo realizado) para poder ver el trabajo que él ha aprobado

2. Actualmente, el supervisor no puede ver la propuesta final. Incluyamos eso en las acciones de trabajo realizado.

3. Actualmente, cuando se solicita una modificación, el supervisor no puede ver la razón de la modifciación. Incluyamos la justificación en el mismo modal donde el sueprvisor autoriza la modificación.

4. Actualmente, el asesor en el buzón principal cuando abre un vale modificado lo que visualiza usando la acción de `ver` es el vale original. Para los vales que ya se aprobaron la modificación se debe ver el nuevo vale generado para la modificación

5. Quitemos la función de rechazar. Totalmente quita esto, me acaban de comunicar que esto no debería estar al alcance del sistema. Para fines prácticos, en el mismo modal donde estaba confirmar/rechazar. Que los botones sean confirmar/solicitar modificacion. Y que siga el proceso de solicitar modificación. Que esto no afecte el flujo original del vale de arte más que el flujo de rechazo. Esto creo que implica quitar el estado de `EN CORRECCIÓN`.

6. Actualmente, cuando se solicita una modificación y esta es aceptada por el supervisor, el vale de arte se retorna al encargado general. Eso es válido, pero, el encargado general debe ser capaz de reenviar al taller individual que indique la justificación de modificación. Por ejemplo:
    - El asesor rechaza el vale de arte
    - El asesor coloca en la justificación que hubo un error de tamaño de correa
    - El encargado general puede reenviar la modificación al taller adecuado
El encargado general debe poder ver la justificación de la modificación para saber a quién reenviar, al igual que el taller al que se lo reenvíe tiene que ver la misma justificación. Para este punto, el vale pasa al flujo de asignación, pero será un vale `MODIFICADO`

7. Actualmente, el supervisor cuando presiona la acción de ver ve el PDF generado de vale de arte. Solo para el supervisor, haremos que la acción "VER" abra un modal con dos opciones: 
    - Ver info: mostrará la información únicamente de los encabezados
    - Ver vae: abrirá el pdf como lo ha estado haciendo
A veces, los supervisores solo necesitan la infomración

8. Para los campos de cualquiera de los vales de arte, los campos: Técnica y Acabado; se permiten estar en blanco

9. El formulario de creación de vales de arte, actualmente lista las imágenes en el input. Pero me gustaría que por cada imágen se pudiera poner una equis, a modo que al presionar la equis se puede sacar esa imágen del input y no se adjunte. Es una forma de quitar imágenes sin tener que volver a abrir el input y seleccionar las imágenes

10. Hay un maldito bug que sucede cuando hago MOUSEUP fuera de un form/modal/pop up lo que sea. Cuando hago MOUSEUP fuera de algún objeto de ese tipo, me lo cierra. Para ponerte de ejemplo, en el formulario de creación de vales de arte. Si hago MOUSEDOWN sobre algún campo (quiero seleccionar texto, digamos) y arrastro hasta el punto que suelto el mouse (MOUSEUP) fuera del form, se cierra el form. Esto solo pasa con el click derecho. Eso me re disgusta.

11. Cuando selecciono una fecha en el selector de fecha de entrega y fecha del evento, se debe cerrar el cosito del calendario. Actualmente no lo hace y tengo que presionar en algún lado dentro del formulario

12. No sé como está funcionando el buscado de los buzones de vale de arte, pero estoy casi seguro que lo único que hacen es filtrar. Necesito que ese buscador también busque en la base de datos. Mantén el mismo funcionamiento, que busca conforme voy ingresando texto. Que esto también incluya la paginación de 50 vales de arte y aumente 50 con el scroll