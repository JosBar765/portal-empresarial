# ARCHIVO DE ARREGLO No. 15 AL MÓDULO DE: VALES DE ARTE

1. Al aprobarse una modificación, el vale de arte original cambia su estado de `SOLICITANDO MODIFICACION` a `MODIFICADO`. Esto afecta la vista de `Trabajo Realizado` de los encargados de taller, ya que ellos al cambiar el estado del vale original ya no pueden ver la aprobación que hicieron para el vale original. Hagame que cuando un vale de arte se apruebe su modificación, el vale de arte original se vaya a estado de `CONFIRMADO`. Eso quiere decir que:
    - ...
    - El asesor recibe la propuesta del vale de arte <- `PENDIENTE CONFIRMACIÓN`
    - El asesor NO confirma la resolución del vale de arte y solicita una modificación <- `SOLICITANDO CONFIRMACIÓN`
    - El supervisor autoriza la confirmación <- Atención!!
    Aquí es donde quiero que el vale de arte original regrese a `CONFIRMADO`. Claro, el estado del nuevo vale de arte MOD-... Sí tendrá como estado inicial `MODIFICADO`

2. Al que tenga los permisos de fusionar, es importantísimos que le salga el contador de `Vales fusionados` (actualmente lo hace) y que en su pestaña de `Trabajo Realizado` precisamente le salgan esas aprobaciones. Recordá, en trabajo realizado sale también las aprobaciones de trabajo a los técnicos, como las autoaprobaciones (los vales que se asignan a sí mismos y realizan los encargados de taller)

3. Actualmente, cuando los talleres realizan un vale de arte y luego de ser fusionado, sí permanece en su vista de `Trabajo Realizado` de las propuestas individuales que enviaron. Pero, pasa lo siguiente:
    - Se aprueba una modificación
    - La modificación se dirige a dos talleres (ejemplo: protextil y diseño)
    - Los talleres adjuntan sus propuestas
    - Se fusiona el vale de arte
    - Se le manda el vale de arte fusionado al asesor
    Todo bien, pero en la pestaña de `Trabajo Realizado` de los talleres de protextil y diseño desaparece esas propuestas. Recordemos, que ese registro debe existir ya que es un vale con correlativo nuevo MOD-... por lo que tanto los encargados de taller y los técnicos tienen que poder ver la propuesta que adjuntaron aún así fuera una modificación

4. Implementemos estados lógicos para el técnico en su vista de `Trabajo Realizado`. Mira, cuando al técnico se le apruebe su trabajo, que salga `APROBADO`. Al técnico no le importa saber qué diablos pasa con el vale de arte después de que fue aprobado por su encargado

5. Revirtamos el cambio realizado en `analisis_correcciones_14.md` punto número **13**. Revertilo a cómo estaba que parece que no me entendiste. Lo que necesito es que las acciones se muestren **3 botónes por fila** y en caso de haber más botones que se apilen en otra fila dentro de la misma celda de las acciones por debajo. Quiere decir:
    |  ACCIONES   |
    | AC1 AC2 AC3 |
    | AC4 AC5 AC6 |
    ...
    Y así sucesivamente. El alto de la fila no es meramente la "celda" de acciones. Hay que evaluar, ya que, la columna de talleres puede llegar a tener hasta tres etiquetas: Protextil, Diseño, Diseño UV/3D. Si esa celda es la más alta, que toda la fila sea de ese alto. Si la celda de acciones es la más alta, que esa sea la altura de toda la fila. El propósito de esto es que todas las filas esten bien alineadas, actualmente se desalinean y no es bueno visualmente.

6. En la pestaña de `Gestionar tiendas`, cómo ya pusiste la acción de `Ver Personal` quitame la columna de "personal". Mejor, remplazalo con una columna de "Depatamento/Subdivisión". Quita esa infomración de los labels dejabo del nombre de las tiendas, solo deja el correlativo en ese label

