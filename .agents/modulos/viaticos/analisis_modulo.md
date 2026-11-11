A continuación, detallaré actor por actor sus necesidades y las vistas que deberían tener. El propósito de esto, es representar de manera textual las vistas que debería tener el módulo.   
  
Si no se incluye alguna vista, procedimiento, actor, es porque está fuera del alcance del módulo.  
  
El nombre del módulo es: **CALCULADORA DE VIÁTICOS**

---

# Flujo de solicitación de viáticos

1. El `piloto` o `supervisor de ventas` entrará a la plataforma
2. El `piloto` o `supervisor de ventas` seleccionará el módulo de vales de arte
3. El `piloto` o `supervisor de ventas` podrá ver las solicitudes que ha realizado o podra crear una nueva solicitud de viáticos. La lista contendrá las siguientes acciones:
    * Modificar datos de la solicitud
    * Dar de baja la solicitud
    * Liquidar (esto se explicará posteriormente)
4. El `piloto` o `supervisor de ventas` crea una nueva solicitud  
    4.1 El `piloto` o `supervisor de ventas` llena el formulario
5. El sistema registra la solicitud y se lo envía el buzón del `gerente` o `asistente de gerencia`
6. El `gerente` o `asistente de gerencia` aprueba la solicitud
7. El `piloto` o `supervisor de ventas` recibe una notificación de que ya se confirmó su solicitud  
    7.1 Para este punto, el `piloto` o `supervisor de ventas` es libre de hacer el viaje  
  
Esta primera versión del módulo manejará única y exclusivamente la creación y administración de las solicitudes de viáticos.

## Modalidad de viáticos

Hay dos modalidades para los viáticos: Viajes de 1 día o menos y Viajes de más de 1 día. 
1. **Viajes de 1 día o menos**: lo constan las rutas diarias o inspecciones cortas sin pernocta. Es básicamente un checklist pre-viaje, control de odómetro y combustible.
2. **Viajes de 1 día o más**: viajes de rutas foráneas de larga distancia que requieren hospedjae, presupuesto de comidas, combustible por galonaje, depreciación y carga de recibos.  
  
Para ambos tipos de modalidad se puede usar algún vehículo de la empresa o vehículo propio.

## Estados de una solicitud

1. `ESPERANDO_AUTORIZACIÓN`: Aquí se crea la solicitud de viáticos y cae al buzón de los que pueden autorizar
2. `RECHAZADO`: Aquí es cuando se rechaza la solicitud de viáticos; igual que en los vales de arte, el que rechaza puede enviar una razón de por qué rechazo. Solo que acá ya no es un chat, solo una razón
3. `AUTORIZADO`: Cuando se autoriza la solicitud de viáticos. Para este punto, los viáticos ya pueden entrar en curso.
4. `LIQUIDADO`: El solicitante terminó de liquidar los viajes mayores a un día.
5. `VENCIDA`: La fecha de inicio ya pasó y la solicitud no fue autorizada. Lo que la vuelve imposible de autorizar.
  
Estos son los estados lógicos de una solicitud de viáticos, sin embargo, los estados visibles en el pipeline de estos para una solicitud de viáticos mayor a un día serán:
1. Esperando autorización -> `ESPERANDO AUTORIZACIÓN`  
    1.1 Rechazada -> `RECHAZADO`. 
2. Autorizado -> `AUTORIZADO`
3. En curso -> Cuando se llega a la fecha de inicio del viaje
    3.1 Terminado -> Cuando se llega a la fecha final del viaje
4. Liquidado -> `LIQUIDADO`  
Nótese como son 4 pasos los que muestra el pipeline, donde el paso 1 y 3 tienen dos facetas en el mismo estado.  
  
Y las solicitudes de viáticos menores a un día mostrarán:
1. Esperando autorización -> `ESPERANDO AUTORIZACIÓN`  
    1.1 Rechazada -> `RECHAZADO`. 
2. Autorizado -> `AUTORIZADO`
  
Los rechazos mostrarán en el paso 1 una equis (similar a como se muestra un rechazo en el pipeline de estado de un vale de arte).
  
# Permisos

Como el propósito de este módulo es que ciertas personas puedan solicitar viáticos, es necesario que los permisos sean atómicos y no dependan del rol. Quiere decir, los permisos controlarán vistas o acciones las cuáles serán independientes al rol al cual se le asigne el permiso. En caso, para una vista sea requerida un permiso, el acceso será denegado si el usuario que intenta acceder a la vista no tiene el permiso. Lo mismo pasa con el módulo. Puedes ver cómo funciona la plataforma actualmente para aquellos módulos los cuáles restringen su acceso con el permiso.  
  
