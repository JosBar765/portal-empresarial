# REGLAS PARA LA IA

* Indicarle a Antigravity que debe usar la estructura propuesta en .agents/arquitectura\_reglas.md.
* Tomar en cuenta los puntos del 1 al 5 detallados en el README.md de la carpeta raíz para la creación de módulos y mantener la estructura.
* Mantener un estilo de diseño similar a lo que se tiene en el login y el dashboard. Lo importante, es mantener un mismo estilo de diseño, misma colorimetría, tipos de letras, clases, etc.

\---

A continuación, detallaré actor por actor sus necesidades y las vistas que deberían tener. El proósito de esto, es representar de manera textual las vistas que debería tener el módulo. 

Las vistas deben ser individuales, quiere decir, dependiendo del rol del usuario accederá a una vista u a otra.

Si no se incluye alguna vista, procedimiento, actor, es porque está fuera del alcance del módulo.

\---

# FLUJO DE LOS VALES DE ARTE
El proceso de un vale de arte es el siguiente:
1. Un vale es creado por el asesor
2. Un vale está en el buzón de los encargados de diseño y diseño uv/3d pero no ha sido asignado a un técnico -> `CREADO`
3. Un encargado asigna un vale a un técnico bajo su mando -> `ASIGNADO`
4. Un técnico se pone a trabajar el vale de arte -> EN PROCESO
5. El técnico trabaja el vale de arte, lo realiza y se lo manda al encargado -> `EN REVISION`
6. El encargado revisa el trabajo del tecnico y aprueba el vale de arte si esta bien echo -> `APROBADO`
  6.1 En caso el encargado estima que el trabajo se hizo mal, lo reasigna. El flujo regresa al punto 3
7. El vale de arte regresa al asesor para que se lo muestre al cliente y puede confirmar la venta o cancelarla
  7.1 El asesor puede solicitar una modificación (aprobada por el supervisor), para esto, el vale de arte regresa al flujo en el punto 2
8. El asesor realiza la venta del vale de arte -> `VENDIDO`
  8.1 El asesor cancela el vale de arte. El cliente no compró nada. -> `CANCELADO`

**Cabe mencionar** Que un vale de arte puede modificarse, siempre y cuando un técnico no lo ha marcado como `En Proceso`. 
El flujo sería el siguiente:
1. Para este punto el vale está en -> `APROBADO`
2. El asesor solicita la modificación -> `CONFIRMACIÓN MODIFICACIÓN`
  - La modificación agrega como prefijo la palabra MOD al correlativo
  - El asesor debe justificar la modificación sobre el vale de arte
  - El formulario de modificación será el mismo vale de arte donde lo único que se podrá modificar es la descripción, las imágenes y los documentos adjuntos
3. El supervisor autoriza la modificación -> `MODIFICADO`
  - El sistema envía de nuevo el vale modificado al buzón de los encargados
  - El vale de arte con este nuevo estado (`MODIFICADO`) entra en el flujo principal punto número 3

\---

# ASESOR DE VENTAS

### ¿De qué se encarga el asesor de ventas?

El asesor de ventas es un empleado el cuál llena un formulario físico llamado `vale de arte`. Este vale de arte es de utilidad para el departamente de diseño, ya que, en base a ese vale de arte ellos generan el diseño. El vale de arte es retornado al asesor, y el asesor se encarga de mostrarselo al cliente y corroborar que fue lo que exactamente pidió. En caso de serlo, se genera una venta. Caso contrario, se desecha o se solicita una modificación (el asesor solicita la modificación, y la autoriza el supervisor) al departamento de diseño (esto reinicia el proceso). La cantidad de vales al día para un asesor está limitada, en caso se alcanzó el límite diario, el vale sale con la fecha del día siguiente. La modificación agrega el prefijo MOD al principio del todo del correlativo.

### Estructura del formulario de `vale de arte`

#### Campos

* Información del asesor de ventas
  * Nombre completo del asesor
  * Correo del asesor
  * Telefono del asesor

* Información del cliente
  * Nombre de la empresa
  * Teléfono
  * Correo
  * Nombre del cliente

