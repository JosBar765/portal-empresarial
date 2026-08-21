# ARCHIVO DE ARREGLOS No. 3 AL MÓDULO DE: VALES DE ARTE

## NUEVO FLUJO DE LOS VALES DE ARTE

El proceso de un vale de arte es el siguiente:
1. Un vale es creado por el asesor, al momento de crear el vale ellos pueden elegir a qué talleres/departamentos se dirige el vale
2. El vale entra al buzón de los encargadados del taller/departamento, pero no ha sido asignado a un técnico -> `CREADO`
3. El encargado asigna el vale a un técnico del taller bajo su mando -> `ASIGNADO`
4. Un técnico se pone a trabajar el vale de arte -> `EN PROCESO`
5. El técnico trabaja el vale de arte, lo realiza y se lo manda a su encargado -> `EN REVISION`
6. El encargado revisa el trabajo del tecnico y aprueba el vale de arte si esta bien echo -> `APROBADO DEPARTAMENTO` si solo se envía el vale de arte a un solo taller (no debe pasar por el encargado general) se pasa directamente a `PENDIENTE CONFIRMACIÓN`
  6.1 En caso el encargado estima que el trabajo se hizo mal, lo reasigna. El flujo regresa al punto 3 -> En el historial de trazabilidad, se tiene que indicar la desaprobación y la nueva asignación.
  6.1.1 En caso el vale de arte, sea seleccionado para enviar a más de un taller, el vale de arte tiene que pasar por un encargado de todo los departamentos y los departamentos son los que aprueban la tarea que ellos realizan. Ahora, una vez realicen su trabajo, todo el trabajo será juntado en un solo documento por un encargado general. El encargado general junta todo y aprueba -> `PENDIENTE CONFIRMACIÓN`
7. El vale de arte regresa al asesor
8. El asesor confirma de recibido el vale de arte -> `RECIBIDO`
  8.1 El asesor rechaza el vale de arte -> `RECHAZADO`
  8.2 El vale de arte se le retorna al encargado, solicitando una correción -> `EN CORRECIÓN` 
  8.3 El flujo regresa al punto 3

Posteriormente a `CONFIRMADO`, se puede solicitar una `MODIFICACIÓN`. El flujo de modificación es el siguiente:
1. El vale tuvo que haber sido `CONFIRMADO`. Posterior a eso, ya se puede solicitar una modificación.
2. El asesor solicita una modificación -> `SOLICITANDO MODIFICACION`
    - Al solicitar una modificación, el asesor puede cambiar información original del vale de arte. Quiere decir, se abre el mismo formulario de creación con la información original del vale pre-cargada
    - El área de boceto y descripción sí será totalmente nueva. Quiere decir, los campos de "boceto y descripción" si estarán en blanco
    - Siempre se indica en el pié de página la palabra MODIFICAR (tal y como lo hace actualmente)
    - El documento adjunto será automáticamente la propuesta ligada al vale de arte. Las modificaciones se realizan sobre la propuesta.
3. El vale de arte entra al buzón del/los encargados. Regresamos al flujo original punto 3

## INDICACIONES GENERALES

Ya tenemos nuevo flujo para los vales de arte, ocupo que crees los nuevos estados o sobreescribas los ya existentes. Al igual que, vayas realizando las correcciones una a una.

Con este nuevo flujo de vales de arte, desaparece el buzón compartido establecido en la idea original. Ahora, cada rol tendrá su buzón individual. A excepción del supervisor, el ve todo los vales de arte del asesor.

Los vales de arte de modificación son vales de arte totalmente nuevos. Quiere decir, si un vale de arte recibió una propuesta en el momento que estaba en condición de atraso. Eso se registra. Ejemplo: GUA-1-1 se RECIBIÓ el 21/8/2026 con ATRASO de 2 días. Claro esto es un ejemplo, vos seguí el formato actual que se usa en para "Historial".
Entonces, al aprobar una modificación de un vale de arte, se genera un nuevo registro para ese vale, pero ahora tiene el mismo correlativo del vale original con el prefijo "MOD". Este vale de arte se crea cuando se aprueba la modificación, y su estado inicial será "MODIFICADO". Si el vale original tenía condición de atraso, como ahora este es un nuevo vale de arte, se reinicia esa condición y se calcula a partir de la nueva fecha de entrega.

## CORRECCIONES

1. Cambiemos el campo de `Técnico` y `Acabados` del formulario de creación de vale de arte. Estos serán textbox ya no combobox.

