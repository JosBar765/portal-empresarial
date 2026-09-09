# Correcciones #23

Origen: `.agents/modulos/vales de arte/correcciones/analisis_correcciones_23.md`
(5 puntos). Cubre una auditoría de repositorios contra el esquema actual, un
bug de UX en Gestionar Tiendas, y una migración del almacenamiento de
adjuntos de Vales de Arte de disco local a Supabase Storage con subida
robusta e idempotencia.

## 1. Auditoría de repositorios vs. esquema actual

Se revisaron los 15 repositorios del proyecto (6 de `admin`, 9 de `vales`)
contra `database/schema.sql`. Los 9 de `vales` y 3 de los 6 de `admin`
(`tallerAdminRepository`, `permisoRepository`, `mantenimientoRepository`) ya
estaban alineados con el esquema normalizado (tablas `asesores`,
`supervisores`, `supervisor_tiendas`, `taller_tecnicos` en vez de columnas
directas en `usuarios`). Se encontraron y corrigieron 3 problemas reales:

### 1.1 `usuarioAdminRepository.listarConDetalle()` no exponía `tienda_id` del asesor

Causaba directamente el bug del punto 2 (ver abajo). El `SELECT` hacía
`LEFT JOIN asesores a` pero nunca seleccionaba `a.tienda_id` — se agregó al
SELECT.

### 1.2 Endpoint muerto que referenciaba `tiendas.orden` (columna ya eliminada)

`tiendaAdminRepository.actualizarOrden()`, su método de servicio
(`adminService.actualizarOrdenTiendas`), su controlador
(`adminController.actualizarOrdenTiendas`) y su ruta
(`PUT /api/admin/tiendas/orden`) seguían referenciando la columna `orden`,
eliminada en el commit `4f7b54b`. Nada en el frontend lo llamaba (grep
confirmado) — se eliminaron los 4. También quedaba
`public/modules/admin/js/components/menuCascada.js` ordenando por
`.orden` dentro de `construirArbolTiendas` (comparador siempre `NaN`, mismo
bug) — se cambió a ordenar alfabéticamente por la etiqueta ya calculada.

### 1.3 `rolRepository.establecerPermisos()` estaba roto — "Guardar" en el modal de Permisos nunca funcionó

La consulta original era `'DELETE ...; INSERT ... VALUES ...'` en una sola
llamada a `pool.query()` (mysql2 no soporta múltiples sentencias sin
`multipleStatements: true`, que este proyecto no usa) con un `VALUES ...`
literalmente inválido. Se reescribió como dos sentencias reales (DELETE +
INSERT masivo con `(?, ?)` por cada permiso). Verificado en navegador:
guardar sin cambios y guardar con un permiso añadido, ambos casos con toast
de éxito y sin errores de servidor.

## 2. Bug de "Gestionar Tiendas" — asesores disponibles (resuelto por 1.1)

Con `a.tienda_id` ahora expuesto, el filtro ya existente en
`public/modules/admin/js/actions/tiendaPersonal.js`
(`u.rol_id === ROL_ASESOR && u.tienda_id == null`) funciona como se diseñó
— antes `u.tienda_id` era `undefined` para todo asesor (`undefined == null`
es `true` en JS), así que el filtro siempre pasaba. Verificado en
navegador: con los 48 asesores reales del seed (todos asignados), el
combo "Tipo personal" de Gestionar Tiendas ya no ofrece "Asesor de Ventas"
en absoluto (cero disponibles, correcto). Se desasignó temporalmente a un
asesor real (`UPDATE asesores SET tienda_id = NULL`) para confirmar el caso
positivo: apareció ÚNICAMENTE ese asesor en el selector, ninguno de los
otros 47 ya asignados — y se revirtió el cambio de prueba al terminar.

## 3. `.env.example` y `src/config/env.js` — Supabase

