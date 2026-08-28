# ARCHIVO DE ARREGLO No. 12 AL MÓDULO DE: VALES DE ARTE

1. Asegurate que las notificaciones de atraso SOLO suenan la primera vez que un vale de arte acumula atraso (>=1). Luego, que ya no vaya mostrando atraso

2. Actualmente, hay muchos casos donde hay notificaciones duplicadas. El propósito de las notificaciones es que sea solo una comunicando la acción. Te doy casos donde salen dos notificaciones:
    - Para el asesor, cuando crea un vale de arte salen dos notificaciones: la de creación (verde) y la de espera de autorización (azul). Corrijamos dejando solo una notificación y que la acción sea: creada correctamente, en espera de autorización
    - Para el supervisor, cuando autoriza la creación de un vale de arte salen dos notificaciones: la de creación (verde) y la de enviado al taller correctamente. Corrigamos dejando solo una notificación y que la acción sea: creada correctamente, enviada al(os) talleres
    - Para el técnico, al enviar una propuesta salen dos notificaciones: propuesta entregada (verde) y entregado pro técnico (azul). La notificación azul ni debería de salir. Solo debe ser la de propuesta entregada
    - Para los encargados de taller, salen dos notificaciones al asignar un vale de arte a un técnico: se asignó correctamente (verde) y fue asignado por Encargado de Diseño a Técnico... (azul). Corrijamos dejando solo una notificación que diga: se asignó correctamente al técnico {nombre}.

3. Actualmente, los roles tienen descripciones orientadas solo a este módulo. Mejor dejemos descripciones más generales en base a su función. Ejemplo: Asesor de ventas, encargado de realizar ventas. Algo así. Porque cuando agregue más módulos estas descripciones estarán desalineadas

4. Solucionar un bug que está pasando, te explico la secuencia:
    - Asesor solicita crear un vale de arte
    - supervisor autoriza
    - el vale llega al(os) taller(es)
    - los encargados asignan los vales al técnico
    - los técnicos comienzan a trabajar
    - los técnicos envían su propuesta <- Atención acá!!
En este punto, el último técnico que adjunte su propuesta, sobreescribe la propuesta que verán los demás encargado. Me refiero:
    - Técnico 1 sube propuesta
    - Técnico 2 sube propuesta
    - Encargado de técnico 1 desea ver la propuesta para aprobar, mira la propuesta del técnico 2 <- Esto está mal!!
    - Encargado de técnico 2 desea ver la propuesta para aprobar, mira la propuesta del técnico 2
Probé también siendo el técnico 1 el último en subir la propuesta, y mismo resultado. Cuando el encargado del técnico 2 desea ver la propuesta a probar, mira la propuesta del técnico 1.
Sin embargo, hice la prueba de aprobar ambas propuestas (aunque visualmente eran incorrectas). Y Cuando le cayó al encargado general para hacer la fusión, el si vió correctamente las propuestas del técnico 1 y técnico 2. Por lo que, ha de ser un bug a la hora de ver las propuestas por parte de los encargados de taller.
    
5. Actualmente, los técnicos pueden ver todos los estados del vale. Hagamos que vean sólamente los estados de: Asignado, en proceso, en revisión y aprobados. Los aprobados solo se verán en la vista de `trabajo realizado`, agregar la acción de ver propuesta para este tipo de vales.

6. Hagamos algo similar al punto #5 con el encargado general. Que en su buzón solo vea los vales Modificados, Aprobado por talleres y en la vista de `Trabajo realizado` que salgan sus fusiones (implementar la acción de ver propuesta).

7. Actualmente, hay vales que sale: atraso 0 días. Eso es mentira, no hay atrasado de 0 días. El atraso es cuando hay >=1 día de retraso. En caso, haya 0 días de retraso, haremos que muestre el texto: "Hoy" con el color de la badge amarilla. Que indica que se debe sacar a más tardar el día actual.

8. En el modal de "reenviar" del encargado general (y su asistente) haremos algo similar con lo que se hizo para el modal de "autorización de modificación" del supervisor, que tenga el hipervínculo de Ver vale de arte (sería el nuevo vale de arte generado MOD). No será necesaria la acción de ver propuesta, porque para estos vales MOD la propuesta del vale original se encuentra adjunta al nuevo vale.

9. Agregar el mismo hipervínculo del punto #8 al modal de "Aprobar y fusionar" del encargado general (y su asistente)