* Información de venta
  * Fecha y hora de creación del vale
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

#### Reglas de los campos

* La información del asesor de ventas, será obtenida de su información de usuario. Quiere decir, el asesor no digita su información personal
* Información del cliente, esta información será digitada por el asesor de ventas. Validar formatos para el teléfono (para todos los países) y el correo electrónico
* Información de venta
  * La fecha y hora de creación del vale es obtenida por el sistema, no se puede modificar
  * El campo de urgente es un checkbox
  * Los siguientes campos son combobox que vendrán de la base de datos: código de producto, material, técnica y acabado
  * Los demás campos sí son digitados por el usuario
* Boceto y Descripción
  * La descripción será un text area de máximo unos 600 carácteres
  * Las imagenes a adjuntar deben ser en formatos válidos: jpg, jpeg, png, webp, etc. Además, que no deben pesar más de 2MB cada imágen
  * Los documentos a adjuntar deben ser en formato pdf

#### ¿Cómo funcionará la generación de pdf?

El formulario anterior, debe contener un botón que diga: `crear vale de arte`. Al presionar ese botón, el sistema debe ser capaz de crear un documento PDF a partir de esa información. Dicho PDF deberá ser almacenado en el sistema de almacenamiento de objetos determinado por el sistema. La url generada por el sistema de almacenamiento, debe almacenarse en la tabla donde se guarden los `vales de arte`. La base de datos no almacena PDFs.
Los PDF adjuntos al vale de arte, deben adjuntarse al final del pdf generado. Y las imágenes deben colocarse como se especifíca en `Boceto y Descripcion` de `#### Estrcutura del PDF`.

#### Estructura del PDF

El PDF tendrá la siguiente estructura:

- Encabezado: 
_______________________________________________________________________________________
|                    |                                                   |             |
| VALE DE ARTE (3/6) | CORRELATIVO: TIENDA-ASESOR-CONTADOR\_ASESOR (2/6) | LOGO (1/6)  |
|____________________|___________________________________________________|_____________|

- Información de asesor de ventas:

_______________________________________________________________________________________
|   INFORMACIÓN DE ASESOR DE VENTAS                                                    |
|_______________________________________________________________________  _____________|
|                                                                                      |
| NOMBRE (3/6)                              | CORREO (3/6)                             |
|______________________________________________________________________________________|
|                                                                                      |
| Teléfono (3/6)                            |                                          |
|______________________________________________________________________________________|

- Información de cliente

_______________________________________________________________________________________
|   INFORMACIÓN DE CLIENTE                                                             |
|_______________________________________________________________________  _____________|
|                                                                                      |
| EMPRESA (3/6)                             | CLIENTE (3/6)                            |
|______________________________________________________________________________________|
|                                                                                      |
| TELEFONO (3/6)                            | CORREO (3/6)                             |
|______________________________________________________________________________________|

- Información de venta

________________________________________________________________________________________
|   INFORMACIÓN DE VENTA                                                                |
|_______________________________________________________________________________________|
|                                                                                       |
| FCHA Y HORA DE INGRESO (3/8) | FCHA ENTREGA (2/8) | FCHA EVENTO (2/8) | URGENTE (1/8) |
|_______________________________________________________________________________________|
|                                                                                       |
| Cod. PROD (2/8)    | MATERIAL (2/8)       | TÉCNICA (2/8)       | ACABADO (1/8)       |
|_______________________________________________________________________________________|
|                                                                                       |
| Cantidad (2/8)     | COTIZACIÓN (2/8)     |                     |                     |
|_______________________________________________________________________________________|

- Boceto y Descripción: Acá no puedo darte una estructura física, ya que, esta parte ocupará (3/5) de la hoja y se debe acomodar todo lo que se ponga en la descripción (texto) al igual que las imágenes (máximo 3 por fila horizontal). Si es necesario, que se agregue una hoja en blanco para terminar de acomodar la información en caso no cupiera. Los PDF adjuntos se agregan al final y debe indicar con algún texto al final del todo de este proceso de boce y descripción que diga: hay documentos adjuntos.