- Es necesario un permiso único que permita **ver y usar** el módulo. Muchos módulos de la plataforma actualmente tienen el permiso `{modulo}.ver`; para este caso, considero que el permiso `viaticos.ver` es más que suficiente y que dicho permiso controle si el módulo en visible en el dashboard de módulos de la plataforma y su interacción con el mismo (uso de la pestania ***Solicitudes***).  

- Otro permiso será `viaticos.gestionar`. Este permiso solo permitirá **ver** la solicitud de los viáticos y el estado en el que se encuentran en una vista tipo lista; **no permite** autorizar ni rechazar (pestania ***Gestiones***, incluye acciones nativas de la vista). Este permiso controla exclusivamente la acción.  
   
- Otro permiso será `viaticos.autorizar`. Este permiso permitirá la **autorización** y **rechazo** de las solicitudes de viáticos (pestania ***Gestiones***, acción autorizar y rechazar). Este permiso controla exclusivamente la acción.  

- Otro permiso será `viaticos.liquidar`. Este permiso permitirá **ver** la liquidación de una solicitud de viáticos realizada por el solicitante (pestania ***Gestiones***, acción liquidar). Este permiso controla exclusivamente la acción.  
  
- Otro permiso será `viáticos.configurar`. Este permiso permitirá **ver y usar** la pestania de ***Configuración***.  
  
Estos permisos son tentativos, quiere decir, en el camino puede surgir algún otro permiso que necesitemos delimitar. La regla de los permisos es que controlen las acciones que realizan los usuarios, y que ningún usuario podrá hacer alguna acción que requiera un permiso en específico. Los permisos tienen que ser atómicos y **totalmente independientes**, no deben ser hardcodeados o depender de código hardcodeado. La finalidad, es que si surgen nuevos roles se les pueda asignar dicho permiso de manera libre, y que con eso baste para que pueda interactuar con la acción.

# Vistas

A continuación, te detallaré cómo quiero que sean las vistas y qué contienen cada una de ellas. Cada vista está amarrada a un permiso el cuál se detalló en: **Permisos**.  
Cada vista es una pestania que se aparecerá en el sidebar.

## Solicitudes

Vista similar al buzón de los asesores en el módulo de `vales de arte`. Lo que se busca con esta vista es listar las solicitudes realizadas durante la ventana de tiempo seleccionada. Esta vista será visible para los usuarios que tengan `viaticos.ver`, también se incluye a las acciones nativas de esta vista.   
  
En el encabezado tendremos:
* Un selector de ventana de tiempo (usaremos el mismo que se usa para los vales de arte y reportes; este será un componente que usaremos a lo largo del portal)
* Un botón para crear una nueva solicitud de viáticos. Más detalles del modal de una nueva solicitud en **Modal de solicitud de viáticos**
  
Luego, tendremos la lista de las solicitudes que tendrá las siguientes columnas: 
* **Correlativo**: Correlativo generado por el sistema
* **Fecha creación**: Fecha y hora registrada por el sistema en el momento que se creó la solicitud
* **Fecha viáticos**: Marco de fechas o fecha que se solicitan los viáticos
* **Tipo**: <1 Día o +1 Día
* **Estado**: Pipeline de estados (similar al de vales de arte)
* **Acciones**: Para esta vista/pestania tendremos las acciones:  
    - `ver`: ícono del ojo para ver el pdf generado (más detalles del PDF en **PDF a generar**) de la solicitud de viáticos; posterior a que la solicitud haya sido liquidada también se podrá ver los recibos/facturas adjuntos a la liquidación.
    - `modificar`: ícono de un engranaje que permite corregir campos de la solicitud; genera un pdf que sobreescribe al anterior
    - `dar de baja`: ícono de bloquear (círculo con línea atravesada); borra el registro de la solicitud y el pdf generado
    - `liquidar`: Esta acción se habilitará **solo** para los viáticos de viajes mayores a 1 día y se habilita una vez terminado el período de viaje. Esta acción abrirá un modal el cuál permitirá ir adjuntando fotos/pdfs de facturas de los gastos durante el viaje (más detalles del modal de liquidación en **Modal de Liquidación**). Posterior a esto, el usuario que solicitó los viáticos puede "liquidar" la solicitud.  

