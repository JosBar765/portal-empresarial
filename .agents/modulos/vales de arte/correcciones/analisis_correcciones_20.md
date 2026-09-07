# Archivo correcciones No. 20

## Pestaña `Gestionar usuario` de la vista `Administrador`

1. Al momento de crear un nuevo usuario, la creación no se hace mediante una transacción. Lo sé porque me pasa lo siguiente: quiero crear un nuevo usuario para el encargado del taller de diseño. Como esto está restringido, me da error, pero, si bien no creo la relación sí creo el usuario. No quiero eso. Asegurate que con todos lo roles se hace una verificación si se puede crear o si se puede asociar antes de crear el usuario. 

2. La vista de gestión de usuarios solo sirve para **CREAR USUARIOS Y MODIFICAR SUS DATOS PERSONALES**, quitame toda la lógica ahí de asignación a tiendas o resposabilidades del modal de nuevo usuario. El modal de editar información no permitirá el cambio de roles, solo que permita crear y modificar la información del usuario

3. El ícono de candado, usado por la acción que activa y desactiva un usuario, aparece cerrado. Debe aparecer de color rojo para los usuarios bloqueados. De lo contrario, el candado debe estar abierto y de color verde.

4. Experiencia de usuario, asegurate que cuando abra un combobox, se cierren los demás. Actualmente, puedo tener todos los comobox abiertos si deseo, eso molesta. Aplicalo para todo combobox de la vista.

5. El formulario de `nuevo usuario` en la pestaña de `gestionar usuarios` le hace falta el combobox de los países para los códigos telefónicos

## Pestaña de `GEstionar Tiendas` de la vsita `Administrador`

1. En la acción de `editar personal` me es posible asignar un encargado de taller de diseño local a alguna tienda. Estos encargados trabajan físicamente en una tienda, por lo que, es imposible que el encargado del taller de diseño de SSV pueda trabajar en SJO.

2. En la acción de `editar personal` que los combobox no muestren al personal que NO puedo agregar. Ejemplo: la asesora de ventas Gema Cruz ya está asignada a MTS, entonces cuando entre a gestionar el personal de SSV NO debería poder ver a Gema Cruz. Lo mismo para todos los roles. Que solo me aparezcan los agentes desasignados y los nuevos, ya que, al crear un nuevo usuario estará sin una asignación.

## Relaciones

Mira, seguis mal. La tabla de usuario no debe tener el id de la tienda.
    - El asesor si tiene el campo de tienda_id
    - El supervisor si tiene campo tienda_id
    - El encargado está referenciado directamente en la tabla de taller
    - El taller ya tiene su tabla de los técnicos
No tiene sentido la columna tienda_id en la tabla de usuario  

Además, hay una tabla llamado `encargado_tienda`, eso para qué sirve?  

Tampoco estas entendiendo que diseño local es el **único** taller que existe para **todas** las tiendas que no sean Munditrofeos. Según gerencia, no están en sus planes a corto plazo de poner más talleres para las tiendas. Incluso, hay tiendas que ni tienen taller de diseño, por ejemplo los Trofex, ninguno tiene su taller de diseño local. Por lo que, no es coherente que el sistema me deje asociar el encargado de diseño local de SSV en la tienda de CMY. Eso es imposible.  

También con el gerente, el gerente es similar al administrador. Ellos no están asignados a una o más tiendas. Ellos consultan métricas desde su dashboard de **todas** las tiendas. Es incoherente querer asignar tiendas a los gerentes, cuando ese trabajo ya lo hace el supervisor. Quita esa relación y que no se pueda asignar un gerente a una tienda desde la pestaña de `Gestionar tiendas`.

## REGLAS GENERALES

No me andes comentando cada cambio que haces, me estas llenando el código de comentarios basura y se ve desordenado cualquier archivo que tú tocas. Para esto está la carpeta de `.agents\documentacion\` ahí creas el archivo .md donde documentes los cambios que andas haciendo.