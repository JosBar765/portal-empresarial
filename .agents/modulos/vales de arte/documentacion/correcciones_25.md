# Correcciones #25 — Auditoría de Seguridad

Base: `.agents/modulos/vales de arte/correcciones/analisis_correcciones_25.md`.

## Punto 1: rename de `encargado_tienda`

Ejecutado. La tabla que relaciona `taller_id` ↔ `tienda_id` (qué tienda(s)
puede atender cada taller de toda la empresa, sin ninguna columna de
encargado) se renombró a `taller_tiendas` — nombre que refleja lo que la
tabla realmente hace. Archivos tocados: `database/schema.sql`,
`database/users.sql` (datos reales, cambio puramente mecánico de nombre de
tabla, ningún dato modificado), `src/modules/admin/repositories/
tiendaAdminRepository.js` (2 JOIN). Ver nota agregada en
`correcciones_24.md`, duda #4.

**Este documento es la auditoría de seguridad pedida en el punto 2 — es un
informe, todavía NO se implementó ningún cambio de seguridad.** El plan de
remediación (fases, orden, pruebas) vive en un documento aparte:
`plan_remediacion_25.md`, en esta misma carpeta.

---

## Resumen ejecutivo

Se auditó el proyecto completo (autenticación, autorización/roles, capa de
datos, uploads/archivos/PDFs, WebSockets, configuración HTTP/CORS,
variables de entorno y dependencias) en 4 frentes paralelos, cruzando cada
hallazgo contra el código real (nunca contra suposiciones).

El sistema tiene una base de seguridad razonable para su etapa actual
(pre-producción): contraseñas con bcrypt, JWT en cookie `httpOnly` +
`sameSite: strict`, autorización basada en permisos consistente en casi
todos los endpoints, SQL 100% parametrizado en los 15 repositorios
existentes, y separación correcta de archivos (nunca como BLOB en MySQL,
nombres físicos aleatorios). No se necesitó proponer ninguna reescritura de
arquitectura.

Sin embargo, se encontraron **2 vulnerabilidades que bordean CRÍTICO** (un
secreto JWT de repuesto hardcodeado en el código, y un WebSocket sin
autenticación que expone en tiempo real la actividad de vales de arte de
toda la empresa a cualquiera con la URL del servidor) y **5 vulnerabilidades
ALTAS** (fuerza bruta sin límite contra el login, un IDOR real en la
descarga de PDF de vales, un XSS almacenado explotable en el módulo de
Vales, una validación de uploads que confía solo en el `Content-Type`
declarado por el cliente, y 3 CVEs de Denial-of-Service activos en la
dependencia `multer`). Ninguna de las soluciones propuestas requiere
reescribir arquitectura, agregar infraestructura nueva (Redis,
microservicios, Docker) ni romper contratos de API — la mayoría son
correcciones acotadas a 1-2 archivos.

---

## Tabla de vulnerabilidades

