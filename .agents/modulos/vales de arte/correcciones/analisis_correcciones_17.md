# Archivo de correcciones No.17

1. Actualmente, en el buzón de los `ENCARGADOS DE TALLER` modificaremos una jerarquía. Sobre el vale de más alta jerarquía de agrupación, pondremos los vales de estado `ASIGNADOS`, y sobre ellos pondremos los `EN PROCESO` y `EN PAUSA`. En caso, haya vales de ambos estados `EN PROCESO` y `EN PAUSA` irán  arriba los vales `EN PROCESO`. Algo así:  
    - `EN PROCESO`
    - `EN PAUSA`
    - `ASIGNADOS`

2. En la pestaña `Roles y Permisos` del sidebar del **administrador**, es importante que los permisos que se editen se actualizen en tiempo real. Quiere decir, si a alguien le quito el permiso de fusionar vales de arte, en ese mismo rato le deben desaparecer los vales `APROBADOS POR TALLERES`. Esta actualización en tiempo real de los permisos es importante.

3. En la pesta;a `Actividad de usuarios` del sidebar del **administrador**, es importante que se actualize en tiempo real. El estado es lo más importante, ya que, haciendo pruebas si dejaba inactiva una sesión un tiempito si cambiaba a inactivo. Pero, cuando presionaba la ventana o algo, no cambia a en línea. No sé cuál es el criterio de inactividad y en línea.

4. En la pestaña de `Gestionar usuarios`, el filtro de `Tiendas` sea:
    - Menú de tipo desplegable vertical que abra submenús hacia la derecha en un nivel 2
    - Incluir indicadores visuales (coo felchas '>') en los elementos que contengas un submenú
    - Cambios de estado visuales claros (hover/focus) con resatltado para el ítem activo
    - Código limpio, semántico (`<nav>`, `<ul>`, `<li>`) y accesible  
      
    La estructura será la siguiente:  
    - Guatemala
        - {código_tienda} - {nombre_tienda}
        - ...
        - Trofex R1
            - {código_tienda} - {nombre_tienda}
            - ...
        - Trofex R2
            - {código_tienda} - {nombre_tienda}
            - ...
    - El Salvador
        - {código_tienda} - {nombre_tienda}
        - ...
    - Honduras
        - {código_tienda} - {nombre_tienda}
        - ...
    - Nicaragua
        - {código_tienda} - {nombre_tienda}
        - ...
    - Costa Rica
        - {código_tienda} - {nombre_tienda}  
        - ...

    Nota cómo he agrupado las tiendas Trofex (En sus departamentos de Ruta 1 y Ruta 2).

5. En la pestaña de `Gestionar usuarios`, el filtro de `Roles` sea:
    - Menú de tipo desplegable vertical que abra submenús hacia la derecha en un nivel 2
    - Incluir indicadores visuales (coo felchas '>') en los elementos que contengas un submenú
    - Cambios de estado visuales claros (hover/focus) con resatltado para el ítem activo
    - Código limpio, semántico (`<nav>`, `<ul>`, `<li>`) y accesible 

    La estructura será la siguiente:  
    - Administrador
    - Gerencia
    - Supervisor
    - Asesor de Ventas
    - Encargados de taller
        - Encargado de taller de Diseño
        - Encargado de taller de Diseño 3d
        - Encargado de taller de Protextil
        - Encargado de taller de Diseño Local
    - Asistente
    - Técnico

6. En la pestaña de `Gestionar usuarios`, quiero que implementes exactamente el mismo menú del **punto número 4** en el modal de `Nuevo Usuario` de esta misma pestaña. Este menú reemplaza los comobox de país y tienda. Solo quedaría el nuevo menú para seleccionar al tienda.

7. Implementar exactamente los mismos menús para filtrar los usuarios de los **puntos 4 y 5** en la pestaña de `Actividad de Usuarios`

8. En la pestaña de `Actividad de Usuarios`, aparecen los contadores, pero no implmentan la funcionalidad de filtro. Haz que actúen como filtro los contadores de:
    - En línea ahora
    - Inactivos

9. El modal de historial, que aparece con la acción `Historial` de cualquiera de las vistas de los vales de arte, se debe actualizar también en tiempo real. Actualmente no lo hace.

10. Para todas las vistas, no quiero que me saque de donde estoy cuando recargo la página. Ejemplo:  
    - Soy administrador y me encuentro en la pestaña de `Actividad de usuarios`
    - Recargué la página (voluntaria o involuntariamente)
    - Regresé a la primer pestaña del sidebar <-- OJO!  
Esto es lo que NO quiero, si yo andaba en `Actividad de usuarios`, cuando recargue quiero seguir ahí. Esto también aplica para el sidebar de los técnicos por ejemplo: si recargo estando en `Trabajo realizado`, cuando recargue sigo ahí. Asegurate que esto se cumpla para todas las vitas, no importa el rol

11. Hagamos que el rol de `ADMINISTRADOR` sea imposible de **desactivar** y **modificar** desde la pestaña de `Gestionar Usuarios`. Solo que aparezca en la lista, pero que no se pueda realizar ninguna acción sobre él.

12. Nueva *regla de negocio*, para los encargados de taller de: diseño, diseño 3v y protextil, solo puede haber una persona asignada a ese rol. Ya NO se pueden realizar asigaciones a ese rol.

13. **Recuerda** la relación de los encargados de taller de diseño, diseño 3d y protextil. Este personal es **solo y exclusivamente** de las tiendas MTC y MTS. **NO** pueden asignarse a otra tienda. Crea la restricción.

14. En la pestaña de `Gestionar tiendas`, el modal de la acción `Gestionar personal` me muestra todo el personal sin clasificar. Me gustaría que salieran agrupados de la siguiente manera:
    - Gerencia
    - Supervisor
    - Asesor de Ventas
    - Encargado(s) de taller
    - Asistente
    - Técnico  
      
    En ese mismo modal, cambiemos el label "CATEGORÍA" por "TIPO PERSONAL".

15. En la pestaña de `Gestionar tiendas`, quitemos el botón de `Ordenar` e implementemos exactamente el mismo filtro del **punto número 4**

