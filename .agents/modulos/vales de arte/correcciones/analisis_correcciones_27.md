# Archivo No. 27 de Correcciones 

1. Ahora que ya tenemos los permisos atómicos del administrador, ya podría dale el permiso de `Ver Panel Administración` a algún otro rol (por ejeplo: `gerente`). Pero, supongo que el guard del panel de Adminitración Central saca a cualquier rol que no sea `administrador`. Cambiemos eso, ya que, si le asigno a alguien el poder ver el panel de administración es para que pueda entrar. Entonces, que el guard no solo valida si el rol es de administrador, que también valide si tiene permiso de ver el panel de administrador. Además, si tiene asignado el panel de administración **SÓLO** se le mostrarán en el sidebar las opciones las cuáles tenga permiso (`Gestionar usuarios`, `gestionar talleres`, etc.). 

2. En el formulario de crear vales. Necesito los siguientes cambios: 
    - Que el número de caracteres de `boceto y descripción` vaya disminuyendo conforme se va escribiendo. Esto es más visual para los asesores 
    - Qué no me permita subir los archivos si son más grande que el límite. Actualmente, deja subirlos al formulario, si bien da error al subirlo a Supabase todavía me deja subirlo al formulario. Esto que se aplique tanto para las imágenes como para los documentos 

**Recuerda:** Apegate a las reglas de la carpeta `.\.agents\reglas` y no hagas comentarios innecesarios.