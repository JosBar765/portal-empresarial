# DE QUÉ VA ESTE MÓDULO?

Este módulo será un **generador de prompts**, no de imágenes. El vendedor seguirá una serie de parámetros y la herramienta arma texto para pegar en un generador de imágenes externo (ChatGTP, Gemini, etc.). 

# FLUJO DE USO

1. El vendedor llena los datos solicitados
2. Presiona algún botón para la generación del prompt
3. Copia el prompt y lo pega en su generador de imágenes
4. El cliente ve la imágen  
    4.1 El cliente solicita alguna modificación  
    4.2 El flujo retorna al punto 1   
  
El propósito de esto, es que cada prompt genere una imágen diferente, ya que no existirá eso de prompts de ajuste. Por lo que, cada prompt debe indicar que es una nueva instrucción y debería ignorar cualquier propuesta anterior.

# DATOS DE ENTRADA

|CAMPO|PROCEDENCIA|VALOR POR DEFECTO|
|---|---|---|
|Datos del vendedor|
* **Datos de vendedor**: Estos se obtendrán de la base de datos, usará los datos del usuario que esté loggeado y tenga permiso de usar el módulo