10. Analizando la base de datos, hay confusión todavía con las relaciones y la estructura de la empresa, no están alineados. Te lo explicaré de manera más detallada la estructura de la empresa, y cómo van los actores que interactuarán con el sistema:
    - La empresa tiene varias tiendas (localidades; de preferencia cambiemos el nombre de esta tabla a "tiendas") que pertenecen a un departamento, una subdivisión de ese departamento y un país:
        TIENDA||DEPARTAMENTO|SUBDIVISIÓN|PAÍS
        * Munditrofeos, S.A.|Ventas Munditrofeos|Comercialización|Guatemala
        * Munditrofeos, S.A.|Ventas Munditrofeos|Sala de Ventas|Guatemala
        * Premia, S.A.|Ventas Premia Z13||Guatemala <- Premia no tiene una subdivisión

        * Premia San Salvador|Ventas Centroamérica|Ventas San Salvador|Salvador
        * Premia Express Santa Ana|Ventas Centroamérica|Ventas Santa Ana|Salvador
        * Premia Express San Miguel|Ventas Centroamérica|Ventas San Miguel|Salvador
        * Premia Express Escalón|Ventas Centroamérica|Ventas Escalón|Salvador

        * Premia Express Comayagua|Ventas Centroamérica|Ventas Comayagua|Honduras
        * Premia Tegucigalpa|Ventas Centroamérica|Ventas Tegucigalpa|Honduras
        * Premia San Pedro Sula|Ventas Centroamérica|Ventas San Pedro Sula|Honduras

        * Premia Express Managua|Ventas Centroamérica|Ventas Managua|Nicaragua
        * Premia Express León|Ventas Centroamérica|Ventas León|Nicaragua

        * Premia San Jose|Ventas Centroamérica|Costa Rica

        * Trofex San Juan|Ventas Trofex R1|Ventas San Juan|Guatemala
        * Trofex Zona 3|Ventas Trofex R1|Ventas Zona 3|Guatemala
        * Trofex Coban|Ventas Trofex R1|Ventas Cobán|Guatemala
        * Trofex Petén|Ventas Trofex R1|Ventas Petén|Guatemala
        * Trofex Puerto Barrios|Ventas R1 Trofex|Ventas Puerto Barrios|Guatemala
        * Trofex Chiquimula|Ventas Trofex R1|Ventas Chiquimula|Guatemala
        * Trofex Jutiapa|Ventas Trofex R1|Ventas Jutiapa|Guatemala

        * Trofex San Marcos|Ventas Trofex R2|Ventas San Marcos|Guatemala
        * Trofex Chimaltenango|Ventas Trofex R2|Ventas Chimaltenango|Guatemala
        * Trofex Escuintla|Ventas Trofex R2|Ventas Escuintla|Guatemala
        * Trofex Huehuetenango|Ventas Trofex R2|Ventas Huhuetenango|Guatemala
        * Trofex Mazatenango|Ventas Trofex R2|Ventas Mazatenango|Guatemala
        * Trofex Villa Nueva|Ventas Trofex R2|Ventas Villa Nueva|Guatemala
        * Trofex Xela|Ventas Trofex R2|Ventas Xela|Guatemala

    - Cada departamento tendrá su supervisor/gerente. Cuando digo supervisor/gerente, me refiero a:
        - Su rol principal es el de supervisor:
            - Sidebar de supervisor (buzón y trabajo realizado)
            - Acciones de supervisor (autorizar creación, modificación, y todas las demás)
        - Tiene algunos permisos del rol de gerente. Específicamente el dashboard de gerencia, el cuál vamos a rediseñar. Ya que, hay métricas que son importantes para este dashborad y el diseño actual no me gusta.
            - Implementaremos estos contadores
                * Total de vales -> Este no tendrá la función que muestra los vales de arte en la lista
                * Cantidad de vales modificados (y su % con respecto a todos los vales)
                * Cantidad de vales marcados como recibido (y su % con respecto a todos los vales)
                * Cantidad de vales que se encuentran aún en progreso (pendientes de asignación, asignados, en proceso, en revisión de taller, aprobados por talleres; y su % con respecto al total de vales)
                * Cantidad de vales en condición de atraso (y su % con respecto a todos los vales)
            - Estos contadores funcionarán de manera especial. Supongamos que se presiona el de `Cantidad de vales en condición de atraso`, mostrará en una lista (similar al buzón) aquellos vales dentro de la ventana de tiempo que se encuentren en condición de atraso. Al deseleccionarlo, se vaciará la lista.
            - Similar a las otras vistas, solo el contador de atrasados puede combinarse con los demás
            - Esta lista no debe actualizar en tiempo real, esto es exclusivo del buzón. Esta lista literalmente solo sirve para listar lo que se desea ver (contador seleccionado) y en el período de tiempo que se desea ver (ventana de tiempo).
            - La lista tendrá las mismas columnas que el buzón. Pero, solo tendrá las acciones de: ver vale de arte, ver propuesta (en caso el vale de arte ya haya recibido una propuesta, de lo contrario que no aparezca) e historial
            - Los estados que se mostrán en la lista serán lógicos:
                * Modificados: todo vale en estado de modificación
                * Recibidos: confirmados de recibido por parte del asesor
                * En Progreso: pendientes de asignación, asignados, en proceso, en revisión de taller, aprobados por talleres. Si el supervisor/gerente quiere ver el último estado de este vale que mire el historial
            - El historial (para el gerente), mostrará todos los movimientos y cambios de estado del vale de arte
            - La lista contará con un buscador, el cuál hará request directo a la DB y lo mostrará en la lista. Este buscador podrá buscar mientras se va escribiendo (activamente digamos)
            - Quitamos las gráficas
            - Los supervisores pueden ser rotativos, quiere decir, que para una(s) misma(s) tienda(s) pueden haber uno o más supervisores/gerentes. Es importante que TODO (contadores, buzón, trabajo realizado) se puede filtrar por tienda

    - A continuación, te doy a la gente que son supervisores y los supervisores/gerentes. Crea la relación o tabla (de ser necesario) en la DB a modo de evitar una base de datos sin normalización, ya que hay repetición de datos en las columnas
        NOMBRE|CORREO|DEPARTAMENTO|SUBDIVISIÓN|ROL
        * Carlos Cornejo|ventas1@grupopremia.com|Ventas Munditrofeos||Supervisor/gerente <- Todas las subdivisiones

        * Milvia Esquivel|gerentesala@grupopremia.com|Ventas Munditrofeos|Sala de ventas|Supervisor

        * Benjamin Per|gerentezona13@grupopremia.com|Ventas Premia Z13||Supervisor/gerente <- No tiene subdivisión
        
        * Juan Carlos Paniagua|regional@grupopremia.com|Ventas Centroamérica||Supervisor/gerente <- Todas las subdivisiones
        * Victor Tobar|regional.ca@grupopremia.com|Ventas Centroamérica||Supervisor/gerente <- Todas las subdivisiones

        * Emilio Morales|supervisor1@trofex.com|Ventas Trofex R1||Supervisor/gerente <- Todas las subdivisiones
        * Emilio Morales|supervisor1@trofex.com|Ventas Trofex R2||Supervisor/gerente <- Todas las subdivisiones
        * Pablo Orellana|supervisor@trofex.com|Ventas Trofex R2||Supervisor/gerente <- Todas las subdivisiones
        * Pablo Orellana|supervisor@trofex.com|Ventas Trofex R2||Supervisor/gerente <- Todas las subdivisiones

        * Carla Gonzáles|ventassv3@grupopremia.com|Ventas Centroamérica|Ventas San Salvador|Supervisor
        * Carla Gonzáles|ventassv3@grupopremia.com|Ventas Centroamérica|Ventas Santa Ana|Supervisor
        * Carla Gonzáles|ventassv3@grupopremia.com|Ventas Centroamérica|Ventas San Miguel|Supervisor

        * Brian Medina|honduras@grupopremia.com|Ventas Centroamérica|Ventas San Pedro Sula|Supervisor

        * Velky Cuevas|tegus@grupopremia.com|Ventas Centroamérica|Ventas Tegucigalpa|Supervisor
        * Velky Cuevas|tegus@grupopremia.com|Ventas Centroamérica|Ventas Comayagua|Supervisor

        * Stefany Luna|gerencianic@grupopremia.com|Ventas Centroamérica|Ventas Managua|Supervisor
        * Stefany Luna|gerencianic@grupopremia.com|Ventas Centroamérica|Ventas León|Supervisor

        * Victor Tobar|costarica@grupopremia.com|Ventas Centroamérica|Ventas San Jose|Supervisor

    - De momento, no tengo el personal de diseño, sus encargados y los técnicos. Mantegamos los que tenemos, pero ya te expliqué como funciona la estructura de las tiendas y sus supervisores.

11. Normalizemos la base de datos. Actualmente hay tablas que incluso ni se usan, campos que son inútiles, tal y como es el caso del campo: `es_cancelación` de la tabla `vale_propuesta`. Esto permite que cada vez que hay una cancelación se hace un registro en la base de datos, esto me es inútil, el sistema debería se capaz de manejar esa excepción y no andar llenando la DB de registros "en blanco". Necesito que identifiques los campos de la DB que no se estén usando, que no aporten nada, que generen una dependencia transitiva, etc. Necesitamos normalizar esa base de datos. Quiero que sea interactivo, tú me das diciendo:
    - Porqué consideras que es inútil ese campo/tabla/relación
    - Qué caso podría llegar a ser útil ese campo/tabla/relación 
    - Cómo se está utilizando actualmente ese campo/tabla/relación (si es que lo hace)
    - Cómo proceder se te ocurre proceder con él
Yo te daré mi aprobación para los campos necesarios en base a lo que yo también analize

12. Atomiza los permisos, a modo que un solo permiso sea una descripción atómica. Ya que, posteriormente haremos un panel administrativo donde podremos administrar los permisos que tiene cada rol.