#### Reglas del PDF
- Entre paréntesis puse el tamaño esperado de cada campo a lo ancho de hoja (verticalmente)
- Si hay más de 1 página, indicarlo al pié de página en el siguiente formato: actual/total
- el tamaño de la hoja es carta
- En caso de generarse un vale de arte a partir de una modificación el sistema colocará en negrita y con asteriscos tanto al principio de la nueva descripción o imágenes el texto: ```********** MODIFICACION **********``` como al final del mismo. Ejemplo de `Boceto y Descripción` de un vale modificado:
  ```text
  ********** MODIFICACION **********
  (Información igresada en el formulario de modificación)
  ********** MODIFICACION **********
  (Información ingresasa en el formulario de creación)
  ```
  Recordar: esto también sigue las reglas de GENERACIÓN DE PDF.
- Todo documento adjunto a partir de una modificación se debe indicar con el mismo texto de asteriscos
- El PDF debe estar bien optimizado para no consumir mucho espacio
- Las imagenes y documentos adjuntos NO se almacenan en ningún lado, se agregan tal y como se específico en la generación del PDF

### Reglas para el formulario

- El PDF generado no puede descargarlo el asesor, solo visualizarlo
- Entre paréntesis puse el tamaño esperado de cada campo a lo ancho de hoja (verticalmente)
- Toda la información (del asesor, cliente y de venta) deberá caber en los primeros 2/5 de la hoja
- El campo urgente es un checkbox
- La fechas tienen una restricción: evento > entrega >= creación
- La cantidad de vales determinada para los asesores es dada por la base de datos
- El correlativo es generado con datos de la DB
- Los documentos a adjuntar deben ser menores a 3 MB
- Al adjuntar un documento, se le debe asignar un nombre al documento para su almacenamiento en la base de datos
- Todos los campos exepto los de Boceto y Descrición estarán inhabilitados en el formulario de modificación. El mismo formulario de creación es el de modificación.

### Vista del Asesor

El asesor tendra una vista con lo siguiente:

- Encabezado:
_________________________________________________________________________________________________
|                          |                                                  |  BOTON DE        |
| NOMBRE DEL ASESOR (2/10) |              VACÍO (6/10)                        |  AGREGAR  (2/10) |
|__________________________|__________________________________________________|__VALE____________|

- Mini dashboard (contadores): De manera horizontal (a lo ancho de la ventana) mostrar los siguientes contadores:
  - Vales de arte restantes: este contador mostará el número de vales restantes que puede subir el día actual. No lo afecta la ventana de tiempo.
  - Vales por revisar: este contador mostrará el número de vales los cuales les ha llegado una propuesta (respuesta por parte del departamento de diseño) y NO se ha revisado. Una vez revisado alguno de estos vales, se descuenta del conteo.
  - Vales aprobados: este contador muestra la cantidad de vales que se han aprobado durante el día, quiere decir, los que si generaron una venta. Este contador se resetea a cero al día siguiente.
  - Vales cancelados: muesta la cantidad de vales cancelados durante el día, ya sea que el cliente haya cancelado el proceso o el asesor lo cancele arbitrariamente. Este contador se resetea a cero al día siguiente.
  - Vales pendientes de modificación: muestra la cantidad de vales pendientes de recibir una propuesta cuando se solicita una modificación. cuando se recibe la propuesta este disminuye. Este proceso sucede cuado el asesor cancela el vale, pero solicita una modificación (pedida por el cliente), entonces, al vale se le agrega un día más a la fecha de entrega y se envía de nuevo al departamente de diseño. 
  - Vales atrasados: muestra el conteo de TODOS los vales con condición de atraso. Un vale se atrasa pasada la fecha y hora de entrega. A partir de ahí, vamos con atraso. Este contador solo disminuye si se apruba/cancela un vale de arte.
También agregar el campo de la ventana de tiempo en algún lado que no estorbe con el espaciado de los contadores.

- Lista vales de arte: esta será una tabla con las siguientes columnas:
  - Correlativo
  - Fecha y hora de ingreso
  - Fecha de entrega
  - Atraso (cantidad de días)
  - Fecha de evento
  - Estado
  - Acciones

