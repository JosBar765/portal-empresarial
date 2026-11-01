# DE QUÉ VA ESTE MÓDULO?

Este módulo será un **generador de prompts**, no de imágenes. El vendedor seguirá una serie de parámetros y la herramienta arma texto para pegar en un generador de imágenes externo (ChatGTP, Gemini, etc.). 

# FLUJO DE USO

1. El vendedor llena los datos solicitados. Más detalle en *DATOS DE ENTRADA*
2. Presiona algún botón para la generación del prompt
3. Presiona algún botón que copiará el prompt y las imágenes que cargó al portapapeles
4. El vendedor le muestra al cliente las sugerencias generadas  
    4.1 El cliente solicita alguna modificación  
    4.2 El flujo retorna al punto 1   
  
El propósito de esto, es que cada prompt genere una imágen diferente ajustado a las especificaciones de los datos, ya que no existirá eso de prompts de ajuste. Por lo que, cada prompt debe indicar que es una nueva instrucción y debería ignorar cualquier propuesta anterior para que la nueva propuesta se generé limpia.

# DATOS DE ENTRADA

* **Datos de vendedor**: Estos se obtendrán de la base de datos, usará los datos del usuario que esté loggeado y tenga permiso para usar el módulo
* **Nombre del evento**: Campo de texto libre. Normalmente aquí se coloca el nombre del evento o el texto que se desea que aparezca en la medalla.
* **Dimensiones**: Las dimensiones son las medidas deseadas de la medalla, estas medidas se incluyen para hacer una referencia visual tipo regla. No es precisamente para que se haga a escala, pero al menos se debe mantener la proporción de las medidas. En caso ser una medalla de forma irregular tomar en cuenta el punto más alto y más ancho. Las medidas pueden darse en `cm` y `""` pulgadas. Las dimensiones posibles son:
    - Ancho
    - Alto
    - Ancho de la argolla (dónde va el listón)
    - Ancho del listón (tiene que ser el mismo de la argolla)
* **Parte Frontal**: Acá se podrán cargar hasta 3 imágenes, las cuáles podrán ser logos o sponsors que van en la parte frontal. También se podrán agregar frases, estas van en un textarea separado por comas. En otro text area se pueden poner indicaciones, las indicaciones son cosas en específico que debe tener la medalla al frente.
    - Un ejemplo de este campo sería: el logo de la organización que hace la carrera; frases tipo: "run 4 life, keep running"; indicaciones: "Que haya dos corredores, uno masculino y otro femenino corriendo al lado de un río. Los corredores llevan zapatos con alas en los pies".
* **Parte Trasera**: Exactamente los mismos campos que el frente, solo que la parte trasera tiene la opción de ser totalmente lisa.
* **Tipo listión**: Acá se podrán cargar también imágenes que se deseen agregar al liston. El límite son 10 imágenes.
* **Con relieve**: Sí o No
* **Con textura**: Sí o No. La textura es tipo granulada
* **Tipo de forma**: Cuadrada, Circular, Irregular

# SALIDA ESPERADA

El tipo de imágen que espero en la salida, es la imágen de la medalla de frente y reverso, una al lado de otra sobre un fondo plano con algún color que haga contrase a la medalla, a modo de que se pueda visualizar bien bien la medalla. Al pie de la imágen, un machote con los colores del logo de la empresa y el texto en blanco de los datos del asesor que creó esa imágen. Irá su nombre, número de teléfono y correo electrónico; uno apilado debajo del otro. Recuerda, lo generado es una MEDALA.  

# QUÉ ES LO QUE HARÁS

Tu tarea como agente de IA es analizar el funcionamiento requerido, darme una propuesta de base de datos y un mockup del disenio en Figma. No es hasta que yo refine todo por completo y lo apruebe que comienzas a construir el módulo. Recuerda, la plataforma ya se encuentra en producción, por lo que la aniadidura de este módulo no debe estorbar a ningún otro. Es importante que mantengas las reglas de disenio establecidas para mantener el bajo acoplamiento y que este módulo sea totalmente independiente de los demás.  

Recuerda, aquí solo estamos hablando del módulo funcional, todavía falta una vista administrador la cuál nos permitirá agregar nuevos productos, actualmente se desea solo para medallas, pero el propósito de esto no es solo medallas si no también otros tipos de reconocimientos. Por lo que, para el administrador es de utilidad el poder crear nuevos productos y los parámetros que estos tienen. Fuera bueno analizar los parámetros NO como columnas de una SQL DB, quizá fuera mejor guardarlos en un JSON FILE para tener mayor flexibilidad a la hora de colocar los parámetros de los productos. Analiza todo esto y dame la mejor propuesta, tanto para la vista del usuario final como la del administrador. Al igual que la propuesta de la DB.