| Riesgo | Vulnerabilidad | Archivo | Impacto | Solución | Estado |
|---|---|---|---|---|---|
| CRÍTICO | Secreto JWT de repuesto hardcodeado en el código | `src/config/env.js:11` | Si `JWT_SECRET` no queda seteado en el hosting, cualquiera puede forjar un JWT de Administrador leyendo el código público | Quitar el fallback, fallar rápido si falta la variable (mismo patrón que `database.js`) | Pendiente (Fase 1) |
| ALTO (bordea CRÍTICO) | WebSocket sin autenticación ni validación de salas | `src/core/websocket/socketManager.js:15-41` | Cualquiera (sin cuenta) puede conectarse y suscribirse a `vales:admin` u otras salas y recibir en tiempo real la actividad de vales de toda la empresa | Verificar JWT en el handshake del socket; derivar las salas permitidas en el servidor, no confiar en lo que pide el cliente | Pendiente (Fase 1) |
| ALTO | IDOR: descarga de PDF de cualquier vale sin verificar pertenencia | `src/modules/vales/services/valeConfirmacionService.js` (`obtenerValeParaPdf`) | Cualquier usuario con `vales.ver` (casi todos los roles) puede descargar el PDF de cualquier vale de cualquier tienda/asesor | Reutilizar el mismo chequeo de pertenencia que ya usa `valeDetalleService._puedeVerVale` | Pendiente (Fase 1) |
| ALTO | Sin rate limiting ni bloqueo por intentos fallidos en login | `src/core/auth/authService.js`, `authRoutes.js` | Fuerza bruta y credential stuffing sin fricción contra cualquier cuenta, incluida Administrador | `express-rate-limit` por IP+correo en la ruta de login | Pendiente (Fase 1) |
| ALTO | Validación de uploads basada solo en `Content-Type` declarado por el cliente | `src/modules/vales/controllers/valeController.js`, `src/core/files/supabaseStorage.js` | Subir un archivo `.svg`/`.html` disfrazado de imagen → XSS almacenado en el bucket público de Supabase | Verificar magic bytes/firma real del archivo antes de subir; derivar la extensión del tipo real, no del nombre del usuario | Pendiente (Fase 1) |
| ALTO | XSS almacenado: campos libres del Asesor sin escapar en el módulo de Vales | `public/modules/vales/js/actions/supervisor.js`, `actions/historial.js` | Un Asesor inyecta HTML/atributos de evento en `cliente_nombre`/`justificacion`/etc.; corre en el navegador del Supervisor/Encargado que lo ve, con su sesión | Aplicar `escapeHtml` (ya existe y se usa en el módulo Admin) en las interpolaciones señaladas | Pendiente (Fase 1) |
| ALTO | 3 CVEs de DoS activos en `multer@2.2.0` | `package.json` | Payload malicioso en un upload puede tumbar el proceso Node completo (monolito de un solo proceso) | `npm audit fix` (parche menor, sin downgrade) | Pendiente (Fase 1) |
| MEDIO | Enumeración de usuarios en mensajes de error del login | `src/core/auth/authService.js:44-58` | Permite confirmar qué correos existen/están desactivados | Unificar a un mensaje genérico | Pendiente (Fase 2) |
| MEDIO | Desactivar un usuario no revoca su sesión ya emitida | `src/modules/admin/services/adminService.js` (`establecerActivoUsuario`) | Un usuario desactivado sigue con acceso completo hasta que su JWT expire por su cuenta | Emitir evento de socket dirigido para forzar logout inmediato (mínimo); opcional: verificar `activo` con cache corto en el middleware global | Pendiente (Fase 2) — nivel de garantía **REQUIERE DECISIÓN DEL DESARROLLADOR** |
| MEDIO | Filtración de errores internos (SQL/stack) al cliente en respuestas 500 | `src/app.js` (handler global), patrón repetido en controllers | Expone nombres de tablas/columnas/constraints de MySQL, facilita reconocimiento | Mensaje genérico para errores 500 no anticipados; mantener el detalle solo en logs | Pendiente (Fase 2) |
| MEDIO | CORS de Socket.IO abierto a cualquier origen (`origin: '*'`) | `src/core/websocket/socketManager.js:8-13` | Cualquier sitio web de terceros puede intentar conectarse al socket desde el navegador de una víctima | Restringir a la URL real del dominio de producción vía variable de entorno | Pendiente (Fase 2) |
| MEDIO | Sin cabeceras de seguridad HTTP (Helmet) | `src/app.js` | Sin protección explícita contra clickjacking (`X-Frame-Options`), MIME-sniffing, etc. | Agregar `helmet` (CSP desactivada inicialmente para no romper scripts existentes) | Pendiente (Fase 2) |
| BAJO/MEDIO | Sin validación de longitud/formato en campos de texto libre y sin longitud mínima de contraseña | `valeCreacionService.validarDatosVale`, `adminService.crearUsuario` | Contraseñas triviales de 1 carácter aceptadas; valores anormalmente largos pueden disparar errores de MySQL que se filtran (ver hallazgo de arriba) | Límites de longitud explícitos + longitud mínima de contraseña (ej. 8) | Pendiente (Fase 2) |
| BAJO | Endpoint `getCsrfToken` es un placeholder sin función real | `src/core/auth/authController.js:57-60` | Ninguno directo — falsa sensación de protección si se asume que hace algo | Documentar que la protección real es `sameSite: strict`; retirar si nada lo consume | Pendiente (Fase 3) |
| BAJO | `maxAge` de la cookie hardcodeado, desacoplado de `JWT_EXPIRES_IN` | `src/core/auth/authController.js` | Cookie sobrevive más que el JWT real; sin riesgo de seguridad, solo UX confusa | Calcular `maxAge` a partir de `config.jwtExpiresIn` | Pendiente (Fase 3) |
| BAJO | `jwt.verify`/`jwt.sign` sin `algorithms`/`algorithm` explícito | `src/core/auth/jwtHelper.js` | No explotable con la librería actual; defensa en profundidad | Especificar `HS256` explícitamente en ambos lados | Pendiente (Fase 3) |
| BAJO | Fail-open en verificaciones de rol desconocido | `valeDetalleService._puedeVerVale`/`_filtrarHistorialPorRol` | No explotable hoy (todos los roles actuales están cubiertos); riesgo latente si se agrega un rol nuevo sin actualizar esta función | Cambiar el default a fail-closed | Pendiente (Fase 3) |
| BAJO | Sin límite explícito de dimensiones de imagen antes de optimizar | `src/core/files/imageOptimizer.js` | DoS parcial acotado (sharp/libvips ya tiene un límite implícito, y el archivo ya está limitado a 2MB) | `limitInputPixels` explícito en `sharp()` | Pendiente (Fase 3) |
| BAJO | Body limit de Express implícito (no explícito) | `src/app.js:16-17` | Ninguno real (el default de 100kb ya es razonable para este tipo de formularios) | Hacerlo explícito por claridad | Pendiente (Fase 3) |
| BAJO | Un solo permiso `admin.ver` gatea las 24 rutas del panel de administración | `src/modules/admin/routes.js` | Ninguno hoy (solo Administrador tiene ese permiso); viola mínimo privilegio si en el futuro se quiere dar acceso parcial | Dividir en permisos más finos si se necesita en el futuro | **REQUIERE DECISIÓN DEL DESARROLLADOR** — no es urgente |
| — | Logging verboso de SQL en consola del servidor | `src/config/database.js:46` | Bajo, condicionado a acceso previo a los logs del servidor | Nota operativa: no exponer logs públicamente en Hostinger | Nota operativa, no requiere código |