#### Reglas de la lista de vales de arte

- El ordenamiento de los vales será el siguiente:
  - Hasta arriba los que ya tienen propuesta
  - Vales sin propuesta marcados como urgentes
  - Vales cancelados
  - Vales probados
  - Para cada nivel de la jerarquí, apareceran primero los que estén en condición de atraso. Quiere decir, cuando ya se haya sobrepasado la fecha de entrega.
- El criterio principal de ordenamiento es lo cerca que están a la fecha de entrega. Quiere decir, si un vale se entrega del día de hoy, aparecerá primero. Pero, siguiendo la jerarquía expuesta anteriormente

### Acciones

Las acciones deben implementarse mediante botones. Específicamente, íconos:
  - Ver: abrirá el vale de darte en una ventana a parte (pdf generado)
  - Propuesta: este botón se activará cuando se reciba una propuesta. A su vez, en el mismo modal para ver la propuesta, tendrá un botón extra:
    - Confirmar: este botón quiere decir que se generó la venta
  - Cancelar: este botón cancela el vale de arte. Abrirá una modal con dos botones:
    - Cancenlar: cancelará y marcará como cancelado el vale de arte
    - Modificar: solicatará una modificación al encargado (solo puede usarse una vez sobre el mismo vale, por reglas de gerencia)

### Reglas de la vista

- El atraso se calcula en días
- Si algún vale de arte no recibe propuesta de diseño y no se cierra (confirmado/cancelado) antes de la fecha de entrega, este se marcará como atrasado
- El atraso es una condición, no un estado
- Sea cual sea el estado del vale, si está atrasado, se debe mostrar la cantidad de días que se atrasó
- Se puede configurar una ventana diaria, semanal o mensual para la lista de vales de arte. Esta afectará los vales de arte que se pueden visualizar. No afecta el orden de aparición antes establecido.
  - Dicho día, semana o mes de la vista del buzón de vales de arte puede ser determinado por el asesor. Se permiten fechas pasadas, no futuras.
  - Esta ventana de tiempo también afectará a algunos de los contadores del mini dashboard
- Por cada vale generado la vista debe actualizarse en tiempo real y mostrar un toas con el correlativo del vale
- Cuando un vale sea aprobado o cancelado, siempre debe mostrar cuanto tiempo se atrasó
- Se le puede aplicar filtros a la tabla en base a las columnas, también se pueden quitar los filtros y siguen el orden establecido

\---

# SUPERVISOR DE VENTAS

### ¿De qué se encarga el supervisor de ventas?

El Supervisor de ventas normalmente es el que solicita modificaciones y llega un registro de los vales, no realiza mayor acción, más que todo control.

### Vista de los supervisores de ventas

La vista tendrá lo siguiente:

- Encabezado:
_____________________________________________________________________________________________________
|                              |                                                                     |
| NOMBRE DEL SUPERVISOR (2/10) |              VACÍO (8/10)                                           |
|______________________________|_____________________________________________________________________|

- Un dashboard: Usará la mitad de la pantalla con las métricas de
  - Vales de arte restantes por asesor: mostrará la cantidad de vales de arte restantes que puede subir un asesor durante ese día
  - Vales de arte enviados: mostrará los vales de arte enviados por cada encargado
  - Vales por confirmar modificación: este contador mostrará el número de vales los cuales están pendientes de modificación. Una vez aprobada la modificación de alguno de estos vales, se descuenta del conteo.
  - Vales confirmados: este contador muestra la cantidad de vales que se han vendido durante el día. Este contador se resetea a cero al día siguiente.
  - Vales cancelados: muesta la cantidad de vales cancelados durante el día, ya sea que el cliente haya cancelado el proceso o el asesor lo cancele arbitrariamente. Este contador se resetea a cero al día siguiente.
También agregar el campo de la ventana de tiempo en algún lado que no estorbe con el espaciado de los contadores.

- La otra mitad, será el Buzón: esta será una tabla con las siguientes columnas:
  - Correlativo
  - Fecha y hora de ingreso
  - Fecha de entrega
  - Atraso (cantidad de días)
  - Fecha de evento
  - Estado
  - Acciones

