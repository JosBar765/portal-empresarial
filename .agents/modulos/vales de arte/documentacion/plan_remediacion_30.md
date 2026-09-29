# Correcciones #30 — Plan de remediación de seguridad (segunda versión)

Origen: `auditoria_seguridad_30.md` (misma carpeta). Los IDs `SEG-nn` son los de ese informe (SEG-01 a SEG-26 de la primera pasada; SEG-27 a SEG-32 nuevos de la segunda).

**Cambios respecto a la primera versión del plan** (tras re-verificar todo sobre `dev` con las variables obligatorias de #29):
- **Ya resuelto, se saca del plan:** SEG-17 (validación del `JWT_SECRET`) y la parte de `NODE_ENV`/CORS por defecto de SEG-16 y SEG-22.
- **Ajustado:** 1.6 solo conserva `trust proxy`; 2.1 conserva el límite de `register_module` pero ya no el CORS.
- **Agregado:** 1.8 (SEG-27, imágenes bomba), 2.10 (SEG-28, logs), 2.11 (SEG-29, timeouts e integridad del PDF), 2.12 (SEG-31, cookies `Secure` salvo desarrollo), 3.11 (SEG-30, TLS a MySQL) y las pruebas T-21 a T-24.
- **Estado de partida de las 24 pruebas:** columna "Hoy" actualizada con la re-ejecución de esta pasada.

Reglas del plan (de la solicitud original):
- No cambiar la arquitectura ni los contratos de API que usa el frontend; no eliminar funcionalidad; no borrar código "que no parece usarse" sin demostrar que no tiene dependencias.
- Prioridad: seguridad > compatibilidad > calidad del código. Si una corrección exige cambiar comportamiento visible, se consulta antes (marcado **[CONSULTAR]**).
- Cada fase termina con la verificación de la sección "Verificación de cada fase" antes de pasar a la siguiente. Una rama por fase, PR a `dev`.
- Nada de Redis, microservicios ni servicios nuevos: el sistema es un monolito de un solo proceso y las soluciones en memoria son suficientes mientras siga siéndolo.

---

## Fase 1 — Críticas y altas + brechas de los cambios nuevos (rama `security/fase-1`)

| Orden | ID | Qué se hace | Archivos | Riesgo de romper algo |
|---|---|---|---|---|
| 1.1 | SEG-01 | Dejar de devolver `password_hash`: columnas explícitas en `listarConDetalle`; `obtenerPorId`/`obtenerPorEmail` con lista de columnas sin hash (el hash solo se lee en `authService.authenticate`, que ya tiene su propio SELECT); `crearUsuario`/`actualizarUsuario` devuelven un DTO sin secretos. | `admin/repositories/usuarioAdminRepository.js`, `admin/services/adminService.js` | Bajo. Comprobar que `views/usuarios.js`/`usuarioForm.js` no lean `password_hash`, `intentos_fallidos` ni `bloqueado_hasta` (`grep`). |
| 1.2 | SEG-02, SEG-24 | Crear `core/utils/errores.js` con `class ErrorDeNegocio extends Error { status }`. Los `throw new Error('mensaje para el usuario')` de los servicios pasan a `ErrorDeNegocio` (cambio mecánico por archivo). Un solo helper `responderError(res, error)`: si es `ErrorDeNegocio` → su mensaje y estado; si no → 500 genérico + `console.error` del detalle. Reemplazar los `catch → error.message` de `valeController`, `adminController` y `authController`. En el login, cualquier error inesperado responde el mensaje genérico "Correo o contraseña incorrectos." o 500 genérico, nunca el texto de MySQL. Validar `req.params.id` con un parser estricto (`aEntero`, ya existe en `adminService`; moverlo a `core/utils`) → 400 "Identificador inválido" antes de tocar SQL. | `core/utils/erroresHttp.js`, controladores, servicios de vales/admin | **Medio (es el cambio más grande de la fase).** El frontend muestra `error.message` de negocio: hay que conservar exactamente esos textos. Estrategia segura: migrar primero el manejador y clasificar como negocio todo lo que hoy lanza el servicio con `throw new Error`; lo que venga de MySQL/Supabase/TypeError es lo único que pasa a genérico. Probar cada módulo con un caso de error de negocio conocido (p. ej. "El técnico indicado no está bajo su mando."). |
| 1.3 | SEG-03, SEG-04, SEG-05 | Login: (a) validar tipos: `email` y `password` deben ser `string`, con largo máximo (email ≤ 150, password ≤ 128) → 401 genérico; (b) normalizar `email.trim().toLowerCase()` para el SELECT y para la clave del limitador; (c) segundo limitador por IP (p. ej. 50 intentos/15 min); (d) contador de fallos por cuenta con `usuarios.intentos_fallidos` y `bloqueado_hasta` (5 fallos → bloqueo 15 min, reinicio al acertar; mensaje genérico igual que hoy para no delatar el bloqueo); (e) igualar el tiempo: cuando el usuario no existe o está inactivo, ejecutar `bcrypt.compare` contra un hash ficticio fijo para no delatar la cuenta por latencia. | `core/auth/authRoutes.js`, `core/auth/authService.js` | Bajo. No cambia la respuesta ni el contrato. Cuidar que el bloqueo por cuenta no impida al Administrador legítimo: exponer un desbloqueo desde el panel o limitarlo a 15 min. |
| 1.4 | SEG-06 | Reescribir `requireModuleAccess`: decodificar (`decodeURIComponent` dentro de `try`), normalizar con `path.posix.normalize`, tomar el primer segmento no vacío y compararlo en minúsculas; ante segmento no decodificable → 400. Alternativa equivalente: montar por módulo `app.use('/modules/vales', gate('vales'), express.static(...))` con rutas literales (el más simple y sin parseo manual). | `core/permissions/permissionMiddleware.js`, `app.js` | Bajo. |
| 1.5 | SEG-07 | Revocar sesión al **cambiar contraseña**, **desactivar usuario** y **cambiar permisos de su rol** (`sesionRepository.eliminarPorUsuario(id)`; para permisos del rol, `eliminar` por `rol_id` o basta con el refresco ya existente). Además de la señal por socket, borrar la fila para que el refresh deje de servir de inmediato. | `admin/services/adminService.js`, `core/auth/sesionRepository.js` | Bajo. El usuario afectado tendrá que iniciar sesión de nuevo (comportamiento esperado). |
| 1.6 | SEG-16 (resto) | ~~Validar `JWT_SECRET` y `NODE_ENV`~~ (**hecho en #29**). Queda: `app.set('trust proxy', N)` con `N` leído de una variable `TRUST_PROXY` **obligatoria** (mismo criterio sin valores por defecto que el resto del `.env`; `0` = sin proxy), a confirmar con Hostinger cuántos saltos hay. Sin esto, todos los clientes comparten IP en los limitadores. | `config/env.js`, `app.js`, `.env.example` | Bajo. Solo afecta producción; un valor mal puesto permite falsear la IP, por eso se confirma primero. |
| 1.7 | SEG-18 | `db.query`: registrar el mensaje y el código del error de MySQL y la etiqueta (`tag`), **no** `error.sql` ni los valores. Eliminar el log del correo en cada intento fallido o dejarlo como hash truncado. | `config/database.js`, `core/auth/authService.js` | Nulo. |
| 1.8 | SEG-27 | Rechazar imágenes con dimensiones absurdas **antes** de guardarlas: en `imageOptimizer`/nueva `validarDimensiones(buffer)`, leer `sharp(buffer, { limitInputPixels }).metadata()` y, si `width * height` supera el tope (propuesta: 40 MP, ya definido como `LIMITE_PIXELES`) o la lectura falla, lanzar error de negocio "La imagen es demasiado grande (píxeles)". Cambiar el `catch` de `optimizar()` para que solo ignore errores de *optimización*, no de límite. Aplicar a las imágenes de vales; si `sharp` no está disponible en Hostinger, leer ancho/alto de la cabecera PNG/JPEG a mano (primeros bytes) en vez de omitir la validación. | `core/files/imageOptimizer.js`, `core/files/fileSignature.js`, `vales/controllers/valeController.js` (`validarArchivos`) | Bajo. Ninguna foto real de trofeo se acerca a 40 MP (una foto de 8000 × 5000 ya son 40 MP). |

### Verificación de la Fase 1
Ver sección "Verificación de cada fase" + pruebas T-01 a T-11 y T-21.

---

## Fase 2 — Medias (rama `security/fase-2`)

| Orden | ID | Qué se hace | Archivos | Riesgo |
|---|---|---|---|---|
| 2.1 | SEG-09 | Limitador general por IP para `/api` (p. ej. 300/min) y uno propio para `/api/auth/refresh` y `/api/auth/session`; limitar `renovacionesRecientes` a un máximo de entradas (p. ej. 1 000, descartando las más viejas) y **no cachear** resultados fallidos por token inventado. Límite de mensajes de `register_module` por socket (p. ej. 20/min) y tope de sockets por usuario (el CORS por defecto ya está resuelto en #29). | `app.js`, `core/auth/tokenService.js`, `core/websocket/socketManager.js` | Bajo. Elegir cifras que no rompan el uso normal (una carga de página dispara ~5-10 llamadas). |
| 2.2 | SEG-10, SEG-25 | multer: `limits: { fileSize, files: 15, fields: 40, parts: 60, fieldSize: 20 * 1024 }`; actualizar `multer` a 2.4.0 (`npm audit fix` puntual) y los parches menores que el informe lista, uno por uno con prueba de arranque. | `vales/routes.js`, `package.json` | Bajo; el formulario de vale tiene ~20 campos. |
| 2.3 | SEG-11 | PDFs adjuntos: rechazar (mensaje de negocio) los de más de N páginas (propuesta: 30) y los cifrados; envolver `PDFDocument.load` con `ignoreEncryption:false`; copiar solo páginas y descartar anotaciones/acciones (`page.node.delete('Annots')`) para que el PDF oficial no contenga enlaces ajenos. | `vales/services/valePdfService.js` | Medio-bajo: validar con PDFs reales del negocio. **[CONSULTAR]** el tope de páginas. |
| 2.4 | SEG-13 | Idempotencia: guardar `usuario_id` y `endpoint` con la clave (`ALTER` documentado en `schema.sql`), consultar por los tres, validar formato (`/^[A-Za-z0-9-]{8,64}$/`) y agregar limpieza de claves con más de 7 días (al arrancar). | `core/idempotency/idempotencyRepository.js`, `valeCreacionService`, `valeTallerService` | Bajo. Las claves ya existentes no coincidirán: aceptable (son de un solo uso). |
| 2.5 | SEG-14 | `dashboard.js:47` → `textContent` para el nombre; `maintenanceMiddleware.js:42` → escapar `mensaje` en el servidor (función `escapeHtml` de `core/utils`); `views/mantenimiento.js:19` → `escapeHtml`; `encargado.js:91,153` → función `urlSegura(url)` (solo `https:`/`http:`), igual que la de "Encontrar vale". Validar también al guardar: el nombre de usuario y el mensaje de mantenimiento sin `<` `>` (validación, no sanitización destructiva). | 4 archivos de frontend + `maintenanceMiddleware.js` + `adminService.js` | Bajo. |
| 2.6 | SEG-05, SEG-24 | Capa mínima de validación de entrada (`core/utils/validar.js`): `esTexto(v,{max})`, `esEntero(v)`, `esEmail(v)`, `esTelefono(v)`; usarla en login, `crearUsuario`, `validarDatosVale` (teléfono con formato internacional, la spec ya lo pedía), rutas con ids y query (`estado`, `tiendaId`, `cursor`: solo strings/enteros). Sin librería nueva. | `core/utils`, servicios | Bajo-medio: no rechazar datos que hoy se aceptan de forma legítima; probar con los vales del seed. |
| 2.7 | SEG-21 | Coste bcrypt 12 para hashes nuevos (los viejos se siguen verificando; se re-hashean al iniciar sesión); política: mín. 10 caracteres, máx. 72 bytes, rechazar contraseñas triviales de una lista corta. **[CONSULTAR]** endpoint "cambiar mi contraseña" (pide la actual, revoca las demás sesiones). | `adminService.js`, `authService.js`, (opcional) `authRoutes.js` | Medio si se agrega el endpoint (frontend nuevo). |
| 2.8 | SEG-19 | Producción: el servidor solo **verifica** el esquema y falla con mensaje claro si faltan columnas (no ejecuta `ALTER`); la migración se ejecuta a mano con la cuenta de migración. En desarrollo se mantiene el `ALTER` automático. `try/catch` en el IIFE de `server.js`. Documentar usuario MySQL de aplicación sin `ALTER/DROP`. | `core/auth/sesionRepository.js`, `server.js`, docs | Bajo. |
| 2.9 | SEG-15 (parte) | Alojar ionicons localmente (o SRI) en los 4 HTML; añadir `Permissions-Policy` (`camera=(), microphone=(), geolocation=()`) vía Helmet/cabecera propia. | `public/**/index.html`, `app.js` | Bajo. |
| 2.10 | SEG-28 | Sanear lo que se escribe en el registro: función `paraLog(texto)` que elimina saltos de línea y caracteres de control y recorta a 100 caracteres; usarla para el correo de los intentos de login (o registrar solo un hash truncado del correo). Agrupar los avisos de salas rechazadas del socket en **una** línea por evento (con el conteo) en lugar de una por sala. | `core/auth/authService.js`, `core/websocket/socketManager.js`, `core/utils` | Nulo. |
| 2.11 | SEG-29 | `fetch` saliente con `AbortSignal.timeout(10000)` (constante configurable) para adjuntos/propuestas; si falla un adjunto obligatorio, **no** generar en silencio un PDF incompleto: reintentar una vez y, si sigue fallando, devolver un error de negocio claro ("No se pudo incluir un adjunto en el PDF, inténtalo de nuevo") o marcar el vale con `pdf_incompleto` para regenerarlo. | `vales/services/valePdfService.js` | Bajo-medio: cambia el caso de fallo (hoy silencioso). **[CONSULTAR]** cuál de las dos opciones prefieres. |
| 2.12 | SEG-31 | Que `Secure` de las cookies dependa de `NODE_ENV !== 'development'` (o quitar `test` de los valores permitidos si no se usa). | `core/auth/tokenService.js` o `config/env.js` | Nulo. |

---

## Fase 3 — Hardening y mejoras adicionales (rama `security/fase-3`)

| Orden | ID | Qué se hace | Notas |
|---|---|---|---|
| 3.1 | SEG-15 | CSP primero en `Report-Only` con endpoint de reportes en el log; corregir los scripts/estilos inline que aparezcan; pasar a enforcing cuando no haya reportes. | **[CONSULTAR]** nonce vs mover inline. |
| 3.2 | SEG-12 | Bucket privado + URL firmada de vida corta en `descargarPdf` y para adjuntos/propuestas (`createSignedUrl`). Migrar objetos existentes y actualizar URLs. | **[CONSULTAR]**, opción (b) del informe. Requiere probar PDFs, propuestas y adjuntos en todos los roles. |
| 3.3 | SEG-08 | Si se decide (b) del informe: `authenticateJWT` valida que la fila de `sesiones_activas` siga vigente (PK indexada) en rutas de escritura/admin. | **[CONSULTAR]**. |
| 3.4 | SEG-19 | Helper `db.transaction(fn)` (conexión dedicada del pool) y uso en crear vale/tienda/taller, asignaciones y fusión. | **[CONSULTAR]**. |
| 3.5 | SEG-18 | Tabla `auditoria` (usuario, acción, entidad, id, fecha, IP) para login/fallos/bloqueos, cambios de permisos y de contraseña, desactivaciones y cancelaciones; sin contraseñas ni tokens. Rotación de logs de archivo (`logs/` ya está ignorado). | Tabla nueva; no toca las existentes. |
| 3.6 | SEG-20 | Filtrado/paginación del buzón en SQL (o al menos limitar columnas y usar índices) para no cargar toda la tabla por petición. | Cambio interno; conservar la forma de la respuesta. |
| 3.7 | SEG-22 | `SOCKET_CORS_ORIGIN` obligatorio en producción; `activeConnections` como `Map<usuario, Set<socket>>` para que `sesion_revocada` llegue a todas las pestañas. | Bajo. |
| 3.8 | SEG-23 | `logout` y demás acciones con efecto solo por POST (mantener GET solo para `session_check`/`csrf`); marcar `csrf` como obsoleto. | Verificar antes qué páginas llaman `?action=logout` por GET (dashboard.js, admin authApi.js) y cambiarlas juntas. |
| 3.9 | — | Prefijo `__Host-` en las cookies en producción (requiere HTTPS, `Path=/`, sin `Domain`). | Solo si el hosting cumple lo anterior. |
| 3.11 | SEG-30 | Variable obligatoria `DB_SSL` (`true`/`false`); si es `true`, pasar `ssl: { rejectUnauthorized: true }` a `createPool`. **[CONSULTAR]** según si la base de Hostinger es local al servidor de la app o remota. | `config/env.js`, `config/database.js`, `.env.example` |
| 3.10 | — | `.gitignore`: agregar `portal.zip`, `pruebas/`; revisar `skills-lock.json`/`.agents/Skills` para que no lleguen al despliegue. | Nulo. |

---

## Verificación de cada fase

Al cerrar **cada** fase se comprueba, en un entorno con la base de demostración y el bucket de pruebas (nunca datos reales):

1. **Compila y arranca:** `node --check` de los archivos tocados; el servidor levanta sin errores ni advertencias nuevas; en producción simulada (`NODE_ENV=production` con secreto válido) también.
2. **Rutas:** el barrido de rutas de las pruebas T-01…T-24 (abajo) responde lo esperado.
3. **Autenticación:** login correcto, login con contraseña mala, logout, renovación con access vencido (prueba de 43 comprobaciones de `feature/refresh-token` y prueba de 47 de `feature/env-obligatorias` como regresión), cierre de sesión al cambiar contraseña.
4. **Autorización:** matriz rol × endpoint (Asesor, Supervisor, Encargado, Técnico, Gerente, Administrador) con tokens firmados localmente; un rol no accede a otro; detalle/PDF de un vale ajeno → 404 "No tienes acceso".
5. **WebSockets:** sin cookie → rechazado; con sesión → conecta y se une solo a sus salas; una sala ajena (`vale:<id>` que no le corresponde) → no se une; llega un `vale_evento` tras una acción.
6. **Uploads a Supabase:** subir imagen y PDF válidos al bucket de pruebas y verificar que el archivo abre; subir `.svg`/`.html` renombrado a `.png`, tipo declarado falso, archivo > límite, y extensión doble → rechazados; verificar que el nombre en Storage es aleatorio.
7. **PDFs:** crear un vale con imágenes y un PDF adjunto; generar, ver y regenerar (modificación); un PDF adjunto de muchas páginas se rechaza (tras 2.3).
8. **Base de datos:** conexión con el usuario de aplicación (sin `ALTER/DROP`); las consultas de la app funcionan; ninguna respuesta contiene texto de MySQL.
9. **Frontend:** recorrer Login, Dashboard, Administración (5 pestañas) y Vales por rol; consola sin errores nuevos.

---

## Pruebas de seguridad (scripts a crear en `scripts/security/`, no destructivas)

Se apoyan en las sondas usadas en la auditoría (JWT firmados localmente con `JWT_SECRET`, servidor local + base de demostración). Cada prueba indica el **resultado esperado después de corregir**; las que hoy fallan están marcadas.

| Id | Prueba | Esperado tras la corrección | Hoy |
|---|---|---|---|
| T-01 | Sin sesión: `GET /api/vales`, `/api/admin/usuarios`, `/api/modules`, `/api/vales/1/pdf`; páginas `/dashboard/`, `/modules/admin/` | 401 en API, 302 a login en páginas | OK |
| T-02 | Token inválido / firmado con otro secreto / expirado / `alg: none` | 401 | OK (cubierto por pruebas de refresh) |
| T-03 | Usuario Asesor pide el detalle y el PDF de un vale de otro asesor (cambiar el id) | 404 "No tienes acceso…" | OK |
| T-04 | Usuario sin `vales.ver` abre `/modules/vales/`, `/modules/%76ales/`, `/modules/./vales/`, `/modules/VALES/`, `/modules/%61dmin/` y sus JS | 302 (páginas) / 403 (recursos) en **todas** | **FALLA** (SEG-06) |
| T-05 | `GET /api/admin/usuarios` con `admin.ver` | Ningún elemento contiene `password_hash` | **FALLA** (SEG-01) |
| T-06 | Login con `email` como objeto/arreglo/número/muy largo; JSON malformado | 400/401 con mensaje genérico, sin texto de MySQL | **FALLA** (SEG-02/05) |
| T-07 | `GET /api/vales/abc`, `/1e999`, `/-1`, `/9999999999999999999` | 400 "Identificador inválido" o 404 de negocio, sin "Unknown column" | **FALLA** (SEG-02/24) |
| T-08 | Fuerza bruta: 11 intentos con el mismo correo; luego con `Admin@…`/`ADMIN@…`; luego 60 correos distintos | 429 en el 11.º; 429 también con otra capitalización; 429 por IP tras el umbral | **FALLA** (SEG-03) |
| T-09 | Medir latencia login: correo inexistente vs. correo real con clave mala (30 muestras) | Diferencia < 15 % | **FALLA** (5 ms vs 133 ms en la segunda pasada) |
| T-10 | Cambiar la contraseña de un usuario con sesión abierta y usar su refresh token | 401 (sesión revocada) | **FALLA** (SEG-07) |
| T-11 | Desactivar un usuario con sesión abierta y usar su refresh | 401 inmediato | Parcial (cae en ≤15 min) |
| T-12 | Inyección SQL en filtros: `?busqueda=' OR 1=1 --`, `?correlativo=%27;DROP…`, `estado[]=…` | Sin cambio de resultados ni errores SQL | OK (SQL parametrizado) |
| T-13 | XSS: crear usuario con nombre `<img src=x onerror=alert(1)>`; mensaje de mantenimiento con `<script>`; cliente/descripcion con HTML en un vale | Se muestran como texto en dashboard, tablas, modales, toasts y página 503 | **FALLA** (dashboard, mantenimiento) |
| T-14 | Path traversal: `/js/..%2f.env`, `/assets/..%5c..%5c.env`, `/modules/%2e%2e/%2e%2e/.env` | 404 | OK |
| T-15 | Upload: `.svg` con `Content-Type: image/png`; `.html` renombrado `.jpg`; PDF con magic bytes falsos; imagen > 2 MB; PDF > 3 MB; 3 000 campos de texto extra; 11 imágenes | Rechazados con mensaje claro; sin agotar memoria | Parcial: **OK** SVG, HTML, 2,5 MB, 4 MB y 11 imágenes; **FALLA** los 3 000 campos (aceptados, 3,1 MB en 71 ms) |
| T-16 | PDF adjunto de 500 páginas (generado con pdf-lib) | Rechazado por tope de páginas; CPU/memoria acotadas | **FALLA** (SEG-11) |
| T-17 | 300 peticiones/s a `/api/auth/refresh` con tokens inventados; 300 a `/api/vales` | 429 tras el umbral; memoria estable | **FALLA** (SEG-09: 300 en 531 ms, ninguna 429) |
| T-18 | WebSocket: sin cookie; con firma falsa; con sesión válida pidiendo `vales:admin`, `taller:<ajeno>`, `vale:<ajeno>`; 300 `register_module` seguidos | Rechazo / sin unión a la sala / limitación de tasa | Parcial: **OK** el rechazo y las salas (solo `asesor:63` y `role_2` de 11); **FALLA** el límite de tasa (300 aceptados, 309 líneas de log) |
| T-19 | Idempotencia: reutilizar la clave de otro usuario/endpoint; clave de 300 caracteres | 400/409 sin devolver datos ajenos ni error SQL | **FALLA** (SEG-13) |
| T-20 | Arranque en producción simulada con `JWT_SECRET` de ejemplo / < 32 caracteres | El servidor se niega a arrancar con mensaje claro | **OK** (solventado en #29; verificado en esta pasada) |
| T-21 | Subir un PNG de 225 bytes que declara 50 000 × 50 000 px | Rechazado por dimensiones (400 "imagen demasiado grande"); nunca llega a Supabase ni al PDF | **FALLA** (SEG-27: pasa magic bytes y `optimizar()` la devuelve intacta) |
| T-22 | Login con `email` = `x@x.com\n[Auth] FORJADO…` y ráfaga de 300 salas rechazadas | El log muestra una sola línea por evento, sin saltos de línea inyectados | **FALLA** (SEG-28: línea falsa reproducida; 309 líneas) |
| T-23 | Simular Supabase lento (servidor local que no responde) durante la generación de un PDF | La generación aborta a los 10 s con error claro; el proceso sigue atendiendo | **FALLA** (SEG-29: sin timeout; adjunto omitido en silencio si falla) |
| T-24 | Arrancar con `NODE_ENV=test` y hacer login | Cookies con `Secure` (o el valor `test` no se acepta) | **FALLA** (SEG-31) |

Notas de ejecución: usar solo la base de demostración; las pruebas que crean datos (T-13, T-15, T-19) usan el bucket de pruebas y limpian lo que crean; T-08/T-17 se ejecutan con el limitador reiniciado (reiniciar el servidor entre corridas).

---

## Resumen de cambios previstos (para el resultado final de cada fase)

- **Archivos nuevos previstos:** `core/utils/errores.js`, `core/utils/validar.js`, `scripts/security/*.js`; (fase 3) helper de transacciones y tabla `auditoria`.
- **Dependencias:** ninguna nueva; actualizar `multer` a 2.4.0 y parches menores (`express`, `mysql2`, `socket.io`, `@supabase/supabase-js`, `sharp`) solo tras probar compatibilidad. No se actualizan mayores (express 5, bcryptjs 3, dotenv 18).
- **Esquema:** columnas opcionales en `idempotency_keys` (`usuario_id`, `endpoint` ya existe), tabla `auditoria` (fase 3). Se documentan en `database/schema.sql` y como `ALTER` manual para producción.
- **Orden recomendado si el tiempo es corto:** 1.1 → 1.4 → 1.2 → 1.3 → 1.5 → 1.8 → 1.6 → 2.1 → 2.2 → 2.5. Eso cierra todo lo verificado como explotable (incluida la bomba de descompresión).
- **Variables de entorno nuevas previstas** (todas obligatorias, coherente con #29): `TRUST_PROXY`, `DB_SSL`; opcional `LOGIN_MAX_POR_IP`.