---

## Detalle completo por categoría

### Autenticación y sesión

#### 1. Secreto JWT con fallback hardcodeado en el código fuente
- **Archivo/línea**: `src/config/env.js:11` — `jwtSecret: process.env.JWT_SECRET || 'fallback_development_jwt_secret_123456_987654321'`.
- **Riesgo**: CRÍTICO.
- **Qué podría hacer un atacante**: si en Hostinger la variable `JWT_SECRET` no queda seteada (typo, panel mal configurado, despliegue sin `.env`), el proceso arranca igual y firma/verifica JWT con este string público (visible en el repositorio). Cualquiera que lea el código puede forjar un JWT válido con cualquier `id`/`rolId`/`permissions`, incluyendo Administrador.
- **Explotación**: generar un JWT con `jsonwebtoken` usando exactamente ese string como secreto, con payload `{id:1, rolId:1, permissions:[...todos]}`, y mandarlo como cookie `token` — acceso total sin credenciales.
- **Impacto**: compromiso total de la aplicación.
- **Solución**: quitar el fallback; si `process.env.JWT_SECRET` no existe, lanzar error fatal y no arrancar el proceso (mismo patrón que ya usa `database.js` con la conexión a MySQL).
- **¿Rompe funcionalidad?**: no, siempre que `.env` tenga `JWT_SECRET` seteado (ya lo tiene en dev).
- **Verificado además**: el `.env` local actual usa literalmente `JWT_SECRET=cambiar_este_secreto_en_produccion_1234567890`, el mismo valor de ejemplo publicado en `.env.example` — confirma que este riesgo no es solo teórico, es fácil de dejarlo pasar sin darse cuenta. **Antes de desplegar a Hostinger, generar un secreto real y aleatorio (ej. `openssl rand -hex 64`) y jamás reutilizar el valor de `.env.example`.**

#### 2. Enumeración de usuarios en el login
- **Archivo/línea**: `src/core/auth/authService.js:44-58` (`'Usuario no encontrado.'` vs `'Contraseña incorrecta.'` vs `'Esta cuenta de usuario está desactivada.'`), propagado tal cual al cliente en `authController.js:96-101`.
- **Riesgo**: MEDIO.
- **Explotación**: probar una lista de correos con contraseña cualquiera; el mensaje exacto confirma si el correo existe y si la cuenta está activa.
- **Impacto**: facilita credential stuffing dirigido e ingeniería social.
- **Solución**: unificar a un mensaje genérico ("Correo o contraseña incorrectos.") para los 3 casos en la respuesta al cliente; conservar el detalle real solo en logs de servidor.
- **¿Rompe funcionalidad?**: cambia el texto del error — no rompe el contrato de la API ni ninguna lógica condicional del frontend (confirmado, `login/index.html` solo hace `showError(data.error || ...)`).

#### 3. Sin rate limiting ni bloqueo por intentos fallidos
- **Archivo/línea**: `src/core/auth/authRoutes.js`, `authService.js:33-76`. Las columnas `usuarios.intentos_fallidos`/`bloqueado_hasta` (`schema.sql`) existen pero no se leen ni escriben en ningún archivo del proyecto (deuda ya documentada en `correcciones_12_fase2d.md`).
- **Riesgo**: ALTO.
- **Explotación**: script simple con POST repetido a `/api/auth.php?action=login` o `/api/auth/login`, sin límite de intentos ni delay.
- **Impacto**: robo de cuentas, incluida potencialmente Administrador (correo conocido: `admin@munditrofeos.com`).
- **Solución**: (a) `express-rate-limit` por IP+correo en la ruta de login; (b) opcionalmente activar las columnas ya existentes para bloqueo progresivo por cuenta. Ninguna requiere Redis ni servicios externos.
- **¿Rompe funcionalidad?**: no, con límites razonables (ej. 5-10 intentos/15 min). Agrega una dependencia nueva.

#### 4. Revocación de sesión no funciona al desactivar un usuario
- **Archivo/línea**: `adminService.establecerActivoUsuario` no emite ningún evento de socket (a diferencia de `actualizarPermisosRol`, que sí emite `permisos_actualizados`). `authenticateJWT` solo verifica firma/expiración, nunca re-consulta `usuarios.activo`.
- **Riesgo**: ALTO.
- **Impacto**: un empleado desactivado (o una cuenta comprometida que el admin desactiva) sigue con acceso completo hasta que su JWT expire de forma natural.
- **Solución**: (a) mínima — `establecerActivoUsuario` emite un evento dirigido (`socketManager.sendToUser`) que el cliente escucha para forzar logout inmediato — cubre solo mientras el usuario esté conectado; (b) robusta — `authenticateJWT` verifica `usuarios.activo` contra DB con cache corto (30-60s). **REQUIERE DECISIÓN DEL DESARROLLADOR**: ¿revocación inmediata garantizada, o tolerancia de hasta ~1 minuto es aceptable?
- **¿Rompe funcionalidad?**: (a) no rompe nada; (b) añade una consulta/cache al middleware global — a evaluar impacto de performance.