#### Reglas del Buzón

- El ordenamiento de los vales será el siguiente:
  - Vales en confirmación de modificación
  - Vales cancelados
  - Vales confirmados
  - Para cada nivel de la jerarquía, apareceran primero los que estén en condición de atraso. Quiere decir, cuando ya se haya sobrepasado la fecha de entrega.
  - Luego aparecerán los urgentes
- El criterio principal de ordenamiento es lo cerca que están a la fecha de entrega. Quiere decir, si un vale se entrega del día de hoy, aparecerá primero. Pero, siguiendo la jerarquía expuesta anteriormente

### Acciones

Las acciones deben implementarse mediante botones. Específicamente, íconos:
  - Ver: abrirá el vale de darte en una ventana a parte (pdf generado)
  - Propuesta: este botón se activará cuando se reciba una propuesta. A su vez, en el mismo modal para ver la propuesta, tendrá un botón extra:
    - Confirmar: este botón quiere decir que se generó la venta
  - Modificar: este botón abre un modal con dos botones:
    - Cancenlar: cancelará y marcará como cancelado el vale de arte
    - Modificar: solicatará una modificación al encargado (solo puede usarse una vez sobre el mismo vale, por reglas de gerencia). Cambia el estao del vale a `Modificado`

### Reglas de la vista

- El atraso se calcula en días
- Si algún vale de arte no recibe propuesta de diseño y no se cierra (confirmado/cancelado) antes de la fecha de entrega, este se marcará como atrasado
- El atraso es una condición, no un estado
- Sea cual sea el estado del vale, si está atrasado, se debe mostrar la cantidad de días que se atrasó
- Se puede configurar una ventana diaria, semanal o mensual para la lista de vales de arte. Esta afectará los vales de arte que se pueden visualizar. No afecta el orden de aparición antes establecido.
  - Dicho día, semana o mes de la vista del buzón de vales de arte puede ser determinado por el asesor. Se permiten fechas pasadas, no futuras.
  - Esta ventana de tiempo también afectará a algunos de los contadores del mini dashboard
- Por cada vale generado la vista debe actualizarse en tiempo real y mostrar un toas con el correlativo del vale
- Cuando un vale sea aprobado o cancelado, siempre debe mostrar cuanto tiempo se atrasó
- Se le puede aplicar filtros a la tabla en base a las columnas, también se pueden quitar los filtros y siguen el orden establecido

\---

# ENCARGADO DE DISEÑO y ENCARGADO DE DISEÑO UV/3D

### ¿De qué se encarga los encargados?

El encargado de diseño y diseño uv/3d son los en

Ambos encargados (diseño y diseño uv/3d) verán un buzón compartido de vales de arte. A manera de contexto, el encargado de diseño y diseño uv/3d son encargados de área y delegan el trabajo a los técnicos. Los vales de arte enviados por los asesores, son los que van a delegar el encargado a sus ténicos. 
Para este punto, el vale de arte entra a un estado de: `Creado`. Entonces, los encargados ven el buzón y asignan los vales de arte a los técnicos que tiene a su mando, pasamos a `Asignado`.
El técnico debe realizar su tarea y retornar el vale de arte y pasara a un estado de `en revisión`. Esta propuesta puede ser aprobada o desaprobada, en caso de ser desaprobada el encargado debe reasignar el vale de arte (puede ser al mismo técnico y otro que esté bajo su mando), pasamos al estado `asignado`.

Además de que, un encargado puede subir una correción. Supongamos, el encargado ya aprobó un vale de arte realizado por un técnico pero hubo algún error fácil de modificar por lo que el encargado puede subir una correción. Esta correción debe ser modificada.

### Vista de los Encargados

La vista del encargado tendrá lo siguiente:

- Encabezado:

_____________________________________________________________________________________________________
|                             |                                                                     |
| NOMBRE DEL ENCARGADO (2/10) |              VACÍO (8/10)                                           |
|_____________________________|_____________________________________________________________________|