7. Vamos a cambiar lo que muestra el historial. Te detallaré rol por rol qué es lo que le importa ver:
    - Asesor de ventas
        * Cuando se crea el vale de arte
        * Cuando el supervisor autoriza el vale de arte
        * El momento en el que vale retornó (ya sea directamente o por fusión, es importante ver quién y a qué hora regreso)
        * Cuando lo marque como recibido
        En caso haya modificación, el vale original añadirá:
        * Cuando se solicita la modificación
        * Cuando se autorizo la modificación
        Esto solo aplica para el vale original. El nuevo vale MOD-... seguirá el flujo normal de historial tal y cómo lo hizo el vale original
    
    - Supervisor
        * Cuando se crea el vale de arte
        * Cuando el supervisor autoriza el vale de arte
        * Cuando el vale de arte retorne al asesor:
            * Cuando el/los encargados aprueben las propuestas
            * Cuando se fusione el vale de arte (para dos talleres o más)
        * Cuando el asesor confirme de recibido
        En caso haya modificación, vel vale original añadirá:
        * Cuando se solicita la modificación
        * Cuando se autorizo la modificación
        Esto solo aplica para el vale original. El nuevo vale MOD-... seguirá el flujo normal de historial tal y cómo lo hizo el vale original

    - Encargados de taller
        * Cuando se autorize la creación del vale de arte
        * Cuando se le asigne a un técnico o cuando se lo asigne a si mismo
        * Esto puede ser cíclico:
            * Cuando un vale de arte se marca como en proceso
            * Cuando se ponga en pausa
            * Cuando se envíe una propuesta (propuesta o cancelación)
        * Cuando reciba el trabajo del técnico
        * Cuando reasigne (si es que llega a pasar, esto retorna al ciclo de proceso de trabajo)
        * Cuando apruebe
        Esta información será la de su taller, quiere decir, el encargado de diseño no debe ver cando uno de protextil comienza a trabajar algo.
        Estos también aplica para encargado de diseño local.
    
    - Técnicos
        * Cuando un vale de arte entra en su buzón (cuando se le asigna)
        * Esto puede ser cíclico:
            * Cuando un vale de arte se marca como en proceso
            * Cuando se ponga en pausa
            * Cuando se envíe una propuesta (propuesta o cancelación)
        * Cuando se envíe la propuesta a revisión
        * Cuando se apruebe
        Si llegará a haber reasignación:
        * Cuando se le reasignó (luego volvemos al ciclo de proceso de trabajo)

    - Gerente
        * Cuando se crea el vale de arte
        * Cuando se autoriza la creación
        * Cuando los encargados asignan el vale de arte a sus técnicos (solo cuando asignan, no me importa a quién)
        * Cuando los encargados aprueban las propuestas
        * Cuando se fusionan los vales de arte (si es que hay fusión)
        * Cuando el asesor marca como recibido
        Si hay modificación agregar:
        * Cuando se solicite la modificación
        * Cuando se apruebe la modificación
        Esto solo aplica para el vale original. El nuevo vale MOD-... seguirá el flujo normal de historial tal y cómo lo hizo el vale original

8. Actualmente, no sé como hiciste la relación de Supervisores con las tiendas. Porque no tengo ningún supervisor con tiendas asignadas. En **correcciones 12** te dí a los supervisores y los departamentos los cuáles supervisan, lo que esperaba era que los Supervisores supervisan las tiendas de los departamentos asignados. Ejemplo:
    **Carlos Cornejo** supervisa el departamento de **Ventas Munditrofeos**. Por lo cuál, el supervisa a las subdivisiones de **Comercialización** y **Sala de ventas**. Dichas subdivisiones contienen a las tiendas **MTC** y **MTS**. El hecho de supervisar le permite ver los vales de arte gestionados por los empleados de **esas** tiendas y los talleres o taller de esa tienda.
Arregla esa relación, no funciona como debería actualmente.

9. En la vista administrador, en la pestaña de `Roles y Permisos` me aparecen los permisos agrupados por módulos, eso está bien. Pero quiero que me borres los permisos MOCK. Actualmente, solo tenemos dos módulos. Admin y Vales, borra los otros módulos MOCK y todo lo relacionado con esos módulos. 

10. En la vista administrador, en la pestaña de `Gestionar Usuarios` y relacionado con los **Supervisores**, tanto como para el formulario de `Nuevo Usuario` como para el de `Modificar Usuario`, quiero que cambies la gran lista de tiendas que salen en: `Tiendas Supervisadas` y lo cambies por un menú **cascading menu**. Donde la jerarquí más alta serán los países y la jerarquía baja las tiendas

11. En la vista administrador, en la pestaña de `Gestionar Usuarios` para asignarle una tienda a alguien, cambia el combobox por un **cascading menu** donde la jerarquía alta serán los países y la jerarquía baja las tiendas

12. En el formulario para editar el personal de la pestaña `Gestión de tiendas` quiero que apliques un menu **cascading menu** al momento de `Agregar Personal`


## NUEVOS USUARIOS

### ASESORES COMERCIALES

Creemos los usuarios de los asesores de ventas, te indicaré a qué tienda pertenecen según su correlativo. Crea las relaciones necesarias
    TIENDA|NOMBRE|CORREO|CONTRASEÑA
    
    MTC|Alejandra Luna|ventas2@grupopremia.com|Alejandra9595
    MTC|Karla Ordoñez|ventas3@grupopremia.com|Karla6565
    MTC|Melanie Perez|ventas4@grupopremia.com|Melanie5555
    MTC|Rosa ramírez|ventas5@grupopremia.com|Rosa3232
    MTC|Luz Carmen Pérez|ventas6@grupopremia.com|Luz8484
    MTC|Alexander Jolón|ventas9@grupopremia.com|Alex7788

    MTS|Lilian Sapon|vtsala1@grupopremia.com|Lilian1122
    MTS|Gema Cruz|serviciovip2@grupopremia.com|Gema3232
    MTS|Jamelette Villatoro|ventas@grupopremia.com|Jamelette8899
    MTS|Maylin Escobar|tmk2@grupopremia.com|Maylin5454
    MTS|Nicolle Monterroso|vtsala4@grupopremia.com|Nicolle5421

    P13|Carolina Rosales|ventasgt1@grupopremia.com|Carol6696
    P13|Diana Castaneda|tmkpremia1@grupopremia.com|Diana6464
    P13|Mary Posada|tmkpremia3@grupopremia.com|Mary1515
    P13|Eliza Sales|tmkpremia13@grupopremia.com|Eliza2626
    P13|Astrid Ochoa|ventas13@grupropremia.com|Astrid4848
    P13|Sarah Aleman|ventas.premia13@grupopremia.com|Sarah5533

    SJN|Wendy Ramirez|sanjuan@trofex.com|Sanjuan1122
    ZN3|Angel Gomez|zona3@trofex.com|Zona35555
    COB|Margarita Yoj|coban@trofex.com|Coban6565
    PET|Wendy Recinos|peten@trofex.com||Peten8484
    PTB|Yasmin Porras|ptobarrios@trofex.com|Puerto6262
    CHQ|Ingrid Gutierrez|chiquimula@trofex.com|Chiqui5151
    JTP|Yesica Hernandez|jutiapa@trofex.com|Jutiapa2222

    VLN|beberly santos|villanueva@trofex.com|Villa6363
    ESC|Rocio giron|escuintla@trofex.com|Escuintla9696
    CHM|Sucely Poou|chimaltenango@trofex.com|Chima4141
    MAZ|Blanca argueta|mazate@trofex.com|Mazate7474
    XEL|Dalia Ramirez|xela@trofex.com|Xela8585
    HUE|Jose Gonzalez|huehue@trofex.com|Huehue9595
    SMS|Anderson Cardona|sanmarcos@trofex.com|Sanmarcos1111

    SSV|Julio Barahona|mercadeosv@grupopremia.com|Julio2233
    SSV|Sandra Onofre|tkmsv@grupopremia.com|Sandra6565
    SSV|Carlos Martinez|premiateleventassv@grupopremia.com|Carlos4646
    SSV|Kevin Mendoza|ventassv1@grupopremia.com|Kevin1515
    SSV|Karen Herrera|ventassv@grupopremia.com|Karen3636
    SAA|Tania Melara|santaana@grupopremia.com|Tania5454
    SMG|Patricia Diaz|sanmiguel@grupopremia.com|Patricia5656

    SPS|Pradi Vareal|cobrossps@grupopremia.com|Pradi8866
    SPS|Alexis Martínez|ventasps2@grupopremia.com|Alexis9595

    TEG|Jaqueline Sosa|comertegus@grupopremia.com|Jaqueline3535
    TEG|Karen Martinez|cobrostg@grupopremia.com|Karen5454
    CMY|Merary Zavala|comayagua@grupopremia.com|Merary6868

    MAN|Alexander Selva|mercadeonic2@grupopremia.com|Alexander2222
    MAN|Magaly Ruiz|ventasnic2@grupopremia.com|Magaly4141
    LEO|Alejandra Salazar|leon@grupopremia.com|Alejandra3366

    SJO|Francisco Zamora|costarica@grupopremia.com|Francisco1234
    SJO|Luis Elizondo|ventas2cr@grupopremia.com|Luis8855