#### 5. Endpoint `csrf` es un placeholder sin función real
- **Archivo/línea**: `authController.js:57-60` — devuelve siempre el mismo string literal, no se usa para validar nada en ninguna ruta.
- **Riesgo**: BAJO.
- **Solución**: documentar que la protección real es `sameSite: strict`; retirar el endpoint si nada del frontend lo consume (confirmar antes con un grep de `action=csrf`).

#### 6. `maxAge` de la cookie desacoplado de `JWT_EXPIRES_IN`
- **Archivo/línea**: `authController.js` — `maxAge: 24 * 60 * 60 * 1000` fijo, mientras el JWT expira según `config.jwtExpiresIn` (default `12h`).
- **Riesgo**: BAJO — no es brecha de seguridad (`verifyToken` rechaza el token vencido igual), solo UX confusa.
- **Solución**: calcular `maxAge` a partir de `config.jwtExpiresIn`.

#### 7. Algoritmo JWT no restringido explícitamente
- **Archivo/línea**: `jwtHelper.js:21-28` — `jwt.verify(token, config.jwtSecret)` sin `algorithms: ['HS256']`.
- **Riesgo**: BAJO (no explotable con `jsonwebtoken@9.0.2` actual; defensa en profundidad).
- **Solución**: agregar `{ algorithms: ['HS256'] }` en verify y `{ algorithm: 'HS256' }` en sign.

**Lo que ya está bien**: JWT solo en cookie `httpOnly` (nunca en `localStorage`); `sameSite: strict` mitiga CSRF real; `secure` condicionado correctamente a `NODE_ENV==='production'`; bcrypt usado correctamente (costo 10, estándar); mensajes de error del frontend usan `textContent`, no `innerHTML`; `Cache-Control: no-store` en cada respuesta protegida (mitiga "sesión cómplice").

---

### Autorización, IDOR y WebSockets

#### 1. WebSocket sin autenticación: cualquiera puede conectarse y unirse a cualquier sala
- **Archivo/línea**: `src/core/websocket/socketManager.js:15-41`. `userId` sale de `socket.handshake.query.userId`, un valor que el propio cliente declara sin validación contra el JWT. `register_module` une el socket a cualquier nombre de sala que se le pida.
- **Riesgo**: ALTO (bordea CRÍTICO).
- **Explotación**: los nombres de sala no son secretos — `public/modules/vales/js/permisos.js` (JS público, sin autenticación) documenta el esquema exacto (`asesor:${id}`, `taller:${id}`, `vales:admin`). Un atacante externo: 1) descarga ese JS público, 2) abre una conexión Socket.IO cruda sin cookie/token, 3) emite `register_module` con `'vales:admin'` — a partir de ahí recibe en tiempo real cada evento de vale de toda la empresa, sin haberse autenticado nunca.
- **Impacto**: fuga continua de actividad operativa interna a cualquiera con la URL del servidor.
- **Solución**: (a) middleware `io.use((socket, next) => {...})` que verifique el JWT (de la cookie del handshake, o de un `auth.token` explícito) con el mismo `jwtHelper.verifyToken`, rechazando la conexión si no hay token válido; (b) en `register_module`, derivar las salas permitidas EN EL SERVIDOR a partir del usuario ya verificado, ignorando cualquier sala que el cliente pida sin corresponderle.
- **¿Rompe funcionalidad?**: no debería — el frontend ya calcula las salas correctas por su cuenta; el cambio es que el servidor las vuelva a calcular en vez de confiar en el cliente. Requiere decidir cómo viaja el JWT en el handshake del socket (la cookie ya se manda automáticamente same-origin).

#### 2. IDOR: descarga de PDF de cualquier vale sin verificar pertenencia
- **Archivo/línea**: `valeConfirmacionService.obtenerValeParaPdf` (líneas 233-235) — recibe `usuario` pero nunca lo usa, a diferencia de `valeDetalleService.obtenerDetalle`, que sí llama a `_puedeVerVale`. Servido por `GET /api/vales/:id/pdf`, gateado solo por `requirePermission('vales.ver')`.
- **Riesgo**: ALTO.
- **Explotación**: cualquier usuario autenticado con `vales.ver` (casi todos los roles) puede hacer `GET /api/vales/1/pdf`, `/2/pdf`, ... incrementando el id, y descargar el PDF oficial de cualquier vale de cualquier asesor/tienda (nombre/teléfono/correo del cliente, producto, cotización, firma).
- **Impacto**: fuga de datos de clientes y de negocio entre asesores/tiendas/roles que no deberían verse entre sí.
- **Solución**: aplicar el mismo chequeo que ya existe en `valeDetalleService._puedeVerVale` dentro de `obtenerValeParaPdf`, antes de devolver el vale.
- **¿Rompe funcionalidad?**: no — todo usuario que hoy debería poder ver ese PDF sigue pudiendo; solo se cierra el acceso a quienes no deberían.