- Un mini dashboard similar al del asesor, pero de dos filas. Ya que, contendrá las siguientes métricas:
  - Vales pendientes de asignación: este es el número total de vales en el buzón que no están atrasados y no han sido asignados a ningún técnico
  - Vales pendientes de asignación atrasados: este es el número total de vales atrasados en el buzón que no han sido asignados a ningún técnico. En caso, haya un vale pendiente de asignación y este se atrasa, este contador aumenta.
  - Vales asignados: es la cantidad de vales asignados a los técnicos bajo el mando del encargado. Este contador disminuye cuando un técnico cancela el proceso de un vale de arte o termina un vale en proceso.
  - Vales asignados atrasados: es la cantidad de vales ya atrasados asignados a los técnicos bajo el mando del encargado. Este contador disminuye cuando un técnico cancela el proceso de un vale de arte o termina un vale en proceso. Aumenta cuando un vale ya ha sido asignado y entra en condición de atraso.
  - Vales en proceso: cantidad de vales sin atrasado en proceso por algún técnico. Este contador disminuye cuando el técnico envía la propuesta al encargado o cancela el proceso.
  - Vales en proceso atrasados: cantidad de vales atrasados en proceso por algún técnico. Este contador disminuye cuando el técnico envía la propuesta al encargado o cancela el proceso. Aumenta cuando un vale ya asignado en proceso se atrasa.
  - Vales en revisión: cantidad de vales que el encargado tiene pendiente de revisar (cuando el técnico termina el proceso y manda la propuesta).
  - Vales en revisión atrasados: cantidad de vales atrasados que el encargado tiene pendiente de revisar (cuando el técnico termina el proceso y manda la propuesta). Aumenta cuando un vale pendiente de revisión se atrasa.
  - Vales aprobados: es la cantidad de vales sin atraso aprobados por el encargado. Esta métrica es diaria y se reinicia al día siguiente.
  - Vales aprobados atrasados: es la cantidad de vales con atraso aprobados por el encargado. Esta métrica es diaria y se reinicia al día siguiente.
  En algún lado que no estorbe con la vista de los vales, agregar la ventana de tiempo.

- Buzón compartido: esta será una tabla con las siguientes columnas:
  - Correlativo
  - Fecha y hora de ingreso
  - Fecha de entrega
  - Atraso (cantidad de días)
  - Fecha de evento
  - Estado
  - Acciones

- Botón de carga de trabajo: esto será un botón en la esquina inferior derecha que muestra la cantidad de asignaciones por cada técnico y el vale de arte que anda trabajando. De la siguiente manera:

```text
Carga de trabajo

[Técnico A] █████████
Asignaciones: 5
En proceso: Vale GUA-...

[Técnico B] █████
Asignaciones: 3
En proceso: Vale GUA-...

[Técnico C] ███████
Asignaciones: 4
En proceso: Ninguno
```

Adicional, se podrá presionar el nombre de cada técnico y mostrará otro modal donde SOLO se muestren las asignaciones de dicho técnico que se presionó y se marcarán las que están atrasadas. Este modal seguirá el mismo diseño que el buzón de vales de arte (para este modal, solo abrá dos acciones: ver y reasignar).

#### Reglas de la lista del buzón compartido

- El ordenamiento de los vales será el siguiente:
  - Hasta arriba los vales pendientes de revision (los que ya tienen propuesta del técnico)
  - Vales pedientes de asignación
  - Vales aprobados (una vez es enviado en vale al asesor, ahora se convirtió en propuesta)
  - No se verán los vales asignados ni los que estén en proceso
  - Para cada nivel de la jerarquía, aparecerán:
    - primero los que estén en condición de atraso. Quiere decir, cuando ya se haya sobrepasado la fecha de entrega. 
    - después de los atrasados, aparecerán los urgentes.
- El criterio principal de ordenamiento es lo cerca que están a la fecha de entrega. Quiere decir, si un vale se entrega del día de hoy, aparecerá primero. Pero, siguiendo la jerarquía expuesta anteriormente

### Acciones

