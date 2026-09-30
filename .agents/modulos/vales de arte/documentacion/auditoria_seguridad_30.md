# Correcciones #30 — Auditoría de seguridad (informe, segunda pasada)

Estado: **solo auditoría. No se modificó código.** El plan para corregir lo encontrado está en `plan_remediacion_30.md` (misma carpeta).

Historial de este documento:
- **Primera pasada (2026-09-29):** sobre `feature/refresh-token`. Dejó los hallazgos SEG-01 a SEG-26.
- **Segunda pasada (2026-09-29, esta versión):** sobre `dev` actualizado (incluye refresh token #28 y variables de entorno obligatorias #29). Se **re-verificó cada hallazgo** contra el código y con sondas nuevas, se buscaron hallazgos nuevos y se completaron las áreas de la guía que la primera pasada no había cubierto (CSRF, logging, WebSockets, DoS, producción). Los hallazgos nuevos son SEG-27 a SEG-32; el estado actual de todos está en la sección 2.1.

- Código auditado: rama `fix/auditoria-seguridad` (= `dev` + estos documentos), commit base `1531bc2`.
- Método: lectura de `src/` completo, del frontend (`public/`), `package.json`, `.env`/`.env.example`, `docker-compose.yml` y las reglas de `.agents/reglas/`; `npm audit`/`npm outdated`; y **sondas HTTP/WebSocket no destructivas** contra dos servidores locales con la base de demostración (desarrollo en el puerto 3061 y modo `production` en el 3062, sin datos reales). **[VERIFICADO]** = reproducido con esas sondas; **[CÓDIGO]** = sale de leer el código; **[PARCIAL]** = se verificaron los pasos previos pero no se ejecutó el impacto final por riesgo.
- Fuera de alcance: pruebas contra Supabase real y contra Hostinger, pentest de red/infraestructura, revisión línea por línea de los ~57 archivos JS del frontend (se hizo barrido automático de interpolaciones + revisión manual de las sospechosas).

---

## 1. Resumen ejecutivo

**Resultado de la re-verificación:** de los 26 hallazgos de la primera pasada, **1 quedó solventado** (SEG-17, gracias a las variables obligatorias de #29), **3 quedaron parcialmente solventados** (SEG-16, SEG-19 y SEG-22) y **los otros 22 siguen igual** porque ninguno de los cambios recientes tocó ese código. Se encontraron **6 hallazgos nuevos** (SEG-27 a SEG-32), ninguno crítico.

Los cimientos siguen siendo buenos: SQL parametrizado, sin IDOR en lo probado, cookies httpOnly + SameSite=Strict (y `Secure` en modo producción, verificado), JWT con algoritmo fijado, uploads con magic bytes y nombre generado por el servidor, path traversal bloqueado, todo lo protegido responde 401/302 sin sesión, y las salas de WebSocket rechazan lo que no corresponde (verificado con una sesión de asesor: de 11 salas pedidas solo entró a `asesor:63` y `role_2`).

Lo que sigue pendiente antes de producción, en orden de gravedad:

1. **ALTO — `password_hash` de todas las cuentas en `GET /api/admin/usuarios`** (SEG-01, re-verificado hoy: 86/86).
2. **ALTO — Errores internos de MySQL/Supabase hacia el cliente** (SEG-02, re-verificado: login con `email` como arreglo y `/api/vales/abc`).
3. **ALTO — Fuerza bruta/credential stuffing** (SEG-03, re-verificado: otra capitalización del correo reinicia el límite; 12 correos distintos sin freno) y enumeración por tiempo (SEG-04: 5 ms vs 133 ms).
4. **MEDIO — Brechas de los cambios de #30:** gate `/modules` evadible con `%76ales`, `/./`, mayúsculas (SEG-06); sesiones no revocadas al cambiar contraseña (SEG-07); refresh sin límite de tasa (SEG-09).
5. **MEDIO — Robustez ante abuso:** multer acepta 3 000 campos extra (SEG-10, re-verificado); PDFs sin tope de páginas (SEG-11); **nuevo:** una imagen "bomba de descompresión" pasa todas las validaciones (SEG-27).
6. **MEDIO — Configuración de producción:** falta `trust proxy` (SEG-16), bucket público con datos de clientes (SEG-12, requiere decisión).

**No existe "seguro" absoluto.** Riesgos residuales en la sección 9.

---

## 2. Tabla de hallazgos

Riesgo: CRÍTICO / ALTO / MEDIO / BAJO. "Afecta funcionalidad" indica si la corrección puede cambiar comportamiento visible.

| ID | Riesgo | Vulnerabilidad | Archivo (aprox.) | Prueba | Afecta funcionalidad |
|---|---|---|---|---|---|
| SEG-01 | ALTO | Listado y respuestas de usuarios exponen `password_hash` | `admin/repositories/usuarioAdminRepository.js:6-22` (`SELECT u.*`), `:28,:33` (`SELECT *`); `adminService.crearUsuario/actualizarUsuario` devuelven la fila completa | VERIFICADO | No (el frontend no usa esos campos) |
| SEG-02 | ALTO | Mensajes de error internos (MySQL, Supabase, bucket) devueltos al cliente | `core/auth/authController.js:102`; `vales/controllers/valeController.js` (todos los `catch → error.message`, líneas 88-306); `admin/controllers/adminController.js`; `core/files/supabaseStorage.js` (`detalleError` incluye bucket y HTTP) | VERIFICADO | Sí, leve: los mensajes de negocio se conservan, los inesperados pasan a genérico |
| SEG-03 | ALTO | Rate limit de login evadible y sin límite por IP; columnas de bloqueo sin uso | `core/auth/authRoutes.js:16-20` (clave `ip:email` sin normalizar); `usuarios.intentos_fallidos/bloqueado_hasta` nunca se usan | VERIFICADO | No |
| SEG-04 | MEDIO | Enumeración de cuentas por tiempo de respuesta (5 ms sin usuario vs 97 ms con usuario) | `core/auth/authService.js:52-65` | VERIFICADO | No |
| SEG-05 | MEDIO | Sin validación de tipos del body/query: `email` como objeto/arreglo llega a `pool.query`, que expande objetos y arreglos en el SQL | `authService.authenticate`, `db.query` usa `pool.query` (`config/database.js`), controladores con `Number()`/spread sin validar | VERIFICADO (login) | No |
| SEG-06 | MEDIO | Gate `/modules` evadible por codificación/normalización de ruta (**cambio nuevo de #30**) | `core/permissions/permissionMiddleware.js` `requireModuleAccess` (`req.path.split('/')[1]`) | VERIFICADO | No |
| SEG-07 | MEDIO | Cambiar/resetear contraseña o desactivar no elimina la fila de sesión ni el refresh token (**diseño nuevo de #30**) | `adminService.actualizarUsuario/establecerActivoUsuario` (solo emite `sesion_revocada` por socket a la última pestaña); `sesionRepository` | CÓDIGO | No |
| SEG-08 | MEDIO | Access token válido hasta 15 min tras logout/desactivación (token sin estado) | `permissionMiddleware.authenticateJWT` no consulta sesión | CÓDIGO | REQUIERE DECISIÓN |
| SEG-09 | MEDIO | Sin rate limit general ni en `/api/auth/refresh`, `/api/auth/session` ni socket; la caché de coalescing crece con cada token distinto durante 30 s | `app.js`, `core/auth/tokenService.js` (`renovacionesRecientes`) | VERIFICADO (300 peticiones en 0,4 s) | No |
| SEG-10 | MEDIO | multer sin `limits.fields/parts/fieldSize/files`: memoria sin cota por petición autenticada; `npm audit`: multer 2.3.0 (DoS, fix 2.4.0) | `vales/routes.js:11-22` | CÓDIGO + npm audit | No |
| SEG-11 | MEDIO | PDFs adjuntos: `PDFDocument.load` + `copyPages` de todas las páginas, sin tope de páginas/tiempo; enlaces/anotaciones del PDF externo se copian al PDF oficial | `vales/services/valePdfService.js:121-122` | CÓDIGO | Sí, leve (rechazar PDFs enormes) |
| SEG-12 | MEDIO | Datos de clientes (PDF del vale, adjuntos, propuestas) en bucket **público**; `descargarPdf` autoriza y luego redirige a la URL pública permanente | `vales/controllers/valeController.js:155-167`, `core/files/supabaseStorage.js` | CÓDIGO | REQUIERE DECISIÓN |
| SEG-13 | MEDIO | `idempotency_keys` sin alcance de usuario/endpoint, sin validar formato/largo, sin caducidad | `core/idempotency/idempotencyRepository.js`, `valeCreacionService.crearVale` | CÓDIGO | No |
| SEG-14 | MEDIO | XSS almacenado/reflejado por interpolación sin escapar | `public/js/dashboard.js:47` (nombre del usuario en `innerHTML`); `core/permissions/maintenanceMiddleware.js:42` (`${mensaje}` en el HTML 503 que ve **todo** usuario); `public/modules/admin/js/views/mantenimiento.js:19`; `public/modules/vales/js/actions/encargado.js:91,153` (`href` sin validar esquema, valores generados por el servidor) | CÓDIGO | No |
| SEG-15 | MEDIO | Sin CSP ni Permissions-Policy; ionicons cargado desde `unpkg.com` sin Subresource Integrity en 4 HTML | `app.js:24` (`contentSecurityPolicy:false`); `public/**/index.html:9-10` | VERIFICADO (cabeceras) | Sí si se activa CSP (hay scripts inline) |
| SEG-16 | MEDIO | Falta `trust proxy` (Hostinger es proxy inverso): todos los clientes comparten IP en el limitador → un atacante bloquea el login de cualquier correo; y si falta `NODE_ENV=production` las cookies salen sin `Secure` sin avisar | `app.js`, `config/env.js` | CÓDIGO | No |
| SEG-17 | MEDIO | `JWT_SECRET` solo se valida como "no vacío": el valor de ejemplo (`cambiar_este_secreto…`) es aceptado; sin longitud mínima | `config/env.js:15-19`, `.env.example` | CÓDIGO | No |
| SEG-18 | MEDIO | Los logs de error de BD incluyen el SQL **con los valores** (hashes de contraseña, datos personales); sin rotación ni auditoría persistente | `config/database.js:43` | VERIFICADO (`error.sql` incluye `password_hash`) | No |
| SEG-19 | MEDIO | Base de datos: ejemplo/Docker usan `root`; `asegurarEsquema()` (nuevo) requiere `ALTER` al arrancar y no maneja el fallo; `pool.query` (escapado en cliente) en vez de `execute`; sin transacciones en operaciones multi-paso | `.env.example`, `docker-compose.yml`, `core/auth/sesionRepository.js`, `server.js` | CÓDIGO | REQUIERE DECISIÓN (transacciones) |
| SEG-20 | BAJO | El buzón carga toda la tabla de vales en memoria en cada petición (filtra/ordena/pagina en JS) | `vales/services/valeBuzonService.js` `obtenerBuzon` | CÓDIGO | No |
| SEG-21 | BAJO | Política de contraseñas débil: mín. 8, sin complejidad ni máximo (bcrypt trunca a 72 bytes), coste 10, sin cambio propio ni expiración | `adminService.js:79,87,121,124` | CÓDIGO | REQUIERE DECISIÓN (cambio propio) |
| SEG-22 | BAJO | Socket: CORS con valor por defecto `localhost:3000`; `register_module` sin límite de tasa (cada sala `vale:` consulta BD); `activeConnections` guarda solo el último socket por usuario | `core/websocket/socketManager.js:56-58,~115-140` | VERIFICADO (CORS) + CÓDIGO | No |
| SEG-23 | BAJO | Acciones con efecto por GET (`/api/auth?action=logout`); endpoint `csrf` decorativo | `core/auth/authController.js` `handleQueryAction` | CÓDIGO | No (mitigado por SameSite=Strict) |
| SEG-24 | BAJO | Validación de entrada incompleta en vales: teléfono sin formato (la spec lo pide), tipos no verificados (`producto.trim()`), `Number(req.params.id)` acepta `NaN/Infinity` y llega a SQL | `vales/services/valeCreacionService.js:232-294`, `valeController.js` | VERIFICADO (`/api/vales/abc`) | No |
| SEG-25 | BAJO | Dependencias: multer (moderado) y parches menores pendientes (express 4.22.3, mysql2 3.24.4, socket.io 4.8.4, supabase-js 2.117.2, sharp 0.35.5) | `package.json` | npm audit / outdated | No |
| SEG-26 | INFO | `portal.zip` (26 MB) y `pruebas/` no versionados pero sin ignorar; `.env` sí está ignorado y no aparece en el historial de git | raíz del repo | verificado | No |

### 2.1 Estado actual de los hallazgos (segunda pasada)

La tabla anterior conserva el detalle de la primera pasada. Este es el estado hoy, tras las sondas y la lectura del código sobre `dev` actualizado:

| ID | Estado hoy | Evidencia de la re-verificación |
|---|---|---|
| SEG-01 | **PERSISTE** (ALTO) | `GET /api/admin/usuarios` → 86/86 con `password_hash`; `SELECT u.*` sin cambios |
| SEG-02 | **PERSISTE** (ALTO) | Login con `email:["a","b"]` → texto de sintaxis SQL de MySQL; `/api/vales/abc` → `Unknown column 'NaN'`; 39 `catch → error.message` en los controladores |
| SEG-03 | **PERSISTE** (ALTO) | 14 intentos → 429 desde el 11.º, pero 6 variantes de mayúsculas → 401 (sin bloqueo); 12 correos distintos → 12 × 401 |
| SEG-04 | **PERSISTE** | 5,1 ms (correo inexistente) vs 133,5 ms (correo real) |
| SEG-05 | **PERSISTE** | Mismo caso del arreglo; `db.query` sigue con `pool.query` |
| SEG-06 | **PERSISTE** | `/modules/%76ales/`, `/%76ales/js/app.js`, `/./vales/`, `/VALES/`, `/%61dmin/` → 200 sin permiso |
| SEG-07 | **PERSISTE** | `adminService` no referencia `sesionRepository`; no existe `eliminarPorUsuario` |
| SEG-08 | **PERSISTE** (decisión) | `authenticateJWT` sin consulta de sesión |
| SEG-09 | **PERSISTE** | 300 refresh inventados en 531 ms, todos 401, sin 429 |
| SEG-10 | **PERSISTE** | 3 000 campos de texto (3,1 MB) aceptados por multer (el 400 fue solo por validación de negocio); `npm audit`: multer moderado sigue |
| SEG-11 | **PERSISTE** | `valePdfService.js:121-122` sin cambios |
| SEG-12 | **PERSISTE** (decisión) | `descargarPdf` redirige a la URL pública |
| SEG-13 | **PERSISTE** | `idempotencyRepository` sin `usuario_id` |
| SEG-14 | **PERSISTE** | `dashboard.js:47` y `maintenanceMiddleware.js:42` sin escapar (0 usos de `escapeHtml` en el middleware) |
| SEG-15 | **PERSISTE** | Sin `content-security-policy` ni `permissions-policy`; ionicons en `unpkg.com` sin SRI |
| SEG-16 | **PARCIAL** | `NODE_ENV` ahora es obligatoria y en modo `production` las cookies salen con `HttpOnly; Secure; SameSite=Strict` (**verificado** en el servidor del puerto 3062). Sigue sin `app.set('trust proxy')` |
| SEG-17 | **SOLVENTADO** | `env.js`: `JWT_SECRET` ≥ 32 caracteres y, en producción, rechaza el valor de ejemplo (**verificado**: arrancar en `production` con el secreto de ejemplo → `[FATAL]`). Que sea aleatorio sigue dependiendo de quien lo genere |
| SEG-18 | **PERSISTE** | `database.js:43` sin cambios; el log de login sigue con el correo en claro |
| SEG-19 | **PARCIAL** | Mejoró: `.env.example` ya no trae `DB_USER=root` y `DB_PASSWORD` vacía es FATAL en producción. Persisten: `asegurarEsquema()` con `ALTER` al arrancar sin `try/catch`, `pool.query`, sin transacciones |
| SEG-20 | **PERSISTE** | Sin cambios en `valeBuzonService` |
| SEG-21 | **PERSISTE** | Sin cambios en la política de contraseñas |
| SEG-22 | **PARCIAL** | **Solventado:** ya no existe el CORS por defecto (`SOCKET_CORS_ORIGIN` obligatoria; con un origen ajeno no se envía `Access-Control-Allow-Origin`, verificado). **Persiste:** sin límite de tasa en `register_module` (ráfaga de 300 en un envío aceptada; 309 avisos de sala rechazada escritos al log) y `activeConnections` guarda un solo socket por usuario |
| SEG-23 | **PERSISTE** | `handleQueryAction` sin cambios |
| SEG-24 | **PERSISTE** | `/api/vales/1e999` → `Unknown column 'Infinity'` |
| SEG-25 | **PERSISTE** | `npm audit`: multer; parches pendientes (mysql2 ahora 3.24.5) |
| SEG-26 | **PERSISTE** | `.gitignore` sin `portal.zip` ni `pruebas/` |

**Resumen:** 1 solventado (SEG-17), 3 parciales (SEG-16, SEG-19, SEG-22), 22 persisten.

### 2.2 Hallazgos nuevos de la segunda pasada

| ID | Riesgo | Vulnerabilidad | Archivo (aprox.) | Prueba | Afecta funcionalidad |
|---|---|---|---|---|---|
| SEG-27 | MEDIO | **Bomba de descompresión en imágenes.** Un PNG de 225 bytes que declara 50 000 × 50 000 px (2 500 MP) pasa la verificación de magic bytes y `optimizar()` lo **devuelve intacto**: el límite de 40 MP de sharp solo *omite la optimización* (el `catch` devuelve el buffer original), no rechaza el archivo. Se guarda en Supabase y `valePdfService` lo decodifica completo con `embedPng` al generar el PDF (un PNG real de menos de 2 MB puede declarar miles de megapíxeles de datos muy comprimibles) → memoria agotada / caída del proceso Node por un usuario con permiso de crear vales. | `core/files/imageOptimizer.js` (`catch → return buffer`), `core/files/fileSignature.js`, `vales/services/valePdfService.js:192-197` | PARCIAL (pasos 1-3 verificados; el impacto final no se ejecutó para no agotar la memoria de esta máquina) | Sí, leve (rechazar imágenes con dimensiones absurdas) |
| SEG-28 | BAJO | **Inyección en el registro (log forging) y PII en logs.** El correo del intento de login se escribe sin sanear: un `email` con salto de línea produce una línea falsa `[Auth] FORJADO: login exitoso de admin@…` en el log (verificado). Además cada sala de socket rechazada escribe una línea (309 líneas por un solo envío): un usuario autenticado puede inflar el log. | `core/auth/authService.js:53,60,67`; `core/websocket/socketManager.js` (`console.warn` por sala) | VERIFICADO | No |
| SEG-29 | BAJO | **Peticiones salientes sin timeout e integridad silenciosa del PDF.** `fetch(url)` de adjuntos/propuestas no tiene `AbortSignal`: si Supabase se cuelga, la generación del PDF y la petición del usuario quedan colgadas. Y las fusiones/imágenes fallidas se tragan con `console.warn`: el PDF oficial puede salir **sin** un adjunto sin avisar a nadie. (No hay SSRF: las URLs salen de la base de datos, generadas por el servidor.) | `vales/services/valePdfService.js:120,192` | CÓDIGO | Sí, leve (mostrar el fallo) |
| SEG-30 | BAJO | **Conexión a MySQL sin TLS.** `createPool` no define `ssl`. Si la base de Hostinger no está en el mismo servidor que la app, credenciales y datos viajan sin cifrar. | `config/database.js` | CÓDIGO | REQUIERE DECISIÓN (depende de la topología en Hostinger) |
| SEG-31 | BAJO | **`NODE_ENV=test` deja las cookies sin `Secure`.** Solo `production` activa `Secure`; un despliegue con `test` (permitido por la validación) quedaría sin él. | `config/env.js`, `core/auth/tokenService.js` | CÓDIGO | No |
| SEG-32 | INFO | **Sala `vale:<id>` inalcanzable para Asesor, Supervisor y Técnico** (el validador devuelve `false` en su rama de rol antes de llegar a la de `vale:`; verificado: el asesor 63 no pudo unirse a `vale:145`, que es suyo). No es una brecha sino una limitación funcional: el historial en vivo no se actualiza para esos roles. Se anota para no "arreglarlo" abriendo la sala sin la validación de pertenencia. | `vales/events.js:32-51` | VERIFICADO | — |

### 2.3 Estado tras ejecutar la Fase 1 (rama `security/fase-1`)

| ID | Antes | Ahora | Cómo se verificó |
|---|---|---|---|
| SEG-01 | PERSISTE (ALTO) | **SOLVENTADO** | `GET /api/admin/usuarios`, crear y editar usuario: ningún `password_hash`, `intentos_fallidos` ni `bloqueado_hasta`; el panel (86 usuarios) sigue funcionando |
| SEG-02 | PERSISTE (ALTO) | **SOLVENTADO** | 25 casos: arreglos/objetos en login y en campos de vales, ids inválidos, JSON malformado, error de BD forzado, Storage caído → respuestas genéricas o "Identificador inválido"; los mensajes de negocio se conservan |
| SEG-03 | PERSISTE (ALTO) | **SOLVENTADO** | Correo normalizado (mayúsculas/espacios), límite por IP tras ~100 fallos, bloqueo de cuenta a los 5 fallos (15 min), reinicio al acertar |
| SEG-04 | PERSISTE | **SOLVENTADO** | Diferencia de mediana entre correo inexistente y real < 35 % (antes 5 ms vs 133 ms) |
| SEG-05 | PERSISTE | **SOLVENTADO (login y ids)** | Tipos validados en login y en los ids de rutas/cuerpos de vales y administración; la capa de validación completa queda para la Fase 2 (2.6) |
| SEG-06 | PERSISTE | **SOLVENTADO** | 17 variantes (`%76ales`, `./`, `//`, mayúsculas, `vales.`, `\`, `..`) ninguna devuelve 200 sin permiso; rutas legítimas siguen en 200 |
| SEG-07 | PERSISTE | **SOLVENTADO** | Cambiar contraseña o desactivar elimina la sesión: el refresh token anterior da 401 de inmediato |
| SEG-16 | PARCIAL | **SOLVENTADO** | `TRUST_PROXY` obligatoria; 0 ignora `X-Forwarded-For`, 1 lo respeta (verificado) |
| SEG-18 | PERSISTE | **SOLVENTADO** | Los logs ya no contienen SQL con valores ni hashes; el correo se sanea (`paraLog`) |
| SEG-24 | PERSISTE | **SOLVENTADO** | `/api/vales/abc`, `1e999`, `1.5`, `%20`… → 400 "Identificador inválido" |
| SEG-27 | NUEVO (MEDIO) | **SOLVENTADO** | PNG 50 000 × 50 000 en 225 bytes y 8001 × 5000 → 400 por dimensiones; fotos reales de hasta 40 MP siguen pasando |
| SEG-28 | NUEVO (BAJO) | **PARCIAL** | El correo del login ya no puede forjar líneas de log; el log de salas rechazadas del socket (una línea por sala) queda para 2.10 |

Siguen pendientes de las fases 2 y 3: SEG-08, 09, 10, 11, 12, 13, 14, 15, 19, 20, 21, 22, 23, 25, 26, 29, 30, 31 (y la parte de 28 indicada).

---

## 3. Detalle de los hallazgos ALTOS

### SEG-01 — `password_hash` expuesto (ALTO)
- **Dónde:** `usuarioAdminRepository.listarConDetalle()` hace `SELECT u.* …`; `obtenerPorId`/`obtenerPorEmail` hacen `SELECT *`; `crearUsuario` y `actualizarUsuario` devuelven esa fila al navegador.
- **Cómo se explota:** cualquier sesión con el permiso `admin.ver` (hoy solo Administrador, pero el permiso es asignable a cualquier rol desde Roles y Permisos) llama `GET /api/admin/usuarios` y recibe los hashes bcrypt, `intentos_fallidos` y `bloqueado_hasta` de todas las cuentas. Verificado: 86/86 usuarios traen `password_hash`.
- **Impacto:** un hash filtrado permite ataque de diccionario offline; con contraseñas cortas como las de las cuentas de prueba, la recuperación es rápida. También quedan en HAR/caché/DevTools del navegador del administrador.
- **Solución:** listar columnas explícitas (`u.id, u.nombre, u.email, u.rol_id, u.activo, …`), nunca `u.*`; que `obtenerPorId` para uso interno pida el hash solo donde se necesite (login) y que los servicios devuelvan un DTO sin secretos.

### SEG-02 — Errores internos hacia el cliente (ALTO)
- **Dónde:** casi todos los `catch (error) { return res.status(400|401|404).json({ error: error.message }); }`. Los servicios lanzan a la vez errores de negocio (mensajes pensados para el usuario) y errores inesperados (MySQL, Supabase, TypeError) y el controlador no los distingue.
- **Verificado:** `POST /api/auth/login` con `email: ["a","b"]` → `401 {"error":"You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version…"}`; `GET /api/vales/abc` → `404 {"error":"Unknown column 'NaN' in 'where clause'"}`. En subida de adjuntos, `StorageUploadError` incluye el nombre del bucket y el código HTTP de Supabase.
- **Impacto:** revela motor y versión de BD, nombres de columnas/tablas, infraestructura (bucket) y facilita afinar inyecciones. El login además mezcla estos mensajes con la respuesta "credenciales incorrectas".
- **Solución:** clase `ErrorDeNegocio` (mensaje seguro y código HTTP) para los `throw` intencionales y un manejador central que responda mensaje genérico para todo lo demás, registrando el detalle en el log del servidor (`erroresHttp.js` ya existe como punto de partida).

### SEG-03 — Fuerza bruta / credential stuffing (ALTO)
- **Dónde:** `authRoutes.js` limita 10 intentos / 15 min con clave `ipKeyGenerator(req.ip) + ':' + req.body.email` **sin normalizar**.
- **Verificado:** tras agotar los 10 intentos de `admin@munditrofeos.com` (429), las variantes `Admin@…`, `ADMIN@…` (MySQL compara sin distinguir mayúsculas y el login funciona igual) devuelven 401, o sea otra ronda de 10 intentos por cada capitalización (2^n combinaciones). Además 12 correos distintos desde la misma IP → 12 × 401 sin freno: **credential stuffing no se limita**. Las columnas `intentos_fallidos`/`bloqueado_hasta` existen pero no se usan.
- **Solución:** normalizar (`trim().toLowerCase()`) antes de la clave y del SELECT; segundo limitador por IP (más holgado, p. ej. 50/15 min); bloqueo temporal por cuenta usando las columnas existentes (contador que se reinicia al acertar); retraso constante (ver SEG-04).

---

## 4. Brechas introducidas o expuestas por los cambios nuevos de #30

| Cambio | Brecha | Hallazgo |
|---|---|---|
| Gate `requireModuleAccess` en `/modules` | Compara el primer segmento de `req.path` **sin decodificar ni normalizar**: `/modules/%76ales/`, `/modules/%61dmin/`, `/modules/./vales/` y `/modules/VALES/` devuelven **200** a un usuario sin `vales.ver`/`admin.ver` (verificado). La API sigue protegida (`requirePermission` en montaje y por ruta), pero se sirve el HTML/JS del módulo. Con hosting Linux `VALES` da 404 (FS sensible a mayúsculas) pero `%76ales`, `./` y `%61dmin` no. | SEG-06 |
| Refresh token en cookie `path:'/'` | Se envía en cada petición, incluidos estáticos (httpOnly lo protege del JS). Aumenta la superficie de un proxy/log mal configurado que registre cookies. Aceptado por diseño; documentar. | (nota) |
| Sesión = fila con refresh token | Cambiar contraseña, cambiar el rol o desactivar no borra la fila; solo la desactivación falla en la siguiente renovación (≤15 min); un **reseteo de contraseña no invalida** ni el refresh (hasta 12 h) ni el access. | SEG-07 |
| Access de 15 min sin estado | Ventana de hasta 15 min tras logout/desactivación en la que el access sigue siendo válido. Mucho menor que las 12 h anteriores. | SEG-08 |
| Caché `renovacionesRecientes` | Cada refresh token distinto (incluidos inventados) crea una entrada + temporizador por 30 s; sin rate limit, un atacante sin sesión puede inflar la memoria (proporcional a peticiones/segundo × 30 s). Verificado: 300 refresh inventados en 0,4 s, sin freno. | SEG-09 |
| `asegurarEsquema()` en el arranque | Ejecuta `ALTER TABLE` si faltan columnas: exige privilegio `ALTER`, incompatible con un usuario MySQL de mínimo privilegio; si falla, el `async` de `server.js` no tiene `try/catch` (rechazo no manejado → cae el proceso con mensaje poco claro). | SEG-19 |
| `.env` local con `JWT_EXPIRES_IN=24h` | La variable ya no se usa (ahora `ACCESS_TOKEN_EXPIRES_IN`); no es vulnerabilidad, pero un `.env` viejo puede dar la falsa impresión de "24 h". Documentado en correcciones_30. | — |

Lo revisado y que **no** dejó brecha: rotación con compare-and-set, detección de reuso (revoca la sesión), refresh solo hasheado en BD, socket que acepta access vencido solo con sesión vigente, `logout` con access vencido, `sameSite: strict` en ambas cookies.

---

## 5. Lo que se verificó como correcto (controles existentes)

| Área | Resultado |
|---|---|
| SQL | Todo `db.query` usa `?`; las únicas interpolaciones `${}` son fragmentos SQL fijos (`SELECT_VALE`, placeholders). Sin concatenación de entrada de usuario. |
| IDOR / BOLA | `obtenerDetalle`, `obtenerValeParaPdf`, sala `vale:<id>`, `obtenerAsignacionesDeTecnico`, `confirmarRecibido` (`assertPropioDelAsesor`), `asignar` y `_filaDelTecnico` validan pertenencia por rol; `_puedeVerVale` falla cerrado para roles no contemplados. |
| Autorización | Todas las rutas de `vales` y `admin` con `requirePermission`; ahora además `vales.ver`/`admin.ver` en el montaje. Sin sesión: 401 en API y 302 a login en páginas (probado en 7 rutas). |
| Cookies/JWT | httpOnly, SameSite=Strict, `Secure` en producción, algoritmo HS256 fijado, secreto obligatorio. |
| Uploads | Magic bytes reales (JPEG/PNG/WEBP/PDF), tipo declarado solo para elegir la firma, extensión derivada del tipo verificado, nombre físico aleatorio de 128 bits, `upsert:false`, límites 2 MB/3 MB, `limitInputPixels` de 40 MP en sharp, rollback Storage↔BD. |
| Path traversal | 13 rutas/variantes (`..`, `%2e%2e`, `%2f`, `\`, archivos sensibles) contra `/js`, `/css`, `/assets`, `/modules` → 404; `.env`, `package.json`, `database/*`, `src/*`, `.git`, `portal.zip`, `node_modules` no se sirven. `public/` no contiene `.map/.bak/.sql/.zip/.env`. |
| Cabeceras | Helmet activo: HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy: no-referrer`, COOP, sin `X-Powered-By`; `Cache-Control: no-store` en protegido. Sin CORS abierto en HTTP (sin `Access-Control-Allow-Origin`). |
| Socket | Sin cookie o con firma falsa el handshake se rechaza; el CORS del socket es un valor fijo (no refleja `Origin`). |
| Mass assignment | `validarDatosVale` mapea campos explícitos; `crearUsuario` toma solo nombre/email/password/rol/teléfono. |
| XSS frontend | `escapeHtml` en la gran mayoría de las interpolaciones; `toast.js` usa `textContent`; los títulos de modal se escapan en `modal.js` (corregido antes). Excepciones en SEG-14. |
| Secretos | `.env` ignorado por git y sin secretos en el historial de nombres de archivo; sin secretos en el frontend. |

### 5.1 Áreas de la guía revisadas en la segunda pasada

**CSRF — ¿aplica?** No como vulnerabilidad hoy. La autenticación va en cookies, así que en principio sí sería atacable, pero: (1) ambas cookies son `SameSite=Strict` (verificado): el navegador no las envía en peticiones originadas desde otro sitio; (2) los endpoints que cambian datos son `POST/PUT/PATCH/DELETE` con cuerpo JSON o multipart, y `express.json` solo procesa `application/json`; (3) la única acción con efecto por GET es `logout` (SEG-23, impacto nulo por Strict). Por eso **no se recomienda implementar tokens CSRF**; el endpoint `csrf` existente es decorativo. Riesgo residual: un subdominio comprometido del mismo sitio (SameSite considera "mismo sitio" a todos los subdominios): se mitiga usando un dominio dedicado para el portal.

**WebSockets.** Verificado con una sesión real de asesor: (a) sin cookie, con firma falsa o sin `sid` de sesión vigente el handshake se rechaza; (b) de 11 salas pedidas (`vales:admin`, `asesor:99`, `supervisor:5`, `taller:1`, `tecnico:9`, `vale:1`, `role_1`, `role_8`…) solo se concedieron `asesor:63` y `role_2`; (c) el servidor solo atiende el evento `register_module`. Pendiente: límite de tasa y tope de conexiones (SEG-22), log de rechazos (SEG-28). El CORS ya queda restringido a los orígenes del `.env`.

**Logging y auditoría.** Hoy solo hay `console.log/warn/error` a la salida estándar: se registran intentos de login fallidos (con el correo sin sanear, SEG-28), reuso de refresh token y errores. **No** hay registro persistente de cambios de permisos, cambios de contraseña, desactivaciones, cancelaciones ni asignaciones (el historial de vales cubre solo los estados del vale). No se registran contraseñas ni tokens (verificado por lectura); sí puede aparecer SQL con valores en errores de BD (SEG-18). Sin rotación de logs.

**Denegación de servicio.** Sin rate limit general (SEG-09); multer sin cota de campos (SEG-10); PDFs sin tope de páginas (SEG-11); bomba de descompresión (SEG-27); `fetch` sin timeout (SEG-29); el buzón carga toda la tabla por petición (SEG-20); `register_module` sin límite (SEG-22). Límites que sí existen: cuerpo JSON 200 KB, imágenes 2 MB, documentos 3 MB, 10 imágenes y 5 documentos, 60 búsquedas/min por usuario, 10 logins/15 min por correo.

**Mínimo privilegio.** Roles: los permisos `admin` del Administrador no se pueden quitar y los permisos "ver" gobiernan el acceso a cada módulo en API y páginas (con la brecha SEG-06). Base de datos: la cuenta de la app debería carecer de `ALTER/DROP` (SEG-19). Archivos: la app no escribe en disco (todo va a Supabase), un buen punto de partida.

**Producción.** Verificado en modo `production`: cookies con `Secure`; arranque bloqueado con el secreto de ejemplo; `SOCKET_CORS_ORIGIN` exige `https`; `DB_PASSWORD` vacía prohibida. Falta `trust proxy`, CSP y `Permissions-Policy`.

---

## 6. Puntos que REQUIEREN DECISIÓN DEL DESARROLLADOR

1. **Bucket de Supabase público vs privado (SEG-12).** Hoy cualquier URL de PDF/adjunto funciona para quien la tenga, sin sesión, y no caduca. Opciones: (a) dejar público (el nombre aleatorio de 128 bits es la única barrera; simple; riesgo si una URL se filtra por chat/correo); (b) bucket privado + URL firmada de vida corta generada por `descargarPdf` tras autorizar (mínimo cambio de código, requiere migrar el bucket y actualizar las URLs guardadas); (c) el servidor hace de proxy del archivo (más carga y ancho de banda). Recomendado: (b).
2. **¿Revocar el access token al instante? (SEG-08).** Hoy hay una ventana de ≤15 min. Opciones: (a) aceptarla; (b) `authenticateJWT` consulta `sesiones_activas` en cada petición (una consulta indexada por PK; corta al instante logout/desactivación/reseteo); (c) acortar a 5 min. Recomendado: (a) + (b) solo para acciones de escritura o administración.
3. **CSP (SEG-15).** Hay scripts inline en `login/index.html` y estilos inline en varias vistas; una CSP estricta exige moverlos a archivos o usar nonces. Opciones: empezar en modo `Report-Only`, o CSP con `'unsafe-inline'` solo en estilos. Además, decidir si ionicons se aloja localmente (recomendado, elimina la dependencia externa) o se mantiene en unpkg con SRI.
4. **Transacciones (SEG-19).** No hay helper transaccional; crear taller/tienda/vale hace varios INSERT con rollback manual. Un fallo entre pasos puede dejar datos a medias. Opciones: helper `db.transaction(fn)` con conexión dedicada (cambio pequeño y transversal) o dejar los rollbacks manuales actuales. Recomendado: helper, aplicado primero a las operaciones multi-tabla críticas.
5. **Usuario MySQL sin `ALTER` vs migración al arrancar (SEG-19).** Recomendado: usuario de aplicación con solo `SELECT, INSERT, UPDATE, DELETE`; ejecutar `schema.sql`/migraciones con una cuenta aparte en el despliegue, y que `asegurarEsquema()` solo verifique (y falle con mensaje claro) en producción.
6. **Cambio de contraseña por el propio usuario (SEG-21).** Hoy solo el Administrador la cambia desde el panel y ni siquiera la suya. Opciones: endpoint de "cambiar mi contraseña" (pide la actual; revoca sesiones) o mantener el modelo actual. Recomendado: implementarlo antes de producción.
7. **`trust proxy` (SEG-16).** Depende de cuántos saltos haya en Hostinger; hay que confirmarlo (valor 1 en el caso típico) antes de fijarlo, porque un valor mal puesto permite falsear la IP.
8. **TLS hacia MySQL (SEG-30).** Si la base de datos de Hostinger está en otro servidor que la app, activar `ssl` en `createPool` (variable `DB_SSL`); si es `localhost` en el mismo servidor no hace falta. Confirmar la topología.
9. **Verificar WebSockets en el plan de Hostinger.** Algunos planes de hosting Node no soportan WebSocket sostenido; Socket.IO cae a long-polling (funciona, con más carga). Confirmar en el plan contratado.

---

## 7. Configuraciones que NO dependen del código

**En Hostinger (a confirmar en tu plan):**
- Variables de entorno en el panel: `NODE_ENV=production`, `JWT_SECRET` (aleatorio de ≥48 caracteres, distinto al de desarrollo), `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `DB_*`, `SUPABASE_*`, `SOCKET_CORS_ORIGIN=https://<tu-dominio>`.
- HTTPS obligatorio: certificado SSL activo y redirección HTTP→HTTPS a nivel de hosting; el `Secure` de la cookie depende de ello y de `NODE_ENV`.
- Que `.env` no quede dentro de una carpeta servida y que `portal.zip`/`pruebas/` no se suban al hosting.
- Permisos de archivos del hosting (solo lectura para el código, escritura solo donde haga falta).
- Backups del propio hosting: revisar si el plan los incluye y con qué frecuencia; no confiar solo en ellos.

**En MySQL:**
- Usuario de aplicación de mínimo privilegio (`SELECT, INSERT, UPDATE, DELETE` sobre la base `portal_empresarial`; sin `DROP/ALTER/CREATE/GRANT/FILE`), host restringido; el root solo para migraciones.
- Acceso remoto deshabilitado o limitado por IP; contraseña larga distinta por entorno.
- Zona horaria: la app fija `-06:00` por conexión; no depende del servidor.

**En Supabase:** clave de servicio (`SUPABASE_SECRET_KEY`) solo en variables de entorno, rotable; política del bucket (público/privado, ver decisión 1); límite de tamaño de archivo y tipos MIME permitidos a nivel de bucket como segunda barrera.

**No se resuelve desde el código:** disponibilidad/DDoS de red, parches del sistema operativo/Node del hosting, seguridad física, phishing a los trabajadores, contraseñas reutilizadas por los usuarios, y confiabilidad de Supabase/Hostinger.

---

## 8. Backups y recuperación ante desastres (recomendación, no implementada en código)

**Qué proteger:** (1) base MySQL (todo el negocio: vales, usuarios, historial); (2) bucket de Supabase (PDFs, adjuntos, propuestas: las URLs viven en MySQL pero el archivo solo está en Supabase); (3) configuración (`.env`, esquema).

**Estrategia sugerida (simple, sin infraestructura nueva en el código):**
- MySQL: `mysqldump --single-transaction --routines` diario programado desde el hosting (cron) o el sistema de backups del plan, **más una copia fuera del hosting** (otro proveedor o almacenamiento cifrado). Retención sugerida: 7 diarios, 4 semanales, 6 mensuales. Antes de cada despliegue con cambios de esquema: dump manual etiquetado.
- Supabase Storage: los backups de base de Supabase **no incluyen los objetos del bucket**; copiar el bucket periódicamente (semanal como mínimo) a un almacenamiento externo (por ejemplo con `rclone` desde tu máquina o un servicio aparte) y conservar al menos 30 días.
- Secretos: guardar `JWT_SECRET`, credenciales y claves en un gestor de contraseñas del equipo (no en el repositorio); si se pierde `JWT_SECRET` solo se cierran las sesiones, no se pierden datos.
- **Prueba de restauración:** al menos una vez antes de producción y luego trimestral, restaurando en una base/bucket de prueba y comprobando que el portal levanta y los PDFs abren.
- Protección contra error humano: usuario de aplicación sin `DROP`, confirmación reforzada en operaciones destructivas del panel y registro de auditoría de esas acciones (fase 3).

**Procedimiento de recuperación (resumen):**
1. Poner el portal en Modo Mantenimiento (o detener la app).
2. Restaurar el último dump válido en MySQL (cuenta con privilegios de migración).
3. Restaurar el bucket si hubo pérdida de archivos; verificar por muestreo que las URLs guardadas abren.
4. Ejecutar el checklist posterior al despliegue (sección 10) y reabrir el acceso.
5. Rotar `JWT_SECRET` y credenciales si el motivo fue un incidente de seguridad (cierra todas las sesiones).
6. Documentar el incidente y qué datos se perdieron (diferencia entre la hora del backup y la del fallo).

---

## 9. Riesgos que permanecerían tras aplicar el plan

- **Contraseñas débiles o reutilizadas**: la política puede exigir más, pero no evita que una persona use la misma clave en otro sitio; sin 2FA una contraseña robada abre la cuenta.
- **Ventana del access token robado** (≤15 min, o 0 si se adopta la revisión de sesión por petición) y **robo de sesión por malware en el equipo** del trabajador.
- **Administrador comprometido**: puede hacer todo lo que el rol permite; los cambios de permisos y el mensaje de mantenimiento son vectores de XSS almacenado hasta cerrar SEG-14 y activar CSP.
- **Dependencia de terceros**: Supabase (archivos), Hostinger (disponibilidad, backups), npm (cadena de suministro; ionicons externo si no se aloja localmente).
- **Denegación de servicio volumétrica** en red: fuera del alcance del código.
- **Buzón que carga toda la tabla en memoria** (SEG-20): con mucho crecimiento degrada el servicio aunque no sea un ataque.
- **Datos de clientes en PDF**: si se mantiene el bucket público (decisión 1), una URL filtrada sigue funcionando.
- **Sin 2FA, sin auditoría inmutable, sin WAF** (todo es opcional y de otra escala que el proyecto actual).

---

## 10. Checklists

**Antes de producción**
- [ ] SEG-01 a SEG-07 y SEG-27 corregidos y verificados con el script de pruebas del plan.
- [ ] `NODE_ENV=production`, `JWT_SECRET` nuevo (≥48 caracteres), `SOCKET_CORS_ORIGIN` y `trust proxy` definidos.
- [ ] Usuario MySQL de mínimo privilegio; esquema aplicado con cuenta de migración.
- [ ] Decisiones 1-9 de la sección 6 tomadas y documentadas.
- [ ] `npm audit --omit=dev` sin vulnerabilidades altas; multer ≥ 2.4.0.
- [ ] Contraseñas de las cuentas de prueba del `seed.sql`/`users.sql` cambiadas o cuentas eliminadas.
- [ ] Backups configurados y **restauración probada** una vez.
- [ ] `portal.zip` y `pruebas/` fuera del paquete de despliegue.

**Después del despliegue**
- [ ] HTTPS forzado; la cookie `token`/`refresh_token` sale con `Secure; HttpOnly; SameSite=Strict`.
- [ ] Sin sesión: `/api/vales`, `/api/admin/usuarios`, `/dashboard/` → 401/302; `/.env`, `/package.json`, `/src/app.js` → 404.
- [ ] Login: 11.º intento fallido → 429, incluso cambiando mayúsculas del correo.
- [ ] `GET /api/admin/usuarios` no contiene `password_hash`.
- [ ] Un error forzado (id inválido) responde mensaje genérico; el detalle solo está en el log.
- [ ] WebSocket conecta y recibe eventos (o cae a polling sin errores); sin sesión se rechaza.
- [ ] Crear un vale de prueba: sube adjuntos a Supabase, genera el PDF y se descarga con el usuario correcto.
- [ ] Monitoreo básico: revisar logs a las 24 h y a los 7 días; verificar que el primer backup automático existe.