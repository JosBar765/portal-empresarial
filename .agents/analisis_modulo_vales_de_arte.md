Necesito que me crees un archivo vales\_arte\_context.md que contenga las instrucciones del módulo lo qué debería hacer las distintas vistas. Este archivo .md debe estar optimizado para crear el módulo usando Gemini.



REGLAS PARA LA IA

* Indicarle a Antigravity que debe usar la estructura propuesta en .agents/arquitectura\_reglas.md.
* Tomar en cuenta los puntos del 1 al 5 detallados en el README.md de la carpeta raíz para la creación de módulos y mantener la estructura.
* Mantener un estilo de diseño similar a lo que se tiene en el login y el dashboard. Lo importante, es mantener un mismo estilo de diseño, misma colorimetría, tipos de letras, clases, etc.



A continuación, te explico lo recopilado con forme a los ACTORES para que entiendas cómo y quienes interactuarán con el módulo.



\---



ASESOR DE VENTAS



el asesor de ventas dispondrá de un formulario para crear vales de arte. consta de los siguientes campos divididos en grupos:

* Información del asesor de ventas

  * Nombre del asesor
  * Correo del asesor
  * Telefono del asesor
* Información del cliente

  * Empresa
  * Teléfono
  * Correo
  * Nombre del cliente
* Información de venta

  * Fecha de creación del vale
  * Hora de creación del vale
  * Fecha de entrega del vale
  * Fecha del evento
  * Urgente (sí o no)
  * Código de producto
  * Material
  * Técnica
  * Acabado
  * Cantidad
  * Cotización
* Boceto y Descripción

  * Descripción
  * Adjuntar imágenes
  * Adjuntas documentos



El asesor estará limitado a una cantidad de vales diarios, esta cantidad será arbitraria y se obtendrá de la base de datos.



El formulario de asesor de ventas siga las siguientes reglas:

* La información del asesor se obtiene de sus credenciales de inicio de sesión
* La información del cliente sí es ingresada por el asesor
* Para la información de la venta, lo campos: fecha de creación de vale y hora de creación de vale, son determinados por el sistema. El asesor no puede cambiar estos campos
* Las fechas tienen que seguir la siguiente relación: evento > entrega >= creación
* El campo de Urgente es un checkbox
* Los campos relacionados con el producto, técnica y acabao son combobox obtenidos de la base de datos
* La cantidad es a disposición. Debe ser mayor a 1
* Cotización es un número. De momento, no corroborar si existe la cotización o no
* El formulario debe ser capaz de generar un correlativo que sigue la siguiente estructura de codigos: LOCALIDAD-ASESOR-CONTEO\_INDIVIDUAL\_ASESOR
* La descripción sería una area text
* Las imágenes que se pueden adjuntar deben ser formatos: webp, jgp, png, jpeg, etc. Formato de imagen
* Los documentos a adjuntar deben ser pdf menores a 5 MB
* Se debe indicar un nombre para el documento, este será arbitrario y menor a 50 caractéres



Posterior a llenar el formulario, el sistema debe ser capaz de ordenar todo en un formato visualmente apto y generar un pdf. El pdf generado debe seguir la siguiente estructura:

* Debe ser tamaño carta
* Los márgenes de 1cm por cada lado
* El pdf tendrá dos secciones:

  * en los primeros 2/5 del tamaño de la hoja debe contener:

    * un encabezado que indique que es un vale de arte, correlativo y un logo. Todo esto dentro de la misma fila dándole como tamaño al logo 1/5 de la fila. El título de vale de arte y correlativo ocuparán 2/5 cada uno
    * La información del asesor de ventas
    * información de la información del cliente
    * la información de venta
  * en los otros 3/5 restantes de la hoja:

    * colocar lo que se puso en descripción
    * adjuntas las imágenes acomodadas una al lado de la otra, máximo 3 imágenes por fila
