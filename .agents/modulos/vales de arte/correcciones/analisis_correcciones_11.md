# ARCHIVO DE ARREGLO No. 11 AL MÓDULO DE: VALES DE ARTE

1. Desconozco, si el compresor de imágenes esta desacoplado del módulo de vales de arte. De no estarlo, desacoplalo y garantiza la alta cohesión, por si otro módulo lo llegara a necesitar. Hagamóslo reutilizable

2. Actualmente, los encargados aún pueden ver los vales `APROBADOS` en la vista del "BUZÓN", sacalos de ahí. Y para la vista de "TRABAJO REALIZADO" agrega la acción de propuesta, así pueden ver la propuesta que aprobaron en su taller con respecto al vale de arte

# DEBATE

## ¿QUÉ ES EL DEBATE?

Implementaremos esta sección ahora la cuál nos servirá para debatir cambios que podamos aplicar al sistema. Yo te haré propuestas, y en base al estado del proyecto quiero que las evalúes me las expliques y me des recomendaciones de qué hacer. El propósito de esto es aplicar cambios, cambios los cuáles quizá seán inviables y para eso necesito tu evaluación y análisis. Para estos cambios, recuerda que siempre debes estar apegado a als reglas del proyecto y módulos dentro de `.\.agents\reglas`.

### TEMAS DE DEBATO

1. ¿Cómo aseguramos que solo exista una sesión por usuario? Actualmente, puede haber dos sesiones en distintos navegadores para el mismo usuario, eso no debería pasar. Lo preferible, es que solo pueda existir una sola sesión. Y si se trata de arrancar con otra sesión, que lanze una excepción y el usuario pueda ver el error

2. Actualmente el tojen JWT tiene 24 horas de expiración, para el tipo de sistema que es ¿consideras viable un token de menor tiempo y rotativo con la finalidad de garantizar que no haya suplantación a la hora de hacer una petición? Posiblemente para este módulo no sea necesario, debido a que la información no es del todo sensible, pero 'qué pasará el día que integremos módulos más sensibles?

3. ¿consideras que el sistema ya es capaz de integrar un supabase? los documentos actualmente se guardan en uploads en una carpeta local, el objetivo main siempre fue que estos se subieran a un almacenamiento de objetos para tenerlos ahí intactos. ¿Cómo está el repositorio actualmente? ¿Está correctamente separado el repositorio (interfaz) y las implementaciones? Esto es importante, recuerda que hoy es Supabase para los archivos y MySQL para la información, pero ¿y si mañana cambio de mysql a postgresql? Evalúa eso

4. Actualmente el responsive funciona muy bien para celulares o tabletas. Las filas de la tabla se convierten en tarjetitas. Pero, cuando quiero trabajar a pantalla dividida, la columna de acciones comienza a desaparecer y aparecer con un scrollbar. ¿Qué consideras más factible: Inmobilizar la columna del correlativo o progresivamente ir generando tarjetas similares a las de la vista de celular?