Se agregaron los nombres de variable (sin valores) para Supabase Storage:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=vales_de-arte
```

`SUPABASE_SERVICE_ROLE_KEY` (no la `anon key`) porque el backend sube/borra
objetos sin pasar por políticas RLS de cliente de navegador — mismo patrón
que `JWT_SECRET`: secreto de servidor, nunca expuesto al frontend.
`src/config/env.js` expone `config.supabase.{url, serviceRoleKey, bucket}`,
mismo patrón que `config.db`.

## 4 y 5. Supabase Storage: subida robusta + idempotencia

### Decisión de seguridad (corregida a mitad de la implementación)

Al planear esto se afirmó, incorrectamente, que `/uploads` (el
almacenamiento local anterior) se servía sin ningún chequeo de
autenticación — **era falso**: `src/app.js` monta
`app.use('/uploads', express.static(...))` DESPUÉS de
`app.use(authenticateJWT)`, así que sí exigía un JWT válido. Se corrigió el
error en cuanto se detectó (releyendo `app.js` directamente) y se
re-preguntó al usuario con el dato correcto. Con la información correcta,
el usuario **decidió igualmente que el bucket de Supabase sea público** —
una reducción real de seguridad frente a hoy, aceptada conscientemente (ya
no hace falta sesión iniciada para ver un adjunto, solo conocer su URL de
nombre aleatorio, no listable).

### Archivos nuevos

- `src/core/files/errores.js` — `StorageUploadError`, `DatabaseInsertError`,
  `StorageRollbackError`.
- `src/core/files/supabaseStorage.js` — `subir()`/`eliminar()` contra el
  bucket. Cliente de Supabase **perezoso** (se construye en el primer uso
  real, no al cargar el módulo) — a diferencia de MySQL (imprescindible
  para todo el portal, con su propio fail-fast en `src/config/database.js`),
  Supabase solo hace falta para Vales de Arte; construir el cliente al
  cargar el archivo habría tumbado el servidor ENTERO si
  `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` no están configuradas, aunque
  nadie esté subiendo nada. Verificado: el servidor arranca y sirve
  Gestionar Usuarios/Tiendas/Talleres con normalidad sin esas variables
  configuradas.
- `src/core/files/subirYRegistrarArchivo.js` — la función "robusta" del
  punto 4: optimiza la imagen (mismo `imageOptimizer` de siempre) → sube a
  Storage (si falla, `StorageUploadError`, nunca toca la BD) → ejecuta el
  `registrar` del llamador (el INSERT/UPDATE que corresponda) → si eso
  falla, borra lo recién subido y relanza `DatabaseInsertError`; si el
  propio borrado de limpieza también falla, `StorageRollbackError` (nunca
  se pierde en silencio que quedó un archivo huérfano en Storage).
- `database/schema.sql`: tabla `idempotency_keys` (genérica, reutilizable)
  + `src/core/idempotency/idempotencyRepository.js` (`buscar`/`registrar`).

### Idempotencia — alcance y mecanismo

Solo en los 3 endpoints que suben un archivo Y escriben en la base de datos
en la misma operación: `crearVale` (adjuntos), `entregar` (propuesta),
`aprobarGeneral` (fusión). El resto de la máquina de estados no lo necesita
— ya está protegida contra doble-clic/carreras por `valeMutex`
(`conColaDeCreacion`/`conLockDeVale`), que además es lo que también hace
segura la concurrencia del propio chequeo de idempotencia (el `buscar()`
corre DENTRO del lock, nunca antes).

Flujo: el frontend genera **un** `crypto.randomUUID()` por intento (al
abrir el modal / armar el `FormData`, no en cada clic) y lo manda como
campo del propio `multipart/form-data`. El backend, al entrar al método:
si la key ya existe en `idempotency_keys`, devuelve el `resultado` guardado
sin volver a subir nada ni tocar la BD; si no, sigue el flujo normal y
registra el resultado justo antes de devolverlo. Si no llega ninguna key
(compatibilidad), se genera una interna solo para tener qué guardar — no
protege un reintento real porque el cliente nunca la reutilizaría, pero no
rompe nada.

### Call sites migrados de `fileStorage` (disco local) a Supabase

- `valeCreacionService.guardarAdjuntos` (imágenes + documentos de creación).
- `valeCreacionService.regenerarPdf` (el PDF generado; sin idempotency key
  propia — es un efecto interno de otras acciones que ya tienen la suya).
- `valeTallerService.entregar` (propuesta del técnico).
- `valeTallerService.aprobarGeneral` (documento de fusión).

### `valePdfService.js` — lectura de adjuntos para fusionar en el PDF

`_fusionarPdfExterno` y `_dibujarGridImagenes` leían los adjuntos
DIRECTO DEL DISCO (`fs.readFile(path.join(UPLOADS_DIR, ...))`) para
copiarlos/incrustarlos en el PDF final. Como `doc.ruta` ahora es la URL
pública completa de Supabase, ambos pasan a
`Buffer.from(await (await fetch(url)).arrayBuffer())` — el bucket es
público, así que un `fetch` simple basta. `LOGO_PATH` (el logo de la
empresa, un asset del propio proyecto, no un adjunto de usuario) se queda
igual, sigue leyéndose de disco.

### 6 sitios que armaban una URL local con `/${...}`

Como el valor guardado en BD pasa de ruta relativa (`uploads/xxx.pdf`) a
URL pública completa, se quitó el `/` inicial en:
`valeController.js` (`descargarPdf`), `actions/asesor.js`,
`actions/encargado.js`, `views/buzon.js` (×2), `views/dashboardGerencia.js`.

### Retiro de almacenamiento local

`src/core/files/fileStorage.js`, la carpeta `uploads/` (862 archivos
huérfanos de pruebas anteriores — verificado que la tabla `vales` local
está en 0 filas antes de borrar, así que no hacían referencia a nada vivo)
y la línea `express.static('/uploads', ...)` de `src/app.js` se eliminaron.
`.gitignore` ya no menciona `uploads/`. `imageOptimizer.js` se mantiene
intacto — lo sigue usando `subirYRegistrarArchivo`.

## Verificación

- `node --check` sobre los ~20 archivos nuevos/editados: sin errores.
- Smoke test de imports (`require` de cada módulo nuevo + los servicios de
  vales que los usan): carga limpia, incluso SIN `SUPABASE_URL`/
  `SUPABASE_SERVICE_ROLE_KEY` configuradas (confirma el fix de
  inicialización perezosa).
- Servidor real (`npm start`) contra la base de datos MySQL local de XAMPP
  (misma de la corrección anterior, con la tabla `idempotency_keys` ya
  creada): arranca sin errores.
- En navegador, como Administrador: los 3 bugs del punto 1 verificados en
  vivo (ver secciones 1.3 y 2 arriba) — sin errores de consola ni de
  servidor. El módulo de Vales de Arte carga y el modal "Crear Vale de
  Arte" renderiza sin errores (0 vales existentes en esta base de datos de
  prueba).
- **No verificado en esta máquina**: la subida real a Supabase Storage (no
  hay credenciales reales — el usuario las pondrá en su propio `.env`,
  igual que quedó documentado para MySQL en la corrección anterior). El
  contrato de `subirYRegistrarArchivo` (orden Storage→DB→rollback, las 3
  excepciones explícitas) se verificó por revisión manual línea por línea
  contra el texto literal del punto 4.

## Qué no se tocó

Ninguna regla de negocio cambió. Los mensajes de error, nombres de
parámetros, estructura de payloads y textos visibles al usuario se
mantuvieron iguales salvo donde el propio punto 2 pedía el arreglo.
`imageOptimizer.js` y `valePdfService.js`'s generación de contenido
(diseño del PDF) no cambiaron, solo su forma de leer bytes de adjuntos.

No se commiteó ni se subió nada — queda pendiente de pedido explícito.
