# ARCHIVO DE ARREGLOS No. 2 AL MÓDULO DE: VALES DE ARTE

A continuación, te enlisto unos cambios que necesito que hagas.

1. Pasa que cuando un técnico marca un vale de arte como ´En Proceso´ un vale, suena la notificación del lado del encargado. Cuando el técnico marque un vale como ´En Proceso´, no debería emitir ningún sonido, ni del lado del técnico menos del lado del encargado

2. El correlativo del vale de arte generado a partir de una modificación, no cambia. Lo que debería pasar es:
    - Sin modificación: GUA-001-0008
    - Cuando se apruebe la modificación: MOD-GUA-001-0008
    Actualmente, solo cambia en el registro mas no lo hace en el documento, el pdf generado tiene el mismo correlativo (sin el prefijo MOD)
    Sí indica en el pie de página la palabra: "MODIFICAR". Eso está bien, no lo cambies. Solo corregí lo del correlativo del pdf generado.

3. Actualmente, la página generada de modificación NO debe estar al final de los documentos adjuntos, debe estar ANTES. Digamos, el siguiente orden:
    - PDF generado de arte de vale original
    - Página con la modificación
    - PDFs adjuntos
    Los números de página si se enumeran correctamente siguiendo el formato dado (actual/total). Al igual, que el texto de la modificación SI se encuentra envuelto correctamente en los textos: "\*\*\*\*\*\*MODIFICACION\*\*\*\*\*\*". Todo eso está bien, solo cambia la posición de la página con la modificación.
    Creo que para esto, es necesario volver a guardar las imagenes del vale de arte original, para volverlo a generar cuando se realize una modificacion. Volvamos a ese procedimiento, donde almacenabas las imágenes que se subían para la creación del vale.

4. Actualmente, cuando hay documentos adjuntos, si se marca el checkbox. El problema, no indica el texto de "Adjuntos". Ejemplo:
    - Actualmente: {checkbox}
    - Corrección: ADJUNTOS {checkbox}

5. Actualmente, cuando se genera un documento de correción y este ya posee documentos adjuntos, no marca el checkbox. Podrías poner un campo boolean en la tabla de vale de arte para saber si hay documentos adjuntos o no.

6. El los campos de ´fecha inicio´ y ´fecha fin´ de la ventana de tiempo, funcionan correctamente, pero pasa lo siguiente:
    - Fecha inicio: borrado; Fecha fin: borrado -> Cuando se borren ambas fechas se debe poner en la ventana de tiempo de "Todos" automáticamente. Actualmente, el usuario debe recargar para reiniciar la ventana de tiempo cuando se borran la fecha de inicio y fin, quiero que se ponga en "Todo" al borrar ambas fechas
    - Fecha fin: borrado o sin seleccionar -> Actualmente, la ventan de tiempo cuando se borra la fecha final, no hace nada. Lo que debería hacer, es que cuando se borre la fecha final lo tome como si fuera la fecha de hoy. Quiere decir, si pongo una fecha inicio 15/8 y hoy es 20/8 y borro el campo de fecha final, el intervalo que usará para mostrarme los vales de arte será: 15/8 - 20/8

7. Hay un bug visual, cuando se presiona algún botón de la ventana de tiempo (diario, semanal, mensual) la burbuja se pinta toda del color seleccionado y desaparecen las letras. Quieo que cuando se presione la burbuja, se marque con el color de seleccionado pero que pinte las letras de blanco para que se vea.

8. Actualmente, la tabla rompe el responsive. Valida eso para que sea visible desde celulares, tables u otros dispositivos. Considera disminuir el tamaño individual de los contadores, ya que, eso quita mucho espacio a la hora de visualizar desde un celular

9. Integra paginación mediante scroll, quiero que se carguen 50 vales por petición. ya que, cuando se ponga en producción no quiero una cantidad gigante de vales al momento de hacer la petición y que se me laggee toda la vista. Que la paginación no intervenga en la forma que se ordenan los vales de arte. La ´jerarquía individual´ y ´general´ se debe mantener

10. No estoy seguro, pero verifica que al usar la acción ´Historial´ no solo muestre el rol del actor que hizo la acción, quiero su nombre también. El primer nombre y apellido es suficiente