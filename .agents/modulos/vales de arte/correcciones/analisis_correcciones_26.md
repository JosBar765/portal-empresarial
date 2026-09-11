# Archivo No. 26 de correcciones

1. Cambios al `dashboard de gerencia`, quiero que funcione igual que el contador de atrasados.
    - Mantenemos el funcionamiento del contador de "Recibidos" y "En Progreso"
    - Cuando presionemos "Modificados" muestra el número de vales modificados de la búsqueda de "Recibidos" o "En Progreso"
    - Mismo funcionamiento que el de atrasados, lo mismo para el label  
    Cambiemos el orden también: Total vales, recibidos, en progreso, modificados y atrasados

2. Precisamente el dashboard de gerencia **no** se actualiza en tiempo real.
    - Si no tengo nada seleccionado, solo que actualize el total de vales
    - El contador de vales atrasados también debe actualizarse en tiempo real
    - Si ya tengo seleccionado el de los recibidos o en progreso, solo que actualice el número
        * Esto también actualizará el número de atrasados y modificados derivados de la selección (recibidos o en progreso)

3. Sigue habiendo confusión con el proceso de vales a fusionar. El flujo de vales a fusionar es el siguiente:
    - Asesor crea un vale (3 talleres)
    - Supervisor autoriza creación
    - Los encargados de Talleres reciben el vale de arte
        * Diseño
        * Diseño 3d
        * Protextil
    - los encargados de Talleres realizan y aprueban la propuesta
        * Independientemente si lo hacen ellos mismo o si siguen el flujo de revisión de las propuestas realizadas por los técnicos
    - El encargado de fusión fusiona los vales de arte en una sola propuesta
        * Para este caso, es el encargado de diseño que hace eso
    - Asesor recibe la fusión para el vale de arte
    - Asesor solicita modificación (taller de protextil)
    - Supervisor autoriza modificación
    - El encargado de protextil recibe la modificación
    - El encargado realiza y aprueba la propuesta <-- OJO!
        * Independientemente si lo hacen ellos mismo o si siguen el flujo de revisión de las propuestas realizadas por los técnicos  
      
    Acá es donde ocurre el problema, recordemos que el vale original tuvo sus 3 propuestas. Por lo tanto, cuando protextil realize la modificación, el vale de arte regresa a `APROBAR Y FUSIONAR`, esto es debido a que el encargado de fusionar fusiona las propuestas originales y la modificación. Esto pasa siempre que hay una modificación que tuvo 2 o más propuestas iniciales (antes de la fusión, digamos).  
      
    Cuando no aplica esto de volver a fusionar. Supongamos que un vale de arte llego desde un inicio para un solo taller. Luego, se modifica para ese único taller. Cuando se mande la modificación pasa directo al asesor, no hay nada que fusionar.  
      
    Pero, si el vale original calló para 2 o más talleres. Al momento de modificar, el encargado de fusionar si tiene que fusionar las modificaciones junto con las propuestas originales.  
  
  Actualmente, el modal de fusionar y aprobar sí debería funcionar. El código y la lógica está bien, pasa que no lo muestra para el siguiente caso:
    - Vale entro para 3 talleres
    - Vale siguió su flujo normal
    - Vale aprobado para modificación para 1 taller
    - Se manda la modificación de parte de ese taller
    - La propuesta que recibe el asesor es la modificación meramente
        * Acá, que pasó con las propuestas originales?
        * El modal de aprobar y fusionar debería mostrar las propuestas originales y las modificadas con asteriscon tal y cómo lo hacía antes  
      
Esto se dió por una mala interpretación de la corrección 3 del archivo de correcciones 24. Ahora ya te expliqué como funciona realmente. Si tenes alguna duda siempre para este cambio, preguntame, no supongas  
  
Recordá, que para estos cambios siempre apegarte a las reglas del proyecto