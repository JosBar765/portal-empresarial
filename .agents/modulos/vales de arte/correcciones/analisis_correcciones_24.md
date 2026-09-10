# Archivo de correcciones No. 24

1. Actualmente, en el modal de `autorizar creación` del vale de arte me permite "Autorizar" o "Cancelar", quiero que agreguemos una tercera opción que se llame "Rechazar". Lo que hará este botón de este modal, será borrar el vale de arte de la base de datos y borrar las imágenes y pdf generado. A veces, puede llegar a cometer errores el asesor y no quiere que se mande ese vale de arte, por lo que, rechazarlo y borrarlo sería una buena opción. Que no haga la acción instantánea, prefedible que después de presionar el botón de "Rechazar" pregunte si está seguro de quere rechazar

2. Estandarizemos la zona horario UTC-6, casi todos los países de centro américa a excepción de belice y panamá, usando UTC-6. Porque ando solicitando esto, para que cuadre las horas de la acción de historial. Actualmente, no sé que zona horaria se anda usando porque me registra horas que ni tienen que ver con guatemala. Por lo que, usaremos el horario UTC-6. Dejemos esto bien configurado para que funcione incluso en hostinger.

3. Hay un problema con el flujo. Lo siguiente:
    - Asesor solicita crear vale (para UN solo taller)
    - Supervisor aprueba
    - Encargado recibe el vale
    - Lo realiza y aprueba
    - Asesor recibe el vale
    - El asesor solicita modificación
    - Supervisor lo aprueba
    - Encargado recibe la modificación <-- OJO!    
  Para este punto, el encargado es capaz de ralizar el vale de arte y subir la propuesta. Pero, si es solo un taller, no debería caer el vale de arte a `Aprobar y Fusionar`, eso solo debería de pasar cuando se envía a dos talleres o más. Cuando el vale de arte solo se envía a un solo taller, la modificación se envía directamente sin pasar por la aprobación y fusión.

4. El modal que se despliega para la acción de `historial` se debe actualizar en tiempo real para todas las vistas, actualmente solo lo hace para la vista del `ASESOR`.  

5. Cambia el esquema y el seed para no hardcodear los ENUM directamente en el esquema de las tablas. Ahora, quiero que se usen tablas tipo: `estados_vale` (id, nombre) -> ej. (1, 'ESPERANDO AUTORIZACION'). La referencia ahora se hará a un *estado_id*.  
Realiza este mismo proceso para TODOS los ENUM y modifica la consulta de los repositorios para que funciones con este nuevo esquema. Los insert de los valores a los ENUM hazlos en `seed.sql` y modifica lo necesario de los archivos SQL para que esto funcione.

6. Solo hay un Asistente de diseño, bloquea el hecho de que se puedan crear más de uno. Así como lo haces con los encargados de los talleres de Munditrofeos, que no me deja seleccionar ese rol para uno más, que funcione igual para el asistente. Estas restricciones también tienen que existir a nivel de backend, no solo en el frontend.

7. Algo que me gusta de páginas tipo facebook, es que sale un popup cuando se me vence la sesión. Hace algo similar, que cuando se expire la sesión salga un popup que me indique que se me expiró la sesión. Posterior, que me redirija al login cuando presione OK. Ya cambié el tiempo del token JWT a 12 horas
  
**IMPORTANTE**: **NO** quiero que me comentes sobre el código, la documentación hacela en la carpeta establecida y apegate a las reglas de implementación y diseño de mi proyecto.
  
## Dudas

En el **mismo** archivo de documentación de estas correcciones, poneme un sección respondiendo a estas incógnitas:  

1. Qué pasa cuando el servidor de hostinger se traba un ratito o algo, por ejemplo, el `atrasoWatcher` se reiniciará? El hecho que se reinicie reiniciará el conteo de atraso?

2. Cómo se lleva el conteo del correlativo de los vales? me pasó que haciendo pruebas, borre 26 de 27 vales que generé; al momento de crear otro vale me salió con el correlativo 00002 cuando tocaba el 28. Por qué? Evalua como podría esto afectar al sistema en 

3. Qué pasa con la conexión de la base de datos? Estaba viendo que es ineficiente estar estableciendo una conexión por cada vez que se hace una consulta. Estaba viendo que una forma de solucionar eso es crear una pool de conexiones e irlas utilizando con forme se vayan necesitando. Considero, que esto sería bueno para este proyecto, ya que no quiero que haya demasiado delay al momento de cargar el buzón de los empleados, consultar en los dashboard, etc.

4. Por qué hay una tabla que se llama `encargado_tienda`, esa relaciona los talleres a su tienda, por qué se llama así entonces? eso solo genera confusión