# correlativo-documentos-supabase

Rama: `fix/correlativo-documentos-supabase` (desde `dev`) · Estrategia de entrega: `ask-on-risk` · Estado: T1-T6 hechas.

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
- [x] T3 · Adjuntos: creación, corrección y adjuntos nuevos de la solicitud de modificación.
- [x] T4 · Propuestas (por taller y fusión) y quitar `regenerarPdf` de la fusión.
- [x] T5 · Documentación y verificación liviana (incluye nombres de la herramienta admin y error explicativo de taller desconocido).
- [x] T6 · Recuperación de huérfanos en MOD-: si la subida de un objeto con nombre fijo choca con uno existente y no hay vale con ese correlativo, se borra el huérfano y se reintenta una vez.

## Preguntas abiertas
Ninguna. Resuelta (T6): reutilización del correlativo de un MOD- con variante de verificación de existencia por correlativo. Riesgo residual: dos solicitudes simultáneas del mismo MOD-; se cree evitado por el lock por vale (`valeMutex`), no probado.

## Verificación y evidencia
- T1/T2 · ruta: escritor delegado (disparador: 2+ archivos no triviales). Sin runner de tests: RED/GREEN no aplica.
- T1/T2 · `node --check` OK en los 6 archivos editados; script en scratchpad (con `env` y `@supabase/supabase-js` simulados, sin subidas reales): nombres `V-0001_CREACION.pdf`, `MOD-V-0001_AUTORIZACION.pdf`, contador `..._CORRECCION_PRE_AUTORIZACION_1/_3/_11`, códigos de taller y rechazo de nombre inválido, todo OK. Sin nombre se mantiene el token aleatorio.
- T1/T2 · riesgo restante: nombres deterministas con `upsert:false`; si un vale/MOD- borrado dejó su PDF sin borrar en Storage (solo se loguea) y el correlativo se reutiliza (p. ej. nuevo `MOD-<original>` tras rechazo), la subida falla con "already exists" en vez de sobrescribir.
- T1/T2 · commit: d165367.
- T3/T4 · ruta: escritor delegado (disparador: 2+ archivos no triviales). Sin runner de tests: RED/GREEN no aplica.
- T3/T4 · `node --check` OK en valeCreacionService, valeCorreccionService, valeModificacionService y valeTallerService; sin líneas LF sueltas. Script en scratchpad (t34check.js; Storage, BD y repositorios simulados, sin subidas reales) verificó los nombres: varios adjuntos de creación en un request (`_IMAGEN_CREACION_1..3`, `_PDF_CREACION_1..2`); corrección que continúa tras filas existentes (`_IMAGEN_CORRECCION_3,4`, `_PDF_CORRECCION_1,2`); adjuntos nuevos de MOD- (`MOD-…_IMAGEN_CREACION_1,2`, `_PDF_CREACION_1`); propuestas de dos talleres con contador propio y segunda entrega del mismo taller (`_PROPUESTA_DISENIO_1`, `_PROTEXTIL_1`, `_DISENIO_2`, `_DISENIO_ECL_1`); fusión `MOD-GT-1_PROPUESTA_FUSION`.
- T3/T4 · `regenerarPdf` ya no se llama desde valeTallerService; su único llamador es crearVale (con `{ creacion: true }`), así que la opción `creacion` quedó siempre activa (no se refactorizó).
- T3/T4 · en la corrección, X continúa desde TODOS los adjuntos actuales del vale (también los que se quitan), porque los quitados siguen en Storage hasta confirmar la base y la subida usa `upsert:false`.
- T5 · ruta: escritor delegado (disparador: 2+ archivos no triviales). Sin runner de tests: RED/GREEN no aplica.
- T5 · `codigoTaller` lanza ahora un Error plano (de negocio para responderError) con el mensaje que indica dónde agregar el taller; se lanza antes de subir nada.
- T5 · herramienta admin: `{corr}_CORRECCION_CREACION_ADMIN_X` / `_AUTORIZACION_ADMIN_X` con X desde `vale_pdf_generados` (`listarUrlsPorCorrelativo`).
- T5 · doc: `.agents/modulos/vales de arte/documentacion/correlativo_documentos_supabase.md` + nota en CLAUDE.md.
- T5 · verificación: ver el informe del escritor (script en scratchpad t5check.js, sin subidas reales).

- T6 · ruta: escritor delegado (disparador: 2+ archivos no triviales). Sin runner de tests: RED/GREEN no aplica.
- T6 · `supabaseStorage.subir(..., { esHuerfano })`: ante duplicado (status 409 / "already exists", forma real de StorageApiError) con `nombreObjeto` y hook, consulta el hook; huérfano => `eliminar` + `console.warn` + un solo reintento; si no, `StorageUploadError` «Ya existe un archivo con el nombre "…" en Storage…». Cableado solo en `solicitarModificacion` (PDF del MOD- y `_subirNuevos` con `recuperarHuerfanos`), con `valeRepository.existePorCorrelativo`. Sin cambios en el camino normal.
- T6 · `node --check` OK en los 4 archivos; sin líneas LF sueltas. Script en scratchpad (t6check.js, cliente Supabase simulado, sin subidas reales): (a) subida normal sin hook ni eliminar; (b) duplicado sin vale => 1 eliminar, 2 subidas, warn; (c) vale existe => sin borrado y con mensaje; (d) borrado falla => error; (e) segundo duplicado => error sin bucle; (f) sin hook igual que antes. t34check.js sigue OK.

## Pruebas de punta a punta (bucket de prueba, subidas reales; 2026-10-12)
- E2E 1 (vales 713–716): creación, 2 correcciones previas, autorización, propuesta Protextil, modificación MOD-, herramienta admin y recuperación de huérfanos: PASS. Un duplicado en Supabase responde HTTP 400 «The resource already exists» (no 409); se detecta por el mensaje.
- E2E 2 (vale 717, Diseño + Protextil): `_PROPUESTA_DISENIO_1`, `_PROPUESTA_PROTEXTIL_1`, segunda entrega tras desaprobar con reasignación `_PROPUESTA_PROTEXTIL_2`, fusión `_PROPUESTA_FUSION`: PASS. `pdf_url` sigue en `_AUTORIZACION.pdf` y el bucket ganó solo 1 objeto en la fusión (no se regenera el PDF del vale).
- Un encargado que entrega su propio trabajo se autoaprueba, por lo que una segunda entrega solo se da cuando entrega un diseñador y el encargado desaprueba reasignando.
- Efectos en dev: 28 objetos en `my_bucket`; vales 713–717 y filas 14–15 de `vale_pdf_generados`; el vale 162 se pausó y reanudó (quedó EN_PROCESO).

## Siguiente paso
Commit de T6 por el usuario.
