# Archivo de correcciones No. 22

1. Me pasa lo siguiente, para centro américa tengo varios supervisores. Todos pueden autorizar creación o modificación, por lo tanto supongamos la siguiente situación: 
    - Supervisor 1, 2 y 3 presionan para autorizar la creación/modificación de un vale de arte
    - Se registra la acción del supervisor 2
    - Al supervisor 1 y 3 les sale un mensaje de error <-- OJO!  
  
  Después de este mensaje de error, quiero que ese vale de arte ya no salga en su buzón. Actualmente, la solución es actualizar la página, pero me gustaría que fuera automático.

2. Gerencia me acaba de avisar que no existe catálogo de productos ni de material. Quita la tabla de la DB, las columnas que las referencien y cambia los campos del formulario de crear vale de arte a que sean de texto y no combobox.

3. Quitemos los datos MOCK, vamos a levantar ahora una base de datos que tengo localmente. Ya puse las credenciales en el .env. Quiero, que me quites el fallback y mejor que lance una excepción o algún modal que me indique que hubo un fallo al levantar la base de datos.