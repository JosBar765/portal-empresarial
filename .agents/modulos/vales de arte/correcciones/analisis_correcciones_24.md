# Archivo de correcciones No. 24

1. Actualmente, en el modal de `autorizar creación` del vale de arte me permite "Autorizar" o "Cancelar", quiero que agreguemos una tercera opción que se llame "Rechazar". Lo que hará este botón de este modal, será borrar el vale de arte de la base de datos y borrar las imágenes y pdf generado. A veces, puede llegar a cometer errores el asesor y no quiere que se mande ese vale de arte, por lo que, rechazarlo y borrarlo sería una buena opción

2. Estandarizemos la zona horario UTC-6, casi todos los países de centro américa a excepción de belice y panamá, usando UTC-6. Porque ando solicitando esto, para que cuadre las horas de la acción de historial. Actualmente, no sé que zona horaria se anda usando porque me registra horas que ni tienen que ver con guatemala

3. Hay un problema con el flujo. Lo siguiente:
    - Asesor solicita crear vale (para UN solo taller)
    - Supervisor aprueba
    - Encargado recibe el vale
    - Lo realiza
    - El asesor solicita modificación
    - Supervisor lo aprueba
    - Encargado recibe la modificación <-- OJO!    
  Para este punto, el encargado realiza el vale de arte y pues sube la propuesta. Pero, si es solo un taller, no debería caer el vale de arte a `Aprobar y Fusionar`, eso solo debería de pasar cuando se envía a dos talleres o más. Cuando el vale de arte solo se envía a un solo taller, la modificación se envía directamente sin pasar por la aprobación y fusión.

4. 
  
## Dudas

En la documentación de estas correcciones, poneme un sección respondiendo a estas incógnitas:  

1. Qué pasa cuando el servidor de hostinger se traba un ratito o algo, por ejemplo, el `atrasoWatcher` se reiniciará? El hecho que se reinicie reiniciará el conteo de atraso?

2. Cómo se lleva el conteo del correlativo de los vales? me pasó que haciendo pruebas, borre 26 de 27 vales que generé; al momento de crear otro vale me salió con el correlativo 00002 cuando tocaba el 28. Por qué? Evalua como podría esto afectar al sistema en producción