#### 3. Fail-open en verificaciones por rol para "rol desconocido"
- **Archivo/línea**: `valeDetalleService.js` línea 87 (`_puedeVerVale: return true`) y línea 162 (`_filtrarHistorialPorRol: return historial`).
- **Riesgo**: BAJO (no explotable hoy — los 10 roles existentes están todos cubiertos explícitamente).
- **Impacto potencial**: si se agrega un rol nuevo sin actualizar esta función, vería TODOS los vales y todo el historial sin restricción.
- **Solución**: cambiar ambos defaults a fail-closed (`return false` / `return []`).

#### 4. Un solo permiso `admin.ver` para las 24 rutas del panel de administración
- **Archivo/línea**: `src/modules/admin/routes.js`.
- **Riesgo**: BAJO hoy (solo Administrador tiene ese permiso); viola mínimo privilegio si en el futuro se quiere acceso admin parcial.
- **Solución**: dividir en permisos más finos si se necesita — **REQUIERE DECISIÓN DEL DESARROLLADOR**, no es urgente.

**Lo que ya está bien**: cada ruta de `vales/routes.js` y `admin/routes.js` tiene un permiso explícito; `GET /api/vales/:id` (JSON) sí bloquea IDOR correctamente vía `_puedeVerVale`; todas las transiciones de taller verifican pertenencia real contra `req.user`; no existe mass assignment en ningún service; los candados de negocio (límite diario del supervisor, rol único) están aplicados en backend. `socketManager.sendToUser`/`sendToModule`/`broadcast` están definidas pero nunca se usan (código muerto, hereda el mismo problema de raíz del Hallazgo 1 si algún día se usan — se resuelve de paso).

---

### SQL Injection, validación y manejo de errores

**Lo que ya está bien** (primero, para dejarlo claro): los 15 repositorios de `vales`/`admin` parametrizan consistentemente con `?` — no se encontró ni un solo caso de concatenación de datos de usuario en el texto SQL. Los únicos template-literals con `${}` dentro del SQL interpolan constantes fijas del propio código (nunca `req.body`/`req.query`/`req.params`). `sortKey`/`sortDir`/`busqueda` del buzón pasan por whitelist en JS, nunca tocan SQL directo. **No se necesita ningún cambio en la capa de repositorios.**

#### 1. Filtración de errores internos al cliente
- **Archivo/línea**: `src/config/database.js:41-49` (re-lanza el error tal cual), patrón repetido en casi todos los controllers (`catch (error) { return res.status(500).json({ error: error.message }) }`), y el handler global de `src/app.js:141-146`.
- **Riesgo**: MEDIO.
- **Explotación**: provocar deliberadamente un error no controlado (ej. violación de FK/UNIQUE no validada antes) y leer en la respuesta detalles de tablas/columnas/constraints de MySQL.
- **Impacto**: divulgación de información interna, facilita reconocimiento para ataques posteriores.
- **Solución**: en el handler global y en los `catch` que hoy devuelven 500, loguear el error completo (ya se hace) pero responder al cliente con mensaje genérico cuando NO es uno de los `throw new Error('mensaje amigable')` deliberados de la capa de servicio (esos ya van con 400, se mantienen igual). Usar `NODE_ENV === 'production' ? 'Ocurrió un error interno.' : err.message` como criterio simple.
- **¿Rompe funcionalidad?**: no — los mensajes de negocio (400) siguen igual.

#### 2. XSS almacenado: campos de texto libre sin escapar en el módulo de Vales
- **Archivo/línea**: `public/modules/vales/js/actions/supervisor.js` (función `campo()` en `abrirModalInfoVale`, interpola `cliente_nombre`/`cliente_empresa`/`producto` directo en `innerHTML`; también la `justificacion` de la solicitud de modificación) y `actions/historial.js` (`actor_nombre`/`accion` sin escapar). El módulo Admin SÍ tiene y usa `escapeHtml` (`public/modules/admin/js/utils/formato.js`) consistentemente — el módulo Vales nunca adoptó ese patrón.
- **Riesgo**: ALTO.
- **Explotación**: un Asesor crea un vale con `cliente_nombre = '<img src=x onerror=alert(document.domain)>'` (atributos de evento SÍ ejecutan vía `innerHTML`, a diferencia de `<script>` literal). Cuando un Supervisor abre "Ver info" o "Autorizar modificación" de ese vale, el payload corre en su navegador con su sesión.
- **Impacto**: como el JWT es `httpOnly` (no robable directo), el impacto real es que el script puede hacer `fetch` autenticados usando la cookie ambiente de la víctima — ejecutar cualquier acción que el Supervisor/Encargado pueda hacer, sin su consentimiento.
- **Solución**: crear `escapeHtml` en `public/modules/vales/js/utils/formato.js` (mismo código que el de admin) y aplicarlo en las interpolaciones señaladas. Se recomienda una revisión rápida adicional de otros usos de `innerHTML` en el módulo antes de dar por cerrado el hallazgo (los puntos confirmados aquí son los de mayor exposición: modal de info del vale, justificación de modificación, historial).
- **¿Rompe funcionalidad?**: no — escapar HTML no cambia el texto visible para caracteres normales.

