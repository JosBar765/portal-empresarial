# correlativo-documentos-supabase

Rama: `fix/correlativo-documentos-supabase` (desde `dev`) · Estrategia de entrega: `ask-on-risk` · Estado: plan creado, sin código.

## Objetivo
Que los archivos que se suben a Supabase Storage lleven un nombre basado en el correlativo del vale en vez de un token aleatorio, para identificarlos fácilmente.

## Esquema de nombres (decisión del usuario, 2026-10-12)
Extensión siempre desde el tipo verificado del archivo (`.pdf`, `.jpg`, `.png`, `.webp`). `{corr}` = correlativo del vale; en un vale MOD- ya trae el prefijo `MOD-` y rigen exactamente las mismas reglas.
- PDF del vale: `{corr}_CREACION`, `{corr}_AUTORIZACION`, `{corr}_CORRECCION_PRE_AUTORIZACION_X`.
- Adjuntos: `{corr}_IMAGEN_CREACION_X`, `{corr}_IMAGEN_CORRECCION_X`, `{corr}_PDF_CREACION_X`, `{corr}_PDF_CORRECCION_X`.
- Propuestas: `{corr}_PROPUESTA_{taller}_X` (la final es la de número más alto; no existe `_FINAL`) y `{corr}_PROPUESTA_FUSION` (varios talleres).
- `X` es un contador que inicia en 1 por cada etapa (por vale, tipo, etapa y, en propuestas, taller).
- Códigos de taller: Diseño → `DISENIO`; Diseño UV/3D → `DISENIO_UV3D`; Protextil → `PROTEXTIL`; Diseño Local → `DISENIO_{código de tienda}`.

## Decisiones del usuario
- Se ignora la herramienta admin «Crear Vale de Arte» (sigue con su nombre actual).
- Los adjuntos nuevos que se agregan al pedir una modificación se nombran como creación del vale MOD- (`MOD-…_IMAGEN_CREACION_X`).
- Se quita la llamada a `regenerarPdf` en la fusión (`aprobarGeneral`): es un resto de cuando la fusión se pegaba dentro del PDF (correcciones #7). Nunca se usó en producción (no hay vales multitaller). Se deja el resto de la lógica de fusión sin tocar (el usuario la reescribirá), salvo nombrar su archivo `_PROPUESTA_FUSION`.
- Un vale no se reautoriza ni se fusiona dos veces (verificado en el código), así que `_AUTORIZACION` y `_PROPUESTA_FUSION` no se repiten; lo que se repite son las correcciones previas a la autorización y las propuestas no aprobadas.

## Tareas
- [x] T1 · Núcleo: `supabaseStorage.subir` y `subirYRegistrarArchivo` aceptan un nombre de objeto; helper de nombres (sanitización, código de taller, siguiente X a partir de las URLs existentes).
- [x] T2 · PDF del vale: creación, autorización, corrección previa, y el equivalente en vales MOD- (solicitud y aprobación de la modificación).
- [ ] T3 · Adjuntos: creación, corrección y adjuntos nuevos de la solicitud de modificación.
- [ ] T4 · Propuestas (por taller y fusión) y quitar `regenerarPdf` de la fusión.
- [ ] T5 · Documentación y verificación liviana.

## Preguntas abiertas
Ninguna.

## Verificación y evidencia
- T1/T2 · ruta: escritor delegado (disparador: 2+ archivos no triviales). Sin runner de tests: RED/GREEN no aplica.
- T1/T2 · `node --check` OK en los 6 archivos editados; script en scratchpad (con `env` y `@supabase/supabase-js` simulados, sin subidas reales): nombres `V-0001_CREACION.pdf`, `MOD-V-0001_AUTORIZACION.pdf`, contador `..._CORRECCION_PRE_AUTORIZACION_1/_3/_11`, códigos de taller y rechazo de nombre inválido, todo OK. Sin nombre se mantiene el token aleatorio.
- T1/T2 · riesgo restante: nombres deterministas con `upsert:false`; si un vale/MOD- borrado dejó su PDF sin borrar en Storage (solo se loguea) y el correlativo se reutiliza (p. ej. nuevo `MOD-<original>` tras rechazo), la subida falla con "already exists" en vez de sobrescribir.
- T1/T2 · commit: (pendiente, lo hace el orquestador)

## Siguiente paso
Empezar T3.
