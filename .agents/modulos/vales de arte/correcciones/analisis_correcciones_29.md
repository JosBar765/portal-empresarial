# Archivo de correccion No. 29

1. Así como en el formulario de creación de vales de arte, quiero que implementes el mismo contador de palabras para el campo de `justificación` al momento de mandar una modificación de vale de arte. Misma cantida de palabras, y mismo funcionamiento de disminución mientras se escribre.

2. Añadir también la función de `rechazar` en el modal de autorización de modificación. Solo que este botón de rechazo no borrará el vale de arte, simplemente lo regresará al estado anterior que se encontraba el vale. No considero necesario algun otro campo en la base de datos para determinar el estado anterior, para eso tenemos la tabla de historial.

3. Actualmente, el proceso de solicitación de modificación para un vale de arte MODIFICADO es posible. La regla de negocio es que un vale de correlativo MOD NO puede someterse a otra modificación. Por lo tanto, si bien la modificación no puede realizarse debido a un problema de llaves duplicadas, el proceso de solicitar autorización sí es posible.   
Haremos algo, para los vales MOD restringe desde el backend que no puedan solicitar una modificación. Y para esos vales MOD, quitaremos la acción de `SOLICITAR MODIFICACIÓN`.

4. Haciendo pruebas, descubrí el error que mencioné en el **punto 3** (error de llaves duplicadas al autorizar la modificación de un vale de arte MOD) y por cada error noté que aumentaba el correlativo del vale de arte. Te explico detalladamente:
    - Solicite la autorización de un vale MOD
    - Intenté autorizar desde una cuenta de supervisor la modificación del vale MOD
    - Presione el botón muchas veces (~25 veces)
    - Cree un nuevo vale desde cero y el correlativo siguió la secuencia de 26  
Necesito que el correlativo **SOLO** aumente cuando se cree un vale de arte exitosamente

5. Para la acción de `ver propuesta` el tooltip creo que dice: "Ver porpuesta de fusión". Cambiemos eso a: "Ver propuesta" Algo más general.