#### 3. Sin validación de longitud/formato en campos de texto libre
- **Archivo/línea**: `valeCreacionService.validarDatosVale` (solo truthiness, sin límite de longitud/formato), `adminService.crearUsuario` (sin longitud mínima de contraseña — un carácter es aceptado).
- **Riesgo**: BAJO/MEDIO (sube a MEDIO combinado con el Hallazgo 1: un valor demasiado largo para una columna `VARCHAR` puede hacer que MySQL truene con un error que se filtra al cliente).
- **Solución**: límites de longitud explícitos (coincidiendo con la columna real) + longitud mínima de contraseña (ej. 8 caracteres).
- **¿Rompe funcionalidad?**: no, con límites generosos.

#### 4. Logging verboso de SQL en consola del servidor
- **Archivo/línea**: `database.js:46`.
- **Riesgo**: BAJO — requiere acceso previo a los logs del servidor.
- **Solución**: nota operativa (ver checklist de Hostinger más abajo), no requiere cambio de código.

---

### Uploads, PDFs, HTTP/CORS, entorno y dependencias

#### 1. Validación de uploads basada solo en `Content-Type` declarado por el cliente
- **Archivo/línea**: `valeController.js` (líneas 12, 20, 158, 212) y `supabaseStorage.js` (`subir()`, usa `path.extname(nombreOriginal)` — controlado por el atacante — para la extensión física del archivo).
- **Riesgo**: ALTO.
- **Explotación**: renombrar un `.svg`/`.html` malicioso, declarar `Content-Type: image/png` en el multipart — pasa la validación. Queda guardado con esa extensión en un bucket **público**. Si una víctima abre la URL directo, un SVG con `<script>` embebido o HTML disfrazado ejecuta bajo el dominio de Supabase.
- **Impacto**: phishing/desfiguración/redirección bajo un dominio de confianza (no robo directo de cookie, que es `httpOnly`).
- **Solución**: verificar los primeros bytes del buffer (magic number) contra el tipo declarado antes de subir — función pequeña comparando firmas fijas de PNG/JPEG/WEBP/PDF, sin librerías nuevas. Derivar la extensión del tipo REAL detectado, nunca de `nombreOriginal`. Complementar con `fileFilter` en la config de `multer` (`routes.js`) como primera barrera.
- **¿Rompe funcionalidad?**: no, si la firma coincide con lo que el usuario legítimamente sube.

#### 2. 3 CVEs de DoS activos en `multer@2.2.0`
- **Archivo/línea**: `package.json`. `npm audit` (modo lectura) confirma 3 vulnerabilidades ALTAS de DoS + 1 BAJA en `multer`, corregidas en `>=2.3.0`; más 2 MODERADAS en `qs` (transitiva de `express`), heredadas por `express`/`body-parser`.
- **Riesgo**: ALTO (multer recibe uploads reales de usuarios).
- **Explotación**: multipart con nombres de campo/índices de array maliciosamente crafteados para tumbar el proceso Node (monolito de un solo proceso — cae TODO el sistema).
- **Solución**: `npm audit fix` — todas dentro del rango semver `^` ya declarado, sin downgrade de major version.
- **¿Rompe funcionalidad?**: bajo riesgo, pero requiere volver a probar el flujo completo de uploads después.

#### 3. CORS de Socket.IO abierto a cualquier origen
- **Archivo/línea**: `socketManager.js:8-13` — `cors: { origin: '*', methods: ['GET','POST'] }` hardcodeado, comentario "para desarrollo" nunca ajustado.
- **Riesgo**: MEDIO (amplía la superficie del Hallazgo de WebSocket de autorización).
- **Solución**: restringir `origin` a la URL real de producción vía variable de entorno (`.env.example` ya tiene un comentario `# SOCKET_CORS_ORIGIN=*` anticipando esto, nunca se leyó en código).
- **¿Rompe funcionalidad?**: no, el frontend siempre se sirve desde el mismo origen.

#### 4. Sin cabeceras de seguridad HTTP (Helmet)
- **Archivo/línea**: `src/app.js` completo.
- **Riesgo**: MEDIO — sin `X-Frame-Options`/CSP frame-ancestors (riesgo de clickjacking sobre login/dashboard), sin `X-Content-Type-Options`.
- **Solución**: agregar `helmet` con `contentSecurityPolicy: false` inicialmente (para no arriesgar romper los scripts de Ionicons/Socket.IO cargados desde CDN sin una revisión aparte de CSP) y las demás cabeceras activas.
- **¿Rompe funcionalidad?**: potencialmente si se activa CSP por defecto sin ajustar — por eso se recomienda desactivarla en un primer paso.

#### 5. Sin límite explícito de dimensiones de imagen antes de optimizar
- **Archivo/línea**: `imageOptimizer.js:26-42`.
- **Riesgo**: BAJO — sharp/libvips ya trae un límite implícito de píxeles, y el archivo ya está limitado a 2MB.
- **Solución**: `limitInputPixels` explícito en `sharp()`, opcional.

#### 6. Body limit de Express implícito
- **Archivo/línea**: `app.js:16-17`.
- **Riesgo**: BAJO — el default de 100kb ya es razonable.
- **Solución**: hacerlo explícito por claridad, opcional.