En el encabezado de esta lista, agregar un buscador que permita buscar por: correlativo o fecha de viáticos.  
  
La lista tendrá todas las solicitudes, las que siguen en proceso y las liquidadas. Esta lista se ordenará según los estados automáticamente.

### Modal de liquidación

Este modal permitirá ir agregando facturas a modo de liquidar todo aquello que solicitó en sus viáticos. Quiere decir, si los viáticos fueron para 4 noches fuera, tendrá que liquidar las 4 facturas de las 4 noches de hotel. No puede agregar más. Lo mismo para los vauchers de gasolina, peajes, ferrys, etc. Lo único que no se liquida es los tiempos de comida.  
  
A lo largo de este modal, el usuario no solo podrá ver el monto de cuanto le falta por liquidar, si no, también el monto de lo que va liquidando. Cada item de liquidación tendra los siguientes campos:
1. **Qué está liquidando**: Un combobox que tenga lo que tenga que liquidar (hotel, gasolina, peaje, ferry, otro - campo de texto libre)
2. **Monto a liquidar**: Cifra en moneda local
3. **Foto/Archivo**: Le permite tomar una foto a algún voucher/factura, subir una imágen o documento .pdf

### Modal de solicitud de viáticos

El modal tendrá las siguientes secciones con los siguientes campos:

```
1. SI EL VIAJE ES DE MÁS DE UN DÍA    
    
    1.1 Combobox con los autos registrados de la empresa y los autos registrados del usuario
        1.1.1 Si el vehículo es propiedad del usuario  
            1.1.1.1 Rendimiento KM/Galón (numérico, mayor a cero)  
            1.1.1.2 Precio por galón (moneda, mayor a cero)  
            1.1.1.3 Depreciación por km (moneda, mayor a cero)  
            1.1.1.4 Galones requeridos (numérico, mayor a cero, calculado en base a la distancia)  
            1.1.1.5 Costo de Gasolina (moneda, mayor a cero, calculado por el sistema)  
            1.1.1.6 Costo Depreciación (moneda, mayor a cero, calculado en base a la distancia)  
        1.1.2 Si el vehículo es propiedad de la empresa  
            1.1.2.1 Rendimiento KM/Galón (numérico, mayor a cero)  
            1.1.2.2 Precio por galón (moneda, mayor a cero)
            1.1.2.3 Galones requeridos (numérico, mayor a cero, calculado en base a la distancia)  
            1.1.2.4 Costo de Gasolina (moneda, mayor a cero, calculado por el sistema)  

    1.2 Fechas de viaje
        1.2.1 Fecha de salida y fecha de entrada
    
    1.3 Motivo del viaje
        1.3.1 Podrá seleccionar de un combobox los motivos de viaje registrados en el sistema.
    
    1.4 Si el viaje es de 1 día o más:
        1.4.1 Ruta y Tramos de recorrido: cada tramo tiene un origen y un destino, la distancia entre el origen y el destino se obtiene del catálogo de las distancias que el sistema tiene. Lo mismo con las horas de viaje que dura dicho tramo. Cada vez que se agrega un nuevo tramo, debe comenzar en el destino del tramo anterior. Quiere decir, si mi ruta es de Munditrofeos, TX Xela y TX San Marcos; los tramos serían Munditrofeos -> TX Xela, TX Xela -> TX San Marcos. Así como se pueden agregar tramos se pueden quitar.   
        
        Los tramos se almacenan y configuran en el sistema de la siguiente manera (ejemplo textual): Munditrofeos -> TX Xela son 185 KM y dura 3.75 horas; Munditrofeos -> Escuintla son 70 KM y dura 2 horas. Por lo tanto, se tienen los siguientes tramos (Munditrofeos, TX Xela) y (Munditrofeos, TX Escuintla); dichos tramos con equivalentes (X,Y) y (Y,X). Sin embargo, si no existe algún par de ubicaciones registradas, no se puede elegir dicho tramno. Por ejemplo: (TX Xela, TX Escuintla) ni (TX Escuintla, TX Xela) se pueden elgir porque no existen. Por lo tanto, esto es importante tomarlo en cuenta al momento de ir seleccionando los tramos, a modo de evitar que se seleccione algún tramo inválido.  
        
        En base a estos tramos, es que se calculan algunos campos. Los tramos ya están especificados, los cuáles encontrarás en la misma carpeta que se encuentra este análisis.
    
    1.5 Hospedaje/Hotel
        1.5.1 Similar a los tramos, se podrán agregar y quitar varios hoteles y cada item de hotel deberá tener:
            1.5.1.1 Nombre del hotel (texto, 50 caractéres)
            1.5.1.2 Lugar (texto, 50 caractéres)
            1.5.1.3 No. de noches (numérico, mayor a cero)
            1.5.1.4 Valor por noche (moneda, mayor a cero)
            
            Básicamente son esas 4 columnas, al pie de esta sección habrán dos totales: total noches (numérico, calculado) y total hospedaje (moneda, calculado)
    
    1.6 Presupuesto de comidas por día
        1.6.1 Una lista de todos los días que seleccionó que durará el viaje, para cada día habrán tres columnas con un checkbox cada una: desayuno, almuerzo, cena. Así el usuario puede seleccionar qué día querrá desayuno, almuerzo o cena. El valor de cada comida está parametrizada en la configuración del sistema.

        Al pie de esta lista habrán tres totales: total en desayunos, total almuerzos, total cenas y total comidas.

    1.7 Otros gastos (peajes, parqueos, ferrys, etc.)
        1.7.1 Similar al hospedaje, una lista que se podran agregar y quitar nuevos gastos. Cada item de gasto debe tener los siguientes campos:
            1.7.1.1 Tipo de gasto (combobox de los tipos de gastos en el sistema). Este, tendrá la opción de `otros` la cuál permite poner cualquier otro gasto
            1.7.1.2 Descripción (texto, 100 caractéres)
            1.7.1.3 Monto (moneda, mayor a cero)

2. SI EL VIAJE ES DE MENOS DE UN DÍA

    2.1 Combobox con los autos registrados de la empresa

    2.2 Fecha de viaje
        2.2.1 Fecha y hora de salida

    2.3 Motivo del viaje
        2.3.1 Podrá seleccionar de un combobox los motivos de viaje registrados en el sistema.

    2.4 Nivel de Fluidos y Odómetro
        2.4.1 Nivel de Combustible (F, 3/4, 1/2, 1/4, E)
        2.4.2 Nivel de Aceite del Motor (F, 3/4, 1/2, 1/4, E)
        2.4.3 Nivel de Agua del Radiador (F, 3/4, 1/2, 1/4, E)
        2.4.4 Nivel de Líquido de Frenos (F, 3/4, 1/2, 1/4, E)
        2.4.5 Nivel de Líquido Hidráulico (F, 3/4, 1/2, 1/4, E, N/A)
        2.4.6 Odómetro (numérico, mayor a 0)

        Si algún campo está por debajo de la mitad, debe quedar registro en el pdf generado.

    2.5 Kit de Emergencia
        2.5.1 Llanta de repuesto (Sí/No)
        2.5.2 Triquet/Gato hidráulico (Sí/No)
        2.5.3 Triángulo de señalización (Sí/No)
        2.5.4 Extintor recargado (Sí/No)

        Estos campos no restringen nada, únicamente sirven para registro.
    
    2.6 Inspeccion de carrocería y defectos mecánicos
        2.6.1 Una lista donde se pondrán agregar y quitar defectos encontrados. Cada item debe tener los siguientes campos
            2.6.1.1 Tipo de defectos (combobox de los tipos de defectos en el sistema). Este, tendrá la opción de `otros` la cuál permite poner cualquier otro gasto. Si se selecciona la opción de `otros` mostrará un textfield
                2.6.1.1.1 Descripción (texto, 100 caractéres)
            2.6.1.2 Imagen. Abre la cámara para tomar una foto
```

### PDF Generado

Este PDF, seguirá la misma línea de generación de PDF que usan los `vales de arte`, acá cambiaremos "VALE DE ARTE" por reporte "SOLICITUD DE VIÁTICOS". Ajusta el tamanio de letra para que ocupe el mismo espacio que lo hace actualmente el título "VALE DE ARTE". Puedes comparar visualmente.  
  
La primer sección contendrá la **información del usuario** que realiza la solicitud de viáticos, los campos son: Solicitante (nombre y apellido), Puesto (rol) y Licencia (número de licencia y tipo). Estos datos se obtienen del sistema.  
  
La segunda sección contendrá los **información del vehículo**: Vehículo (marca, modelo y año), Placa, No. Póliza del seguro, Combustible (Gasolina o Diésel) y Empresarial (Sí/No).  
  
La tercera sección contendrá la **información del viaje**: 
* Si el viaje es *mayor a un día* -> **información del viaje**: fecha salida, fecha regreso y motivo del viaje 
* Si el viaje es *menor a un día* -> **información del viaje**: fecha y hora de salida, y motivo del viaje
  