* en caso de ser muchas imágenes, o una descripción más larga, agregar más páginas que sigan el mismo formato

  * de haber más páginas, indicar en la parte inferior el número de página de la siguiente manera: actual/total



El pdf generado se guardará el SUPABASE. Y se ligará a la orden del vale de arte. Dichas ordenes de arte, irán al buzón de diseño. Dicho buzón debe ser hecho con una conexión websocket (esto está explicado en arquitectura\_reglas.md y README.md), más detalle sobre esto en ACTOR SUPERVISOR DISEÑO



Qué podrá ver el asesor:

* El asesor podrá ver solamente sus vales de arte
* El asesor podrá ver en un mini dashboard sobre la vista de vales de arte (todo esto en un mismo contenedor horizontal)

  * En el dashboard, podrá ver los vales de arte restantes que puede subir durante el día: Vales restantes
  * podrá ver la cantidad de propuestas recibidas que no ha revisado: Vales por revisar. Este número será acumulado y se irá descontando conforme vaya revisando las propuestas de los vales
  * vales aprobados durante el día: Vales aprobados. Este contador se reinicia al día siguiente
  * vales cancelados durante el día: vales desaprobados. Este contador se reinicia al día siguiente
  * vales pendientes de modificación: Vales pendientes de modificación. Este contador será acumulado y se irá descontando conforme llegue una propuesta para un vale donde se indicó modificación.

    * Cuando llegue la propuesta, se descuenta el contador de pendientes de modificación y aumentará el de vales por revisar
  * vales atrasados: Vales atrasados. Este contador aumentará conforme los vales se vayan atrasando y disminuirá hasta que se cierre el caso de ese vale (aprobado o desaprobado. Si se solicita una modificación, no cambia el estado del vale, este seguirá estando atrasado
* Los vales de arte se ordenan con respecto al tiempo restante para que llegue la fecha de entrega
* Si algún vale de arte no recibe propuesta de diseño antes de la fecha de entrega, este se marcará como atrasado
* La vista de los vales debe ser como un buzón donde se dividirá por secciones:

  * hasta arriba mostrará los vales los cuales ya han recibido una propuesta y están pendientes de aprobación o desaprobación (si es que los hay)
  * luego se muestran los vales atrasados (si es que los hay) y estos deben mostrar la cantidad de días que llevan atrasados
  * luego se muestran los vales que han sido marcados como urgentes
  * luego se muestran los más próximos a vencer
  * luego los desaprobado
  * luego los aprobados
* Se como sea el estado del vale, si está atrasado, se debe mostrar la cantidad de días que se atrasó
* La vista puede configurarse para que se realiza en una ventana de tiempo diaria, semanal o mensual.
* Dicho día, semana o mes de la vista del buzón de vales de arte puede ser determinado por el asesor. Se permiten fechas pasadas, no futuras.
* La vista de los datos del dashboard irá cambiando conforme a la ventana de tiempo determinada por el asesor
* Por cada orden de vale de arte, el asesor podrá ejecutar acciones con botones (todos los botones deben ser iconos, optimizan espacio):

  * el botón de ver vale de arte, verá el pdf que generó en una ventana aparte
  * el botón para ver los documento adjuntos, abrirá un desplegable

    * cada item de este desplegable tendrá un hipervínculo que abrirá el documento en una ventana por aparte
  * el botón de ver propuesta

    * este botón se activa hasta que el asesor recibe una propuesta por el departamento de diseño. El cómo se genera esta propuesta no le compete al asesor

      * cuando llegue la propuesta, no solo habilita el botón de propuesta, también emite un sonido de notificación
    * si la propuesta no ha sido enviada, este botón permanece visible, sin embargo, debe estar inhabilitado. La desactivación de este botón también tiene que ser validad con el backend, no solo por el frontend
  * el botón de aprobación. Se considera un vale aprobado cuando se le muestra la propuesta al cliente y a él le gusta y se genera la venta. Esto está fuera del alcance del sistema, solo que muestre una notificación de confirmación. Que agregue un chequesito al principio del correlativo del vale de arte
  * el botón de desaprobación. Se considera un vale desaprobado cuando se le muestra la propuesta al cliente y a él no le gusta, para este punto, se pueden tomar dos caminos los cuáles son los siguientes:

    * solicitar una modificación, de momento, no implementar función con esto. Solo mostrar notificación de solicitud de modificación y cambiar a modificación
    * cancelar el vale de arte, esto no borra el vale de arte del sistema, solo cierra el caso. De momento, que solo muestre notificación y un símbolo de equis al principio del correlativo del vale de arte
* La vista debe mostrar la columna de: correlativo, fecha ingreso, fecha egreso, atraso, fecha evento, estado y la columna de acciones



\---



ENCARGADO DE DISEÑO y ENCARGADO DE DISEÑO UV/3D



Ambos encargados (diseño y diseño uv/3d) verán un buzón compartido de vales de arte.



Qué podrá ver el encargado:

* Los encargados podrán ver el buzón compartido de los vales de arte generados por los asesores
* Los encargados por individual podrán ver en un mini dashboard con métricas sobre los vales de arte (todo esto en un mismo contenedor horizontal de dos filas). Las métricas son individuales por encargado, quiere decir, el encargado de diseño no podrá ver la cantidad de vales asignados durante la ventana de tiempo del encargado de diseño uv/3. Y viceversa.
* El dashboard contendrá lo siguiente:

  * cantidad de vales pendientes de asignación, este es el número total de vales en el buzón que no están atrasados y no han sido asignados a ningún técnico. En caso un vale se atrase, este contador disminuye.
  * cantidad de vales pendientes de asignación atrasados, este es el número total de vales en el buzón que están atrasados y no han sido asignados a ningún técnico. Cuando se apruebe un vale atrasado, este contador disminuye. Y aumenta cuando un vale se atrasa.
  * cantidad de vales en asignación, esta métrica deberá estar dividida en dos:

    * cantidad de vales atrasados en asignación, vales atrasados asignados a los técnicos.

      * Este contador aumentará cuando:

        * se asigne un vale ya atrasado a un técnico
        * un vale ya asignado a un técnico cumplió la fecha de entrega y se atrasó
      * Disminuirá cuando el técnico marque el vale como en proceso
    * cantidad de vales en asignación, vales no atrasados asignados a los técnicos

      * este contador aumentará cuando se asigne un vale sin atraso a un técnico
      * disminuirá cuando:

        * el vale de arte asignado al técnico se atrasa
        * el cuando el técnico marque el vale como en proceso
  * cantidad de vales en proceso, esta métrica deberá estar dividida en dos:

    * cantidad de vales atrasados en proceso, vales atrasados en proceso por los técnicos

      * este contador aumentará cuando:

        * un técnico marque como en proceso un vale que le fue asignado y se atrasó o ya estaba atrasado
        * un técnico ya había marcado un vale como en proceso y se atraso
      * disminuirá cuando el técnico cargue la propuesta y marque como en revisión
    * cantidad de vales en proceso, vales que no están atrasados en proceso por los técnicos

      * este contador aumentará cuando un técnico empiece a trabajar en un vale de arte
      * este contador disminuirá cuando el vale de arte que marcó como en proceso se atrasa
  * cantidad de vales en revisión, esta métrica deberá dividirse en dos

    * vales en revisión atrasados

      * este contador aumentará cuando

        * un técnico adjunte el trabajo realizado de un vale atrasado
        * un técnico adjunte el trabajo realizado de un vale que se le atrasó
      * este contador disminuirá cuando el trabajo sea aprobado/desaprobado por el encargado
    * vales en revisión sin atraso

      * este contador aumentara cuando un tecnico adjunte el trabajo realizado de un vale de arte que no se ha atrasado
      * este contador disminuirá cuando

        * un vale pendiente de revisión de atrasa
        * un vale atrasado está pendiente de revisión
  * cantidad de vales aprobados, esta métrica deberá dividirse en dos

    * cantidad de vales aprobados sin atraso, aumentará cuando un encargado aprueba un trabajo sin condición de atraso
    * cantidad de vales aprobados con atraso, aumentará cuando un encargado aprueba un trabajo con condición de atraso
* el trabajo de un técnico puede ser desaprobado, esto no aumenta ningún contador, pero pasa a estado de En asignación. Puede asignarse al mismo técnico o a un técnico diferente.



La vista del buzón será similar a la del asesor. Mostrará los vales con forme vayan entrando y donde el criterio principal es la hora próxima a atrasarse:

* Hasta arriba mostrará los vales que están pendientes de revisión
* luego se muestran los vales pendientes de asignación atrasados (si es que los hay) que sean urgentes
* luego se muestran los vales pendientes de asignación sin atraso  que sean urgentes
* luego se muestran los vales pendientes de asignación atrasados
* luego se muestra los vales pendientes de asignación sin atraso
* luego se muestran los vales aprobados

Los vales asignados y en proceso no son visibles en el buzón. Esto es porque, al final y fuera del buzón hay que colocar un botón que se llame carga de trabajo.

Para la vista del buzón se debe mostrar: correlativo, fecha ingreso, fecha egreso, atraso, fecha evento, estado (en revisión/sin asignar/aprobado) y la columna de acciones (se hablará de esto en: Qué puede hacer el encargado)

Esta vista del buzón, también tendrá la ventana de tiempo que se explico con el asesor, que podrá ver por día, semana y mes. Recordar, que esta ventana afecta a las métricas del dashboard



Qué es un VALE PENDIENTE DE REVISIÓN: Los encargados, tanto el de diseño como el de diseño uv/3d, pueden hacerse cargo de un vale, para hacerse cargo de un vale tienen que asignárselo a un técnico para que lo trabaje.



Qué puede hacer el encargado: ellos en el buzón verán las siguientes acciones sobre los vales, las cuáles serán implementadas con botones:

* Asignar vale, este botón mostrará un desplegable de los técnicos que tenga a su cargo el encargado. Asignará un vale a cualquier técnico.
* Reasignar vale, este botón se activará solo cuando un vale de arte ya esté asignado a un técnico y no lo esté trabajando. De lo contrario, permanece visible pero inhabilitado.
* ver vale de arte, este botón abre el vale de arte en otra ventana
* Ver propuesta, este botón se activará solo cuando un vale de arte ya haya sido trabajado por un técnico. De lo contrario, permanece visible pero inhabilidato.

  * este botón mostrará un desplegable con tres acciones

    * ver propuesta, abre la propuesta en otra ventana del navegador
    * Aprobar, un encargado aprobará un vale cuando reciba la propuesta hecha por el técnico. Se considera aprobado cuando la propuesta realizada por el técnico cumple con todo lo especificado, este criterio está fuera del alcance del sistema y le corresponde al encargado.
    * Desaprobar, un encargado desaprobará un vale cuando reciba la propuesta hecha por el técnico y no cumpla los requerimientos del vale, este criterio está fuera del alcance del sistema y le corresponde al encargado.

      * al momento de desaprobar que abra el mismo modal de reasignar vale, ya que, al desaprobar una propuesta el vale tiene que seguir el flujo de reasignación.



La reasignación solo será posible si el técnico al cuál se le asignó el vale no ha comenzado a trabajarlo.



El botón de carga de trabajo funcionará de la siguiente manera:

* mostrará un modal con el título carga de trabajo
* luego irá una gráfica de barras horizontales.

  * Donde el dominio de esta barra será los técnicos a cargo del encargado.
  * El rango, serán las asignaciones realizadas a los técnicos.
  * Esta gráfica solo sirve para comparar la cantidad de trabajo asignado a cada técnico y poder igualar la carga de trabajo
  * debe ser responsiva al modal que desplegará el botón
  * estas barras horizontales deben mostrase en formato de lista, una debajo de otra
  * debajo de cada barra que le corresponde a la cantidad de asignaciones por cada técnico, deberá mostrar la tarea que el técnico tiene en proceso
* tiene que haber un botón para cerrar este modal



\---



ACTOR TÉCNICO DE DISEÑO O DISEÑO UV/3D



Ambos técnicos (diseño y diseño uv/3d) verán un buzón individual que contendrá los vales asignados por sus encargados.



Qué podrá ver el técnico:

* Los técnicos podrán ver su buzón individual de los vales de arte asignados
* Los técnicos por individual podrán ver en un mini dashboard con métricas sobre los vales de arte (todo esto en un mismo contenedor horizontal). Las métricas son individuales por técnico, quiere decir, un técnico de diseño no podrá ver los vales asignados de algún técnico de diseño o de diseño uv/3. Y viceversa.
* el mini dashboard contiene lo siguiente:

  * cantidad de vales asignados, esta métrica se divide en dos:

    * vales asignados atrasados
    * vales asignados sin atraso
    * estas métricas siguen la mismas reglas de aumento y disminución dependiendo de su condición de atraso, que con el encargado.
* luego, encontrará su buzón de vales asignados. Los atrasados van primero, luego los sin atraso
* hasta de último del buzón encontrará vales realizados



El técnico también se le implementa lo de la ventana de tiempo. Mismas condiciones que con el asesor.

Para la vista del buzón se debe mostrar: correlativo, fecha ingreso, fecha egreso, atraso, fecha evento, estado (en revisión/sin asignar/aprobado) y la columna de acciones (se hablará de esto en: Qué puede hacer el técnico)



Qué puede hacer el técnico:

* de sus vales asignados el técnico podrá ver el vale de arte para entender lo que tiene que hacer
* el técnico puede marcar el vale como en proceso

  * cuando el técnico marque un vale en proceso, no podrá marcar otro vale como en proceso si no es hasta que suba una propuesta para esa asignación. El técnico si quisiera cancelar el proceso ya sea porque no se considera capaz o lo que sea, puede no adjuntar una propuesta. En este caso, se necesita un cuadro de confirmación para enviar la propuesta en blanco.
* el técnico podrá adjuntar la propuesta y dará por cerrado el estado en proceso, pasará a en revisión



\---



NOTAS GENERALES



Toda notificación al buzón de los encargados o técnicos, debe hacer un ruido de notificación y mostrar un toast.

Toda respuesta por parte de los encargados para los asesores, debe hacer un ruido de notificación del lado del asesor.

Todo este vergueo de actualización de buzón, hacerlo mediante el websocket definido en la arquitectura y estructura, ya que necesito que cuando vaya llegando se actualize en tiempo real. No quiero que los usuarios deban actualizar.

El flujo de un vale, debe ser el siguiente:

* ingresado - cuando lo crea el asesor
* en espera - cuando entra al buzón y no ha sido asignado
* asignado - cuando es asignado a un técnico
* en proceso - cuando lo comienza a trabajar un técnico
* en revisión - cuando se está esperando por la aprobación del encargado del técnico
* aprobado - aprobado por el encargado, se le devuelve al buzón del asesor

  * desaprobado - el flujo regresa al estado de en espera

El atraso es un condición, no un estado

Importante que los filtros de la ventana de tiempo se apliquen al dashboard, ya que, las métricas especificadas son importantísimas

Los documentos serán almacenados en SUPABASE, ahí se almacenan objetos (png, pdf). Para este caso, se almacenará ahí los vales de arte generados y las propuestas por parte de los talleres de diseño

Los demás datos, se almacenarán en una tabla de datos relacional Postgres (dada por el servicio de supabase también)

Importante seguir la estructura del proyecto y separar correctamente las capas para que no haya problema si se desea cambiar la capa de persitencia

Las keys deben estar en un archivo .env que no tenga acceso algún usuario o algo (creo que está especificado en la arquitectura)