**Verificado, NO vulnerable**: el `fetch(doc.ruta)` de `valePdfService.js` no es SSRF explotable — esa URL siempre se escribe server-side desde la respuesta real de Supabase, ningún controller acepta una URL arbitraria del cliente para insertarla en `vale_documentos.ruta`.

**Lo que ya está bien**: el binario nunca se guarda en MySQL, solo la URL; el identificador físico del archivo es aleatorio (`crypto.randomBytes`); multer usa `memoryStorage()` (nunca toca el filesystem del proceso, elimina de raíz cualquier path traversal del lado del servidor); límite de tamaño de archivo ya existe (2MB/3MB); cookie del JWT ya tiene `secure`/`sameSite` correctos; `.env.example` completo y sin secretos reales; ninguna dependencia con vulnerabilidades CRÍTICAS.

---

## Dependencias — estado y recomendaciones

**A actualizar** (parche, sin downgrade): `multer` (3 CVEs de DoS, corregidas en `>=2.3.0`), y transitivamente `qs`/`express`/`body-parser` — todo cubierto por `npm audit fix` dentro del rango `^` ya declarado.

**A agregar** (Fase 1/2, ver plan de remediación): `express-rate-limit` (rate limiting de login), `helmet` (cabeceras HTTP).

**Nada que quitar**: no se encontraron dependencias abandonadas o claramente innecesarias en el `package.json` actual (10 dependencias de producción, todas en uso confirmado).

---

## Configuraciones a realizar en Hostinger (no resolubles desde el código)

- **`JWT_SECRET`**: generar un valor aleatorio real (`openssl rand -hex 64` o equivalente) y configurarlo como variable de entorno en el panel de Hostinger — nunca reutilizar el valor de `.env.example`.
- **`NODE_ENV=production`**: debe quedar seteado en el proceso real (panel de Node de Hostinger). El código ya reacciona correctamente (`cookie.secure` se activa solo en producción) — si Hostinger no lo setea, la cookie viaja sin el flag `Secure`.
- **HTTPS/TLS**: la terminación SSL depende de la configuración de Hostinger (certificado, redirect HTTP→HTTPS). El código depende de que esto esté bien configurado para que `secure: true` tenga efecto real.
- **`SOCKET_CORS_ORIGIN`** (nueva variable, ver plan de remediación): configurar con el dominio real de producción una vez el código la lea.
- **Trust proxy**: si Hostinger sirve la app detrás de un proxy/balanceador, verificar si hace falta `app.set('trust proxy', 1)` para que `req.secure` y cualquier rate-limiting por IP funcionen correctamente — no se pudo confirmar la topología exacta de Hostinger desde el código; **verificar en el panel de despliegue**.
- **Acceso a logs**: si Hostinger expone logs de la aplicación en un panel, restringir el acceso a personal autorizado (los logs incluyen SQL con parámetros de negocio, no secretos, pero sí información operativa).

## Configuraciones a realizar en MySQL

- Verificar que el usuario de MySQL configurado en `DB_USER`/`DB_PASSWORD` tenga únicamente los privilegios que la aplicación realmente necesita (`SELECT`/`INSERT`/`UPDATE`/`DELETE` sobre `portal_empresarial`) — no usar una cuenta con privilegios de administración de MySQL (`GRANT`, `DROP DATABASE` sobre otras bases, etc.) si el panel de Hostinger lo permite configurar así.
- Confirmar que la base de datos NO sea accesible desde fuera de la red interna del hosting (sin bind a `0.0.0.0` públicamente) — esto depende de la configuración de Hostinger, no del código (`DB_HOST=127.0.0.1` en local ya asume conexión local/interna).

## Lo que NO puede solucionarse desde el código

- Configuración de HTTPS/certificado SSL.
- Aislamiento de red de MySQL (acceso solo interno).
- Rotación/gestión segura del valor real de `JWT_SECRET` en el hosting.
- Backups automatizados de MySQL a nivel de infraestructura (ver estrategia recomendada abajo — el código no debe intentar hacer backups por su cuenta).
- Acceso y permisos del panel de Hostinger en sí (quién puede ver logs, variables de entorno, la base de datos).

---

## Estrategia recomendada de backups y recuperación ante desastre

El sistema tiene dos fuentes de datos reales fuera del propio código: **MySQL** (toda la data transaccional: usuarios, vales, historial) y **Supabase Storage** (PDFs e imágenes). El código de la aplicación en sí es stateless y ya vive en git — recuperarlo es simplemente re-desplegar.

