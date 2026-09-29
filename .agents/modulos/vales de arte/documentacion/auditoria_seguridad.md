# Correcciones #30 — Auditoría de seguridad (informe)

Estado: **solo auditoría. No se modificó código.** El plan para corregir lo encontrado está en `correcciones_30_plan_remediacion.md` (misma carpeta).

- Código auditado: rama `feature/refresh-token` (incluye el access token corto + refresh token, el gate de módulos `/modules`, "Ver módulo" y el bloqueo de permisos del Administrador de este mismo #30).
- Método: lectura de `src/` completo (auth, permisos, websocket, files, vales, admin, repositorios), del frontend (`public/`), `package.json`, `.env`/`.env.example`, `docker-compose.yml` y las reglas de `.agents/reglas/`; `npm audit`; y **sondas HTTP no destructivas** contra un servidor local con la base de demostración (puerto 3061, MySQL demo, sin datos reales). Cada hallazgo marcado **[VERIFICADO]** se reprodujo con esas sondas; los marcados **[CÓDIGO]** salen de leer el código.
- Fuera de alcance de esta auditoría: pruebas contra Supabase real, contra Hostinger, pentest de red/infraestructura, revisión de los ~57 archivos JS del frontend línea por línea (se hizo un barrido automático de interpolaciones + revisión manual de las sospechosas).

---

## 1. Resumen ejecutivo

El proyecto tiene buenos cimientos: todo el SQL está parametrizado, los detalles/PDF/salas de socket de vales validan pertenencia (no hay IDOR en lo probado), las cookies son httpOnly + SameSite strict, el JWT fija el algoritmo, los uploads verifican magic bytes y generan el nombre físico en el servidor, los intentos de path traversal contra `/js`, `/css`, `/assets` y `/modules` devuelven 404, y todo lo protegido responde 401/302 sin sesión.

Lo que **sí** hay que corregir antes de producción, en orden de gravedad:

1. **ALTO — El listado de usuarios devuelve el `password_hash` (bcrypt) de las 86 cuentas** a cualquiera con solo `admin.ver` (SEG-01, verificado).
2. **ALTO — Errores internos de MySQL y de Supabase llegan al cliente** (SEG-02, verificado: el login con `email` en forma de arreglo devuelve el mensaje de sintaxis SQL de MySQL).
3. **ALTO — La protección contra fuerza bruta/credential stuffing del login se evade** cambiando mayúsculas del correo, y no hay límite por IP (SEG-03, verificado). Detrás del proxy de Hostinger sin `trust proxy`, además, un atacante podría bloquear a cualquier usuario (SEG-16).
4. **MEDIO — Nuevos cambios de este #30 dejaron brechas:** el gate de `/modules` se salta con `%76ales`, `/./vales` o mayúsculas (SEG-06, verificado); un cambio/reseteo de contraseña no cierra las sesiones abiertas y el refresh token sigue vivo hasta 12 h (SEG-07); el refresh no tiene límite de tasa y su caché en memoria puede crecer (SEG-09); `asegurarEsquema()` exige permiso `ALTER` en el arranque y choca con un usuario MySQL de mínimo privilegio (SEG-19).
5. **MEDIO — Robustez ante abuso:** sin límites de campos en multer, PDF adjuntos sin tope de páginas, sin rate limit general (SEG-09/10/11); PDFs y adjuntos con datos de clientes en un bucket público de Supabase (SEG-12, requiere decisión).

Lo que ya no es un riesgo tras el trabajo reciente: sesiones de 12 h sin renovación (ahora access de 15 min), permisos de Administrador editables y acceso a módulos sin permiso "ver" a nivel API.

**No existe "seguro" absoluto.** Tras aplicar el plan quedan riesgos residuales (sección 9): cuentas comprometidas por contraseñas débiles, ventana de 15 min de un access token robado, dependencia de Supabase/Hostinger, y las decisiones marcadas más abajo.

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

---

## 6. Puntos que REQUIEREN DECISIÓN DEL DESARROLLADOR

1. **Bucket de Supabase público vs privado (SEG-12).** Hoy cualquier URL de PDF/adjunto funciona para quien la tenga, sin sesión, y no caduca. Opciones: (a) dejar público (el nombre aleatorio de 128 bits es la única barrera; simple; riesgo si una URL se filtra por chat/correo); (b) bucket privado + URL firmada de vida corta generada por `descargarPdf` tras autorizar (mínimo cambio de código, requiere migrar el bucket y actualizar las URLs guardadas); (c) el servidor hace de proxy del archivo (más carga y ancho de banda). Recomendado: (b).
2. **¿Revocar el access token al instante? (SEG-08).** Hoy hay una ventana de ≤15 min. Opciones: (a) aceptarla; (b) `authenticateJWT` consulta `sesiones_activas` en cada petición (una consulta indexada por PK; corta al instante logout/desactivación/reseteo); (c) acortar a 5 min. Recomendado: (a) + (b) solo para acciones de escritura o administración.
3. **CSP (SEG-15).** Hay scripts inline en `login/index.html` y estilos inline en varias vistas; una CSP estricta exige moverlos a archivos o usar nonces. Opciones: empezar en modo `Report-Only`, o CSP con `'unsafe-inline'` solo en estilos. Además, decidir si ionicons se aloja localmente (recomendado, elimina la dependencia externa) o se mantiene en unpkg con SRI.
4. **Transacciones (SEG-19).** No hay helper transaccional; crear taller/tienda/vale hace varios INSERT con rollback manual. Un fallo entre pasos puede dejar datos a medias. Opciones: helper `db.transaction(fn)` con conexión dedicada (cambio pequeño y transversal) o dejar los rollbacks manuales actuales. Recomendado: helper, aplicado primero a las operaciones multi-tabla críticas.
5. **Usuario MySQL sin `ALTER` vs migración al arrancar (SEG-19).** Recomendado: usuario de aplicación con solo `SELECT, INSERT, UPDATE, DELETE`; ejecutar `schema.sql`/migraciones con una cuenta aparte en el despliegue, y que `asegurarEsquema()` solo verifique (y falle con mensaje claro) en producción.
6. **Cambio de contraseña por el propio usuario (SEG-21).** Hoy solo el Administrador la cambia desde el panel y ni siquiera la suya. Opciones: endpoint de "cambiar mi contraseña" (pide la actual; revoca sesiones) o mantener el modelo actual. Recomendado: implementarlo antes de producción.
7. **`trust proxy` (SEG-16).** Depende de cuántos saltos haya en Hostinger; hay que confirmarlo (valor 1 en el caso típico) antes de fijarlo, porque un valor mal puesto permite falsear la IP.
8. **Verificar WebSockets en el plan de Hostinger.** Algunos planes de hosting Node no soportan WebSocket sostenido; Socket.IO cae a long-polling (funciona, con más carga). Confirmar en el plan contratado.

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
- [ ] SEG-01 a SEG-07 corregidos y verificados con el script de pruebas del plan.
- [ ] `NODE_ENV=production`, `JWT_SECRET` nuevo (≥48 caracteres), `SOCKET_CORS_ORIGIN` y `trust proxy` definidos.
- [ ] Usuario MySQL de mínimo privilegio; esquema aplicado con cuenta de migración.
- [ ] Decisiones 1-8 de la sección 6 tomadas y documentadas.
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