Si el viaje es de duración *mayor a un día*, la cuarta sección contendrá la siguiente información:
* **Ruta y kilometraje `km totales`**: En una lista cada fila tendrá: {no. de tramo} {origen} -> {destino} {horas de ese tramo} {km de ese tramo} 
* **Combustible `monto total`**: ({km totales} / {rendimiento}) X {precio por galón} = {costo de gasolina}
* **Depreciación `monto total`**: {km totales} X {depreciación por km} = {costo por depreciación}. Esta subsección *no aparecerá* si el carro Sí es empresarial.
* **Hotel y hospedaje `monto total`**: En una lista cada fila tendrá: {no. de hotel }{nombre hotel} {lugar} {no. noches} {valor noche} {total}
* **Comidas `monto total`**: En una lista cada fila tendrá: {no. de comidas} Desayunos/Almuerzos/Cena X {precio de comidas} = {total de esa comida}
* **Otros gastos `monto total`**: En una lista cada fila tendrá: {tipo de gasto} {descripción} {monto individual}
* **TOTAL SOLICITADO `suma de todos los montos`**: Esta subsección será una caja de borde negro con el título de la subsección y la sumatoria en negrita.
Todas estas son subsecciones, algunas subsecciones contienen algún cálculo, el título del a subsección está alineado a la izquierda y el cálculo está alineado a la derecha. El formato de representación usado es: **nombre sección `cálculo`**. Dicho calculo es opcional, quiere decir, habrán subsecciones que lo tendrán y otras que no.  
  
Si el viaje es *menor a un día*, la cuarta sección contrendrá la siguiente información:
* **Nivel de Fluidos**: En una lista cada fila tendrá: {Nombre fluido} {nivel}. El {nombre fluido} va alineado a la izquierda; y el {nivel} va alineado a la derecha. Por cada fluido marcado como 1/4, pintar el texto "1/4" en amarillo. Por cada fluido marcado como E, pintar el texto "E" en rojo.
* **Lectura odómetro `lectura registrada`**
* **Kit de emergencia**: En una lista cada fila tendrá: {item} {si/no}. Por cada item en No, colocar el "No" en rojo.
* **Defectos Encontrados `SÍ ({no. defectos})/NO`**: En una lista cada fila tedrá: {item} {descripción} {correlativo imagen}. Recordar, que la {descripción} aparecerá solo para los defectos marcados como `otros`. Para el cálculo, si sí hay defectos encontrados marcar las letras de "Sí" en rojo.
* **Imágenes**: Mostrar las imágenes con su correlativo por debajo. Máximo 3 imágenes por fila. Cada fila ocupa en tamanio del ancho de la hoja. Esta sección se coloca en una nueva hoja.
  
Exisitirá una quinta sección la cuál se llama **Salvedades**. Esta sección aparecerá solo si hay salvedades, las cuales se mencionan en **Restricciones**. Al final de la sección, colocar el texto con subrayado doble: "TOMAR EN CUENTA".  
  
La sexta sección tendrá dos campos para firmar: solicitante (poner el nombre del registro en el sistema) y administración (solo poner el título de adiministración). Como ejemplo podés usar los campos que usaron para las firmar de los reportes de los vales de arte.

## Gestiones

Similar al buzón de vales de arte para el gerente/administrador. Lo que se busca con esta vista es listar todas las solicitudes de viáticos para visualizarlas. Esta vista solo será visible para los usuarios que tengan el permiso de `viaticos.gestionar`.  
  
En el encabezado tendremos:
* Un selector de ventana de tiempo (usaremos el mismo que se usa para los vales de arte y reportes; este será un componente que usaremos a lo largo del portal)

