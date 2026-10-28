# Nombres de los archivos en Supabase Storage

Los archivos de un vale se suben con un nombre basado en su correlativo, en vez de un token aleatorio, para identificarlos fácilmente. Código: `src/core/files/nombreArchivo.js`.

## AL AGREGAR UN TALLER NUEVO

**Hay que agregarlo en `codigoTaller` (`src/core/files/nombreArchivo.js`). Si no, entregar una propuesta con archivo falla con un error explicativo** (`El taller "<nombre>" no tiene código para nombrar archivos en Storage…`).

## Esquema

La extensión sale del tipo verificado del archivo (`.pdf`, `.jpg`, `.png`, `.webp`). `{corr}` es el correlativo del vale; en un vale `MOD-` ya trae el prefijo `MOD-` y rigen las mismas reglas.

- PDF del vale: `{corr}_CREACION`, `{corr}_AUTORIZACION`, `{corr}_CORRECCION_PRE_AUTORIZACION_X`.
- Adjuntos: `{corr}_IMAGEN_CREACION_X`, `{corr}_IMAGEN_CORRECCION_X`, `{corr}_PDF_CREACION_X`, `{corr}_PDF_CORRECCION_X`.
- Propuestas: `{corr}_PROPUESTA_{taller}_X` y `{corr}_PROPUESTA_FUSION_X` (varios talleres; X sigue contando si el vale vuelve al taller y se fusiona otra vez).
- Herramienta admin «Crear Vale de Arte»: `{corr}_CORRECCION_CREACION_ADMIN_X` (sin supervisor) y `{corr}_CORRECCION_AUTORIZACION_ADMIN_X` (con supervisor).
- Códigos de taller: Diseño `DISENIO`; Diseño UV/3D `DISENIO_UV3D`; Protextil `PROTEXTIL`; Diseño Local `DISENIO_{código de tienda}`.

## Cómo se cuenta X

- Inicia en 1 por vale, tipo y etapa (y por taller en las propuestas): es el máximo existente más uno, leído de las URLs ya guardadas.
- En la herramienta admin se cuenta por correlativo y tipo, con las filas de `vale_pdf_generados`.
- Los contadores de corrección también cuentan los adjuntos que esa corrección quita, así que puede haber saltos (es a propósito): los archivos quitados se borran de Storage solo después de confirmar la base, y las subidas usan `upsert: false`.
- La propuesta con el número más alto es la final; no existe `_FINAL`.

## Otras reglas

- `_AUTORIZACION` no se repite: un vale no se reautoriza. `_PROPUESTA_FUSION_X` sí puede repetirse: tras un rechazo de propuesta aceptado el vale vuelve al taller y se fusiona de nuevo; X sale de `vales.propuesta_general_url` (los archivos sin número, anteriores a este cambio, no cuentan y X empieza en 1). La fusión anterior queda en Storage sin borrarse.
- Los adjuntos nuevos de una solicitud de modificación se nombran como creación del vale `MOD-` (`MOD-…_IMAGEN_CREACION_X`).
- El nombre debe ser seguro en una URL: el correlativo se sanitiza a `[A-Za-z0-9-]` (en la herramienta admin solo para el nombre del objeto; la columna guarda el texto escrito).
- Las subidas usan `upsert: false`: si el archivo ya existe, la subida falla con «already exists».
- Recuperación de huérfanos (solo al solicitar una modificación, donde el vale `MOD-` aún no existe): si el PDF o un adjunto nuevo ya existe en Storage y no hay ningún vale con ese correlativo (`valeRepository.existePorCorrelativo`), es un resto de un `MOD-` anterior cuyo borrado falló: se elimina, se avisa en el log (`[Storage] Huérfano eliminado`) y se reintenta la subida una sola vez.
- Si el vale sí existe o el borrado falla, la subida termina con el error «Ya existe un archivo con el nombre "…" en Storage…». El mecanismo vive en `supabaseStorage.subir` (opción `esHuerfano`); sin esa opción nada cambia.
