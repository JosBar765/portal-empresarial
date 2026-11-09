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
3. 
  
# Permisos

Como el propósito de este módulo es que ciertas personas puedan solicitar viáticos, es necesario que los permisos sean atómicos y no dependan del rol. Quiere decir, los permisos controlarán vistas o acciones las cuáles serán independientes al rol al cual se le asigne el permiso. En caso, para una vista sea requerida un permiso, el acceso será denegado si el usuario que intenta acceder a la vista no tiene el permiso. Lo mismo pasa con el módulo. Puedes ver cómo funciona la plataforma actualmente para aquellos módulos los cuáles restringen su acceso con el permiso.  
  
- Es necesario un permiso único que permita **ver y usar** el módulo. Muchos módulos de la plataforma actualmente tienen el permiso `{modulo}.ver`; para este caso, considero que el permiso `viaticos.ver` es más que suficiente y que dicho permiso controle si el módulo en visible en el dashboard de módulos de la plataforma y su interacción con el mismo (uso de la pestania ***Solicitudes***).  

- Otro permiso será `viaticos.supervisar`. Este permiso solo permitirá **ver** la solicitud de los viáticos y el estado en el que se encuentran en una vista tipo lista; **no permite** autorizar ni rechazar (pestania ***Gestiones***, incluye únicamente la acción de ver).  
   
- Otro permiso será `viaticos.autorizar`. Este permiso permitirá **ver** las solicitudes de viáticos enviadas para su autorización, además de la **autorización** y **rechazo** de la solicitud de viáticos (pestania ***Gestiones***, incluye la acción de ver, autorizar y rechazar).  
  
- Otro permiso será `viáticos.gestionar`. Este permiso permitirá **ver y usar** la pestania de ***Configuración***.
  
Estos permisos son tentativos, quiere decir, en el camino puede surgir algún otro permiso que necesitemos delimitar. La regla de los permisos es que controlen las acciones que realizan los usuarios, y que ningún usuario podrá hacer alguna acción que requiera un permiso en específico. Los permisos tienen que ser atómicos y **totalmente independientes**, no deben ser hardcodeados o depender de código hardcodeado. La finalidad, es que si surgen nuevos roles se les pueda asignar dicho permiso de manera libre, y que con eso baste para que pueda interactuar con la acción.

# Vistas

A continuación, te detallaré cómo quiero que sean las vistas y qué contienen cada una de ellas. Cada vista está amarrada a un permiso el cuál se detalló en: **Permisos**.

## Solicitudes

Vista similar al buzón de los asesores en el módulo de `vales de arte`. Lo que se busca con esta vista es listar las solicitudes realizadas durante la ventana de tiempo seleccionada.   
  
En el encabezado tendremos:
* Un selector de ventana de tiempo (usaremos el mismo que se usa para los vales de arte y reportes; este será un componente que usaremos a lo largo del portal)
* Un botón para crear una nueva solicitud de viáticos
  
Luego, tendremos la lista de las solicitudes que tendrá las siguientes columnas: 
* **Correlativo**: Correlativo generado por el sistema
* **Fecha creación**: Fecha y hora registrada por el sistema en el momento que se creó la solicitud
* **Fecha viáticos**: Marco de fechas o fecha que se solicitan los viáticos
* **Tipo**: <1 Día o +1 Día
* **Estado**: Pipeline de estados (similar al de vales de arte)
* **Acciones**: Para esta vista/pestania tendremos las acciones:  
    - `ver`: ícono del ojo para ver el pdf generado de la solicitud de viáticos; posterior a que la solicitud haya sido liquidada también se podrá ver los recibos/facturas adjuntos a la liquidación.
    - `modificar`: ícono de un engranaje que permite corregir campos de la solicitud; genera un pdf que sobreescribe al anterior
    - `dar de baja`: ícono de bloquear (círculo con línea atravesada); borra el registro de la solicitud y el pdf generado
    - `liquidar`: Esta acción se habilitará **solo** para los viáticos de viajes mayores a 1 día y se habilita una vez terminado el período de viaje. Esta acción abrirá un modal el cuál permitirá ir adjuntando fotos/pdfs de facturas de los gastos durante el viaje (más detalles del modal de liquidación en **Modal de Liquidación**). Posterior a esto, el usuario que solicitó los viáticos puede "liquidar" la solicitud.  

En el encabezado de esta lista, agregar un buscador que permita buscar por: correlativo o fecha de viáticos.  
  
La lista tendrá todas las solicitudes, las que siguen en proceso y las liquidadas. Esta lista se ordenará según los estados automáticamente.

### Modal de liquidación

Este modal permitirá ir agregando facturas a modo de liquidar todo aquello que solicitó en sus viáticos. Quiere decir, si los viáticos fueron para 4 noches fuera, tendrá que liquidar las 4 facturas de las 4 noches de hotel. No puede agregar más. Lo mismo para los vauchers de gasolina, peajes, ferrys, etc. Lo único que no se liquida es los tiempos de comida.  
  
A lo largo de este modal, no solo el usuario podrá ver cuanto le falta por liquidar, si no, también lo que va liquidando. Cada item de liquidación tendra los siguientes campos:
1. **Qué está liquidando**: Un combobox que tenga lo que tenga que liquidar (hotel, gasolina, peaje, ferry, otro - campo de texto libre)
2. **Cuánto está liquidando**: Cifra en quetzales
3. **Foto/Archivo**: Le permite tomar una foto a algún voucher/factura, subir una imágen o documento .pdf

# Restricciones

1. Cada persona que pueda solicitar viáticos, deberá tener una licencia registrada; de lo contrario, no podrá solicitar viáticos

2. La licencia tiene que estar vigente ANTES de solicitar viáticos; de lo contrario, no podrá crear una nueva solicitud de viáticos

3. Al momento de seleccionar el tiempo de viaje (viajes mayores a 1 día) debe salir una advertencia por si la licencia vence durante el trayecto. El sistema permitirá continuar posterior a la advertencia

4. La licencia es limitante para el tipo de auto (placa) que pueda manejar. Este parámetro tiene que ser configurable, debido a que depende por el país las reglas que aplican. En guatemala, es muy marcado el tipo de placas que te permiten manejar según el tipo de tu licencia. En El Salvador, no basta solo con el tipo de placa, el tonelaje manda mucho y en otras ocasiones los pasajeros. Por lo que las limitaciones de los tipos de licencias deben ser configurable por país

5. NO se puede tramitar una solicitud de viáticos donde se cruzen las fechas de una solicitud activa. Quiere decir, si alguien mete una solicitud de viáticos para el 9 Nov al 11 de Nov. No se puede tramitar una del 10 Nov para el 12 Nov.

6. No se puede crear una solicitud de viáticos para fechas pasadas 

7. Si una solicitud de viáticos, no ha sido autorizada para la fecha en que debe dar inicio el viaje, esa solicitud se vuelve inválida y se tiene que modificar