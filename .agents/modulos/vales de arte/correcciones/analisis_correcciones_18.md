# Archivo de correcciones No.18

1. El administrador administra todas las tiendas, no hay sentido que lo relaciones con las tiendas. Deduje esto porque en la vista de administrar personal me sale el administrador como personal de la tienda. Eso no es así, el administrador es administrador. Pero que no salga como personal de la tienda, mucho menos que se pueda agregar o quitar a alguna tienda.

2. Quitemos la pestaña de `Actividad de usuario` y borra los archivos y/o funciones que participen en su funcionalidad o hagan referencia a ella, campos de la base de datos, etc. No funcionó como yo esperaba y la verdad no me es de utilidad

3. En la pestaña de `Gestionar tiendas` en el modal de `Nueva tienda`. Quiero que el departamento que me salga en el combobox de departamento, sea únicamente los disponibles según el país que eliga. Actualmente, puedo crear una tienda en El Salvador en el departamenteo de Ventas Premia Z13. Cuando ese departamento es exclusivo de Guatemala.   
En este mismo  formulario, quiero que el comobox de subdivisión se pueda elegir una subdivisión o crear una nueva. Con dos radiobuttons, quiero que el administrador o pueda seleccionar una subdivisión existente o pueda crear una nueva.
De esta misma vista quitemos ambos contadores: Tiendas Activas y Tiendas Inactivas

4. En la pestaña de `Roles y Permisos` vamos a quitar el label que dice: "Activo" o "Inactivo". Lo que haremos para indicar si un rol está activo o inactivo será usando el ícono de candado que actualmente activa/desactiva el rol. 
    - Cuando el rol esté activo --> El candado estará desbloqueado y de color verde
    - Cuando el rol esté inactivo --> El candado estará bloqueado y de color rojo  
De esta misma vista quitemos ambos contadores: Roles Configurados y Permisos Disponibles

5. Hay problemas con las relaciones con respecto a las diversas entidades del sistema, y el problema creo que viene porque usamos una sola entidad `Usuario` para todas las demás. Se me ocurre crear las siguientes entidades y relaciones para solucionar mis problemas. Porque actualmente el sistema no está alineado con el negocio:

Dejemos la entidad `usuario` con los campos: id, nombre, email, password_hash, rol_id, creado_en, actualizado_en, intentos_fallidos y bloqueado_hasta
  
Creemos una nueva entidad `asesor` con los campos: id_usuario (1:1), tienda_id, telefono. Esta entidad se puede crear exclusivamente con un rol de `asesor comercial`
    - Con esta nueva entidad ya podríamos realizar una *tabla para relacionar las tiendas con el personal*. Actualmente, si un asesor trabaja para MTC por ejemplo, también lo puedo asignar a MTS. Y en el negocio esto NO es posible, el asesor trabaja para una sola tienda. Una vez esté asignado a una tienda, no puede asignarse a trabajar a otra. Se pueden realizar cambios, pero para esto se tiene que desasignar primero de la tienda donde trabaja y luego asignarlo a la nueva tienda.

Creemos una nueva entidad para el `supervisor` con los campos: id_usuario (1:1), telefono. Esta entidad se puede crear exclusivamente con un rol de `supervisor`.
    - El supervisor puede supervisar varias tiendas, y una tienda puede ser supervisara por varios supervisores. Esta sería una relación de muchos a muchos. Crea una *tabla donde se relacionen los supervisores y las tiendas*. Y de esta nueva tabla sería de donde salen las "Tiendas supervisadas". 
    - Estas tiendas se pueden asignar y desasignar. Esta función estaría en el modal de `editar usuario` de la pestaña de `gestionar usuarios`. Actualmente se encuentra la función, pero deduzco que está mal implementada debido al tema de las relaciones.
    - El supervisor supervisa la tienda, no el departamento ni la subidivisión. La tabla de *supervisor_asignaciones* está mal interpretada

Los `encargados de taller` son: `encargado de taller de diseño`, `encargado de taller de diseño 3d`, `encargado de taller de protextil`, `encargado de taller de diseño local`. Podemos usar la misma entidad de usuario ya que no cuentan con campos especiales.  
    
Ahora, para solucionar que los encargados de taller pertenezcan a una sola tienda, primero, crearemos la tabla *empresas* con lo siguientes datos:
    ```text
    |NOMBRE|PAIS|  
    Munditrofeos, S.A.|Guatemala| 
    Premia, S.A.|Guatemala|
    Premia San Salvador|El Salvador|
    Premia Express Santa Ana|El Salvador|
    emia Express San Miguel|El Salvador|
    Premia Express Escalón|El Salvador|
    Premia Express Comayagua|Honduras|
    Premia Tegucigalpa|Honduras|
    Premia San Pedro Sula|Honduras|
    Premia Express Managua|Nicaragua|
    Premia Express León|Nicaragua|
    Premia San Jose|Costa Rica|
    Trofex San Juan|Guatemala|
    Trofex Zona 3|Guatemala|
    Trofex Coban|Guatemala|
    Trofex Petén|Guatemala|
    Trofex Puerto Barrios|Guatemala|
    Trofex Chiquimula|Guatemala|
    Trofex Jutiapa|Guatemala|
    Trofex San Marcos|Guatemala|
    Trofex Chimaltenango|Guatemala|
    Trofex Escuintla|Guatemala|
    Trofex Huehuetenango|Guatemala|
    Trofex Mazatenango|Guatemala|
    Trofex Villa Nueva|Guatemala|
    Trofex Xela|Guatemala|
    ```  
Solo tienes que agregar el campo de ID para las empresas y usar el id establecido para los países en la columna de PAIS.

    Modificaremos la tabla *tienda* para que quede de la siguiente manera:
    ```text
    |ID|CÓDIGO|EMPRESA_ID|DEPARTAMENTO_ID|SUBDIVISION_ID|
    ```  
Esta modificación ya la hice en el `seed.sql`, dejé un placeholder (x) para que pongas el id de la empresa. Recordá que tenes que modificar el `schema.sql` también.  
       
Ya con esto, ya podemos realizar las relaciones de encargados con las tiendas usando la siguiente tabla *encargado_tienda*:
    ```text
    |TALLER_ID|TIENDA_ID|
    ```  
  
Y pues actualmente la tabla *taller* ya incluye el ID del encargado.
  
Con esto, ya podemos relacionar a los tres talleres de MTC y MTS, y los talleres de diseño local de cada tienda. Y las tiendas, se nombrarán usando la siguiente tupla: {EMPRESA}, {SUBDIVISIÓN}. Entonces, en cualquier lado donde haya que nombrar a las tiendas lo harás de esa manera.
  
Para este punto surgirá la duda que pasa con el rol de `asistente`. Para este, no crees una nueva entidad, ya que en términos de negocio solo hay uno y trabaja físicamente en Munditrofeos (MTC y MTS). Por lo que, solo será una cuenta de usuario
  
Los `técnicos` no tiene que ser una entidad por aparte, usaremos la misma tabla de usuario. Pero, creemos una tabla para relacionar *el taller con sus técnicos*. Actualmente un técnico puede trabajar en dos tallares diferentes y esto no es así, porque el técnico trabaja físicamente en la tienda. Con esta nueva tabla nor ahorramos ese error

Lo administradores solo tienen que ver con el sistema, no tienen nada que ver con las tiendas. Actualmente, el sistema me muestra al administrador como empleado de la tienda, eso no tiene ninguna relación. El administrador ADMINISTRA el sistema en general.