Las acciones deben implementarse mediante botones. Específicamente, íconos:
  - Ver: abrirá el vale de darte en una ventana a parte (pdf generado)
  - Asignar: este botón permite asignar un vale de arte a algún técnico. Este botón se desactiva cuando se realiza una asignación
  - Revisar: este botón se activará cuando se reciba una propuesta por parte del técnico. Este botón abrirá un modal, el cuál contará con un botón hipervínculo que me permita abrir la propuesta en otra ventana del navegador, abajo de eso dos votones de aprobar y desaprobar:
    - Aprobar: este botón retorna el vale de arte al asesor, pone el vale en su estado final
    - Desaprobar: este botón abre un modal que permite la reasignación del vale de arte (puede reasignarse al mismo técnico u otro).

### Reglas de la vista

- El atraso se calcula en días
- Si se pasa la fecha de entrega del vale de arte, se marca como atrasado. Sin importar su estado
- El atraso es una condición, no un estado
- Sea cual sea el estado del vale, si está atrasado, se debe mostrar la cantidad de días que se atrasó
- Se puede configurar una ventana diaria, semanal o mensual para la lista de vales de arte. Esta afectará los vales de arte que se pueden visualizar. No afecta el orden de aparición antes establecido.
  - Dicho día, semana o mes de la vista del buzón de vales de arte puede ser determinado por el encargado. Se permiten fechas pasadas, no futuras.
  - Esta ventana de tiempo también afectará a algunos de los contadores del mini dashboard
- Por cada vale entrante al buzón la vista debe actualizarse en tiempo real y mostrar un toast con el correlativo del vale
- Cuando un vale sea aprobado, siempre debe mostrar cuanto tiempo se atrasó
- Se le puede aplicar filtros a la tabla en base a las columnas, también se pueden quitar los filtros y siguen el orden establecido
- Esta vista del buzón, también tendrá la ventana de tiempo que se explico con el asesor, que podrá ver por día, semana y mes. Recordar, que esta ventana afecta a algunas de las métricas del dashboard

\---

# TÉCNICO DE DISEÑO O DISEÑO UV/3D

### ¿De qué se encarga los técnicos?

Los técnicos son los encargados de realizar las tareas que se le asignen, una vez realizada la tarea estos retornan el vale de arte (ahora llamado `propuesta`) a su encargado. Este verifica si está bien hecha o no, en caso no estar bien hecha, se le puede reasignar a este mismo técnico la tarea o a alguien más. Los técnicos tendrán cada uno su propio buzón, quiere decir que los técnicos solo podrán ver sus asignaciones (dadas por el encargado) y no las de alguien más. Ellos al ver sus asignaciones, pueden marcar alguna como `en proceso`, para este punto el técnico ya podrá ver el vale de arte (es la guía de lo que tiene que hacer) y realizarlo, una vez terminado adjuntan la propuesta en un documento pdf y se lo dan a su encargado para aprobar o desaprobar.

### Vista de los técnicos

La vista de los técnicos tendrá lo siguiente:

- Encabezado:

_____________________________________________________________________________________________________
|                              |                                                                     |
| NOMBRE DEL TÉCNICO (2/10)    |              VACÍO (8/10)                                           |
|______________________________|_____________________________________________________________________|

- Un mini dashboard similar al del asesor. Ya que, contendrá las siguientes métricas:
  - Vales asignados: este es el número total de vales en el buzón del técnico que no están atrasados y le falta por trabajar
  - Vales asignados atrasados: este es el número total de vales en el buzón del técnico que están atrasados y le falta por trabajar
  - Vales con modificación pendiente: es el número de vales de arte que solicitaron modificación. Estos son fáciles de identificar, ya que, si el asesor solicita una modificación se  agrega el prefijo MOD al correlativo MOD-...
  - Vales con modificación pendiente: es el número de vales con condición de atraso que solicitaron modificación. Estos son fáciles de identificar, ya que, si el asesor solicita una modificación se  agrega el prefijo MOD al correlativo MOD-...
  - Vale en proceso: Mostrará el correlativo del vale en proceso
  - Para cada nivel de la jerarquía, aparecerán:
    - primero los que estén en condición de atraso. Quiere decir, cuando ya se haya sobrepasado la fecha de entrega. 
    - después de los atrasados, aparecerán los urgentes.
En algún lado que no estorbe con la vista de los vales, agregar la ventana de tiempo.

