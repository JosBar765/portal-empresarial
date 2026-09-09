# Archivo de correcciones No.23

1. Quiero que verifiques los repositorios, tanto del módulo de administrador como los de vales de arte. Revisa que estén alineado a cómo dejamos el esquema de la base de datos actualmente.

2. Quiero que me soluciones un bug en la pestaña de `gestionar tiendas` de la vista **administrador**. Lo talleres **No** me muestran todos aquellos técnicos que ya están operando en un taller, esto es debido a que los técnicos trabajan físicamente en los talleres, por lo que es imposible asignar un técnico a que trabaje en ambos talleres. Pero esto no pasa con los asesores. AL momento de gestionar la tienda, me salen TODOS los asesore (estén asignados o no). Me es importante que solo pueda ver los que no están asignados. La asignación no me deja hacerla, pero sí me deja verlos.

3. Quiero que modifiques el archivo `.env.example` para poner adecuadamente las API keys de supabase. Ya quiero probar con una cuenta que he creado, te paso la configuración de conexión S3:
    - Supongamos que mi endopint es: [https://tu-proyecto.supabase.co](https://tu-proyecto.supabase.co)
    - el bucket se llama `vales_de-arte`   
    Recorda que SUPABASE es **esxlusivamente** para el almacenamiento de los archivos pdf y las imágenes de los vales de arte. Solo dejame el espacio para las API keys, yo las pongo luego en el .env  

4. Desconozco si ya implementaste una función para subir un archivo PDF/imagen a Supabase Storage y registrar sus metadatos en la base de datos de PostgreSQL/Supabase. De ser así, solo asegúrate de cumplir lo siguientes requisitos para una función robusta:
    - La operación debe garantizar la consistencia de datos de la siguiente manera:
        * Paso 1 (Subida a Storage): Intenta subir el archivo al bucket de Supabase. Si la subida falla, interrumpe el proceso inmediatamente lanzando una excepción clara (sin tocar la base de datos).
        * Paso 2 (Inserción en DB): Si el archivo se sube con éxito, procede a realizar el registro en la base de datos utilizando el ID/Path del archivo subido.
        * Paso 3 (Rollback / Limpieza en caso de error): Si la inserción en la base de datos falla (por cualquier motivo, como errores de sintaxis, validaciones o conexión), el bloque catch debe capturar el error y eliminar inmediatamente el archivo que se subió en el Paso 1 del bucket de Supabase.
    - Manejo de Excepciones: Lanza excepciones explícitas para cada caso de fallo (StorageUploadError, DatabaseInsertError, StorageRollbackError) para poder identificar exactamente qué falló.

5. Es importante, que así como para la acción del **punto 4** asegures la idempotencia, evalua que tan necesario sería una *idempotency key*. Es importante que la idempotencia **no** solo se valide en el frontend, tiene que ser validada en el backend