- **MySQL**: la mayoría de paneles de Hostinger para bases de datos administradas incluyen backups automáticos diarios con cierta retención (varía por plan) — **verificar en el panel de Hostinger cuál es la retención real y si incluye restauración self-service o requiere soporte**. Si el plan lo permite, programar además un `mysqldump` propio vía cron (si hay acceso a cron jobs en el panel) hacia un almacenamiento externo (ej. el propio bucket de Supabase, en una carpeta separada de la de uploads, o cualquier otro storage barato) — esto es opcional/complementario al backup del hosting, no un reemplazo.
- **Supabase Storage**: Supabase ya replica y persiste los objetos subidos con su propia infraestructura — no se necesita backup adicional del lado del proyecto salvo que la política de retención de Supabase (plan gratuito vs. pago) no sea suficiente para los requisitos del negocio — **verificar el plan de Supabase contratado**.
- **Retención recomendada**: al menos 7-14 días de backups diarios de MySQL, suficiente para recuperarse de un error humano (ej. un DELETE accidental) detectado con algunos días de retraso.
- **Restauración**: documentar (fuera del código, en un runbook operativo) los pasos exactos para restaurar un backup de MySQL desde el panel de Hostinger — probarlo al menos una vez ANTES de ir a producción, no esperar a necesitarlo de verdad.
- **Disaster recovery**: si el servidor de Hostinger completo fallara, la recuperación es: 1) nuevo servicio Node en Hostinger (o el mismo, reiniciado), 2) `git clone` del repositorio, 3) `.env` reconfigurado con los mismos secretos, 4) restaurar el último backup de MySQL, 5) Supabase Storage no requiere acción (externo, ya persistente). Tiempo de recuperación depende principalmente de qué tan rápido Hostinger provisione un nuevo servicio y de la antigüedad del backup de MySQL disponible.

---

## Checklist de seguridad antes de producción

- [ ] `JWT_SECRET` real y aleatorio configurado en Hostinger (nunca el valor de `.env.example`).
- [ ] `NODE_ENV=production` configurado en el proceso real.
- [ ] HTTPS/certificado SSL activo y funcionando (verificar `secure` de la cookie realmente se está aplicando).
- [ ] Fase 1 del plan de remediación aplicada (ver `plan_remediacion_25.md`): WebSocket autenticado, IDOR de PDF cerrado, rate limiting de login, validación real de uploads, XSS de Vales corregido, `npm audit fix` aplicado.
- [ ] Contraseñas de todas las cuentas de prueba (`@munditrofeos.com`, etc.) cambiadas a valores no publicados en ningún documento del repositorio, o esas cuentas desactivadas si no se van a usar en producción.
- [ ] Backup de MySQL confirmado y restauración probada al menos una vez.
- [ ] Usuario de MySQL con privilegios mínimos necesarios.
- [ ] Variables de entorno de Supabase (`SUPABASE_URL`/`SUPABASE_SECRET_KEY`/`SUPABASE_STORAGE_BUCKET`) configuradas con las credenciales reales de producción (nunca las de desarrollo/pruebas).
- [ ] Políticas del bucket de Supabase revisadas (ya se ajustaron durante correcciones anteriores — confirmar que siguen correctas).

## Checklist de seguridad después del despliegue

- [ ] Confirmar en producción que un usuario no autenticado recibe 401/redirect en cualquier endpoint protegido.
- [ ] Confirmar que la cookie del JWT tiene el flag `Secure` activo (inspeccionar en DevTools → Application → Cookies).
- [ ] Confirmar que un socket sin JWT válido no puede conectarse (una vez aplicada la Fase 1).
- [ ] Confirmar que `GET /api/vales/:id/pdf` de un vale ajeno devuelve 403/error (una vez aplicada la Fase 1).
- [ ] Confirmar que 6+ intentos fallidos de login en pocos minutos son bloqueados/retrasados.
- [ ] Revisar logs del servidor una semana después del despliegue en busca de patrones anómalos (muchos 401/403, muchos intentos de login).
- [ ] Confirmar que un backup de MySQL se generó correctamente en el primer ciclo tras el despliegue.

---

## Riesgos que permanecerán después de aplicar todas las medidas de este plan

- **Ataques de día cero** en cualquiera de las dependencias (`express`, `jsonwebtoken`, `mysql2`, `socket.io`, `sharp`, etc.) — mitigado por mantener `npm audit` como práctica periódica, no eliminado por completo.
- **Phishing/ingeniería social** contra empleados con credenciales válidas — ninguna medida técnica de este proyecto elimina este vector; depende de capacitación del personal.
- **Compromiso del propio hosting** (Hostinger) a nivel de infraestructura — fuera del alcance del código de la aplicación.
- **Disponibilidad limitada** ante un ataque de DoS suficientemente grande/distribuido — el rate limiting de este plan mitiga abuso a nivel de aplicación (login, uploads), no reemplaza protección de red/CDN (fuera de alcance de este proyecto sin agregar infraestructura adicional, que el propio pedido de correcciones pide evitar salvo necesidad real).
- **Errores humanos futuros** (un desarrollador reintroduce un `innerHTML` sin escapar, o concatena SQL directo) — sin un linter/regla automatizada, esto depende de revisión de código continua; no se propuso agregar herramientas de análisis estático nuevas por no exceder el alcance pedido, pero es una mejora futura razonable si el equipo crece.
- **Ventana de tolerancia de hasta ~1 minuto** en la revocación de sesión (si se opta por la solución (b) del Hallazgo 4 de autenticación) — o revocación no garantizada mientras el usuario esté desconectado (si se opta por la solución (a)) — esta decisión queda pendiente del desarrollador.

No se declara "el proyecto ahora es seguro" — se declaran los riesgos concretos mitigados por cada fase del plan de remediación, y los que persisten arriba.