- Buzón: esta será una tabla con las siguientes columnas:
  - Correlativo
  - Fecha y hora de ingreso
  - Fecha de entrega
  - Atraso (cantidad de días)
  - Fecha de evento
  - Estado
  - Acciones

#### Reglas de la lista del buzón

- El ordenamiento de los vales será el siguiente:
  - Hasta arriba los vales asignados (los que ya tienen propuesta del técnico)
  - Luego, vales en revisión (una vez es enviado el vale al encargado, ahora se convirtió en propuesta)
  - Luego los vales aprobados, con un chuequesito al lado del correlativo del vale.
  - Para cada nivel de la jerarquía, aparecerán:
    - primero los que estén en condición de atraso. Quiere decir, cuando ya se haya sobrepasado la fecha de entrega. 
    - después de los atrasados, aparecerán los urgentes.
- El criterio principal de ordenamiento es lo cerca que están a la fecha de entrega. Quiere decir, si un vale se entrega del día de hoy, aparecerá primero. Pero, siguiendo la jerarquía expuesta anteriormente

### Acciones

Las acciones deben implementarse mediante botones. Específicamente, íconos:
  - Ver: abre el vale de arte en una ventana por aparte
  - Comenzar: esto marca el vale de arte como en proceso. Cuando un técnico comienze el proceso de un vale, no podrá inicar otro, entonces, al activar uno, debe desactivar todos los demás botones y activa el botón de Entregar de este vale de arte y Cancelar.
  - Entregar: permite subir la propuesta y enviarla al encargado para su revisión.
  - Cancelar: este botón solo estará activo si se ha iniciado el proceso de algún vale de arte. Al cancelar se le envía al encargado una propuesta en blanco e indicarle que fue una cancelación. Esto puede pasar por si el técnico no sabe como resolver el problema o lo que sea. No se podrá cancelar ningún otro vale de arte sin haberlo marcado como "En Proceso" primero

### Reglas de la vista

- El atraso se calcula en días
- Si se pasa la fecha de entrega del vale de arte, se marca como atrasado. Sin importar su estado
- El atraso es una condición, no un estado
- Sea cual sea el estado del vale, si está atrasado, se debe mostrar la cantidad de días que se atrasó
- Se puede configurar una ventana diaria, semanal o mensual para la lista de vales de arte. Esta afectará los vales de arte que se pueden visualizar. No afecta el orden de aparición antes establecido.
  - Dicho día, semana o mes de la vista del buzón de vales de arte puede ser determinado por el encargado. Se permiten fechas pasadas, no futuras.
  - Esta ventana de tiempo también afectará a algunos de los contadores del mini dashboard
- Por cada vale entrante al buzón la vista debe actualizarse en tiempo real y mostrar un toast con el correlativo del vale
- Cuando un vale sea aprobado, siempre debe mostrar cuanto tiempo se atrasó
- Se le puede aplicar filtros a la tabla en base a las columnas, también se pueden quitar los filtros y siguen el orden establecido
- Esta vista del buzón, también tendrá la ventana de tiempo que se explico con el asesor, que podrá ver por día, semana y mes. Recordar, que esta ventana afecta a algunas de las métricas del dashboard

\---

# NOTAS GENERALES

- Toda notificación a alguno de los buzones de los actores, debe hacer un ruido de notificación y mostrar un toast.
- Todo este vergueo de actualización de buzón, hacerlo mediante el websocket definido en la arquitectura y estructura, ya que necesito que cuando vaya llegando se actualize en tiempo real. No quiero que los usuarios deban actualizar.
- El atraso es un condición, no un estado
- Importante que los filtros de la ventana de tiempo se apliquen al dashboard, ya que, las métricas especificadas son importantísimas
- Los documentos serán almacenados en algún servicio de documentos
- Los demás datos, se almacenarán en una base de datos relacional 
- El límite diario de vales de arte, está determinado por el sistema
- El sistema debe ser capaz de llevar trazabilidad de cada cambio de estado, de preferencia de forma visual, para que gerencia pueda ver cuando un vale de arte cambió de estado y porqué