2. Correción al label de cotización, en el archivo de `analisis_correcciones_2.md` te indiqué que la cotización es un número de un documento, revirtamos ese cambio y volvamos al label anterior:
    - Cotización (Q)

3. Actualmente, el checkbox de urgente se puede marcar y desmarcar arbitrariamente. Lo que necesito, es que cuando la fecha de entrega del vale de arte sea menor a 3 días, el checbox de urgente debe marcarse automáticamente y no debe permitir desmarcarse. En caso la fecha si sea mayor a 3 días a partir del día actual, el checkbox se podrá marcar arbitrariamente

4. Agregamos una nueva sección al formulario

________________________________________________________________________________________
|   INFORMACIÓN DE TALLER                                                               |
|_______________________________________________________________________________________|
|                                                                                       |
| ETIQUETAS DE TALLERES                                                                 |
|_______________________________________________________________________________________|

Me gustaría un sistema de etiquetas, donde el asesor podrá seleccionar a los talleres a los cuales quiere enviar el vale de arte. Si quiere quitar un taller, presiona la equis dentro de la misma etiqueta para remover un taller.

Adicional a esto, antes de crear un vale de arte, que salte un modal de confirmación.

5. Agregaremos un nuevo campo a la sección de "INFORMACIÓN DE VENTA" del formulario:

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
| Cantidad (2/8)     | COTIZACIÓN (2/8)     |                     | FIRMA AUTORIZACIÓN  |
|_______________________________________________________________________________________|

Este campo debe ser una sola línea donde el Asesor podrá firmar, no ingresar firma ni nada, únicamente una línea para que puedan firmar

6. Necesito que modifiquemos la generación del PDF, para todas las secciones quita los bordes de las tablas. Y reduci en un 70% el espaciado de las cajas de las secciones. La finalidad de esto, es darle más espacio al área de "Boceto y Descripción".

7.  Agreguemos una nueva columna a la vista de la lista del asesor, donde incluyamos el taller. Las columnas quedarían así:
    - Correlativo
    - Fecha y hora de ingreso
    - Fecha de entrega
    - Atraso (cantidad de días)
    - Fecha de evento
    - Taller
    - Estado
    - Acciones

8. Modificamos el funcionamiento del checkbox de "Adjuntos". En realidad ese checkbox es marcado por los técnicos cuando imprimen el vale de arte. Por lo que, quitemos esa funcionalidad, pero mantengamos el checkbox con su label. Simplemente que ya no se marque.

9. Actualmente, los contadores tienen un bug. El cuál no actualiza (los que se tienen que actualizar) cuando se modifica la ventana de tiempo. Corrige eso

10. Además, implementa una funcionalidad tipo filtro a los contadores. Los contadores se podrán seleccionar y deseleccionar para aplicar su respectivo filtro. Ejemplo:
    - Si se selecciona el contador de "Vales pendientes de asignación" me mostrará todos los que no tienen asignación. Y si lo deselecciono, me mostrará la vista normal. 
    - Así para todos los contadores de todas las vistas
Que esto no afecte la paginación por scroll

11. Actualmente, en la lista de los vales de arte, el asesor solo debe ver 4 estados:
    - Creado: cuando el asesor crea el vale de arte o se crea un vale de arte para modificación
    - Pendiente Confirmación: cuando el encargado autoriza la propuesta del técnico
    - Confirmado: cuando el asesor confirma de recibido el vale de arte
    - Rechazado: cuando el asesor rechaza el vale de arte
Estos estados no son creados en la base de datos y no alteran el flujo nuevo de estados de un vale de arte, son lógicos. Supongamos, un vale se encuentra `ASIGNADO` a un técnico, el asesor deberá ver -> `CREADO`. Y no es hasta que un encargado o el encargado general autorize un vale de arte que el asesor podrá ver `PENDIENTE CONFIRMACIÓN`. De lo contario, el vale permanecerá visible para el asesor con el estado de `CREADO`.
En caso, el proceso es de modificación, los estados visibles serán:
    - Solicitando Modificación: cuando el asesor solicite a su supervisor una autorización de modificación
    - Modificado: cuando se aprobó la modificación
    - Pendiente de confirmación: cuando el encargado autoriza la propuesta del técnico y tiene que confirmar el asesor 
    - Confirmado: cuando el asesor realiza la venta del vale de arte
    - Rechazado: cuando el asesor cancela la venta del vale de arte

12. Agregaremos un rol clon por llamarlo de alguna manera, el encargado general tiene un asistente. Que puede realizar las mismas funciones que él. SOLO para este módulo. Creame ese rol y usuario