La lista tendrá las siguientes columnas:
* **Correlativo**: Correlativo generado por el sistema
* **Fecha creación**: Fecha y hora registrada por el sistema en el momento que se creó la solicitud
* **Fecha viáticos**: Marco de fechas o fecha que se solicitan los viáticos
* **Tipo**: <1 Día o +1 Día
* **Estado**: Pipeline de estados (similar al de vales de arte)
* **Acciones**: Para esta vista/pestania tendremos las acciones:  
    - `ver`: ícono del ojo para ver el pdf generado (más detalles del PDF en **PDF a generar**) de la solicitud de viáticos; posterior a que la solicitud haya sido liquidada también se podrá ver los recibos/facturas adjuntos a la liquidación.
    - `autorizar`: ícono de doble palomita color verde. Esta acción aparecerá solo a los usuarios que tengan el permiso de `viaticos.autorizar`. Mostrará un modal de confirmacion: Estas seguro que deseas autorizar esta solicitud de viáticos?
    - `rechazar`: ícono de una equis color rojo. Esta acción aparecerá solo a los usuarios que tengan el permiso de `viaticos.autorizar`. Mostrará un modal de rechazo: Estas seguro que deseas rechazar esta solicitud de viáticos? Usa el mismo disenio de modal que se usa para el rechazo de los vales de arte por parte del `supervisor`.
    - `liquidar`: Esta acción se habilitará **solo** para los viáticos de viajes mayores a 1 día y se habilita una vez terminado el período de viaje; además, que solo los usuarios con el permiso `viaticos.liquidar` podran usarla. Esta acción abrirá un modal el cuál permitirá ver las fotos/pdf de facturas que adjuntó el solicitante de los gastos realizados durante el viaje. El propósito de este modal, es que contabilidad pueda ver la cantidad total que se solicitó el solicitante, ver cuánto debería liquidar y cuánto liquidó. Ellos realizarán el cálculo de manera externa, esto solo sirve para tener la información centralizada. Como se puede intuir, en este mismo modal siempre se puede abrir pdf generado para la solicitud de viáticos. Esta acción es totalmente diferente a la liquidación que hace el solicitante en su vista.

## Configuración

Esta vista contendrá subpestanias en una vista horizontal, donde cada pestania servirá para configurar las tablas catálogo del sistema. Identifica todo aquello que se puede evitar configurando en vez de hardcodeando, y agrega una pestania a esta vista. Esta vista solo será visible para aquellos que tienen el permiso `viaticos.configurar`.

# Restricciones

* Cada persona que pueda solicitar viáticos, deberá tener una licencia registrada; de lo contrario, no podrá solicitar viáticos

* La licencia tiene que estar vigente ANTES de solicitar viáticos; de lo contrario, no podrá crear una nueva solicitud de viáticos de ningún tipo

* La licencia es limitante para el tipo de auto (placa) que pueda manejar. Este parámetro tiene que ser configurable, debido a que depende por el país las reglas que aplican. En guatemala, es muy marcado el tipo de placas que te permiten manejar según el tipo de tu licencia. En El Salvador, no basta solo con el tipo de placa, el tonelaje manda mucho y en otras ocasiones los pasajeros. Por lo que las limitaciones de los tipos de licencias deben ser configurable por país

* Al momento de seleccionar el tiempo de viaje (viajes mayores a 1 día) debe salir una advertencia por si la licencia vence durante el trayecto. El sistema permitirá continuar posterior a la advertencia. Esta salvedad queda marcada en el pdf generado, la salvedad aparecerá como: `La licencia vencerá durante el trayecto`.

* NO se puede tramitar una solicitud de viáticos donde se traslapen las fechas de una solicitud activa. Quiere decir, si alguien mete una solicitud de viáticos para el 9 Nov al 11 de Nov. No se puede tramitar una del 10 Nov para el 12 Nov.

* No se puede crear una solicitud de viáticos para fechas pasadas 

* Si una solicitud de viáticos, no ha sido autorizada para la fecha en que debe dar inicio el viaje, esa solicitud se vuelve imposible de autorizar, ya que es inválida y se tiene que modificar. Esto **quiere decir** que la acción de `modificar` y `dar de baja` solo existen para las solicitudes que están esperando autorización, han sido rechazadas o han vencido.

* Para los viajes de menos de un día, no se podrá sacar ningún auto si este tiene vencida la tarjeta de circulación

* Al momento de seleccionar el tiempo de viaje (viajes mayores a 1 día) debe salir una advertencia por si la tarjeta de circulación vence durante el trayecto. El sistema permitirá continuar posterior a la advertencia. Esta salvedad queda marcada en el pdf generado, la salvedad aparecerá como: `La tarjeta de circulación vencerá durante el trayecto`.

* Si el carro tiene vencida la póliza del seguro o vence dentro de la ventana de tiempo del viaje, mostrar una advertencia. Esto no restringe la solicitud de vehículos, sin embargo, esta salvedad queda marcada en el pdf generado. La salvedad aparecerá como: `El seguro vencerá durante el trayecto`.  
  
Las salvedades van registradas en el pie del PDF generado en la sección de **SALVEDADES**.