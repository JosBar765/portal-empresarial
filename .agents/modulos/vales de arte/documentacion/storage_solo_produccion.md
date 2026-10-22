# Borrado de archivos en Storage solo en producción

## Qué es
`supabaseStorage.eliminar(url)` (`src/core/files/supabaseStorage.js`) solo borra el objeto de Supabase Storage cuando `NODE_ENV=production`. En cualquier otro entorno escribe `[Storage] NODE_ENV=<entorno>: no se borra el archivo...` en el log y devuelve `false`, sin llamar a Supabase.

## Por qué
Una base de desarrollo restaurada de un backup de producción guarda las URL de los archivos reales. Borrar un vale, una propuesta o un adjunto desde desarrollo borraba también el archivo de producción. Fuera de producción solo se borra la información de la base de datos.

## Alcance
Aplica a todos los borrados que pasan por `eliminar`: vale dado de baja o expirado, adjuntos y PDF reemplazados, propuestas, rollback de una subida fallida, borradores (bucket de borradores) y la purga por antigüedad.

## Efectos a tener en cuenta en desarrollo
- Los archivos subidos durante las pruebas quedan en Storage aunque se borre el vale; hay que limpiarlos a mano si molestan.
- Si al subir un archivo ya existe otro con el mismo nombre (por ejemplo, un vale nuevo de desarrollo cuyo correlativo coincide con un archivo real), el sistema ya no lo reemplaza: la subida falla con el aviso de «ya existe un archivo con el nombre…». Antes habría borrado el archivo existente si creía que su vale ya no existía.

## Cómo verificar
1. Con `NODE_ENV=development`, dar de baja un vale con adjuntos: el vale desaparece de la base, el log muestra el aviso `[Storage]...` y los archivos siguen en Storage.
2. Con `NODE_ENV=production` el comportamiento es el de siempre.
