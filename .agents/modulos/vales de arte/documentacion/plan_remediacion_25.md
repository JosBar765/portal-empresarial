# Plan de Remediación — Auditoría de Seguridad #25

Documento aparte de `correcciones_25.md` (la auditoría), tal como pide
`analisis_correcciones_25.md`. Ordenado por fases: Fase 1 (crítico/alto),
Fase 2 (medio), Fase 3 (hardening/mejoras). **Todavía no se implementó
nada de este plan** — queda pendiente de aprobación antes de tocar código,
según la regla del propio archivo de correcciones ("si una medida de
seguridad requiere modificar comportamiento existente, explícame primero
el problema y cómo propones solucionarlo").

Regla general para las 3 fases: después de cada una, re-verificar en vivo
(servidor real + MySQL local) que sigan funcionando: login/logout,
autorización por permiso, WebSockets (buzón en tiempo real), subida de
archivos, generación/descarga de PDF, conexión a la base de datos — el
mismo criterio que ya se usó en las correcciones anteriores de este
proyecto.

---

## Fase 1 — Crítico y Alto

### 1.1 Quitar el fallback hardcodeado de `JWT_SECRET`
- **Archivo**: `src/config/env.js`.
- **Cambio**: si `process.env.JWT_SECRET` no existe, `console.error` +
  `process.exit(1)` al arrancar (mismo patrón que `database.js` con la
  conexión a MySQL) en vez de usar un valor de repuesto.
- **Prueba**: arrancar el servidor sin `JWT_SECRET` en `.env` → debe
  fallar inmediatamente con un mensaje claro, sin quedar escuchando en el
  puerto. Con `JWT_SECRET` presente, arranca normal.
- **¿Rompe algo?**: no, mientras `.env` tenga la variable (ya la tiene en
  dev). **Acción del desarrollador**: generar un secreto real y aleatorio
  para Hostinger antes de desplegar — nunca reusar el de `.env.example`.

### 1.2 Autenticar el WebSocket y validar las salas en el servidor
- **Archivos**: `src/core/websocket/socketManager.js` (principal),
  `public/modules/vales/js/socket.js` (si hace falta mandar el token
  explícito en el handshake).
- **Cambio propuesto**:
  1. `io.use((socket, next) => {...})`: extraer el JWT de la cookie del
     handshake (`socket.handshake.headers.cookie`, parseable con
     `cookie-parser` ya usado en el proyecto, o `cookie.parse` de la misma
     librería) y verificarlo con `jwtHelper.verifyToken` — si no hay token
     válido, `next(new Error('No autenticado'))` (Socket.IO rechaza la
     conexión). Guardar el payload decodificado como `socket.user`.
  2. En `register_module`, en vez de unir el socket a CUALQUIER sala que
     pida, recalcular las salas permitidas en el servidor a partir de
     `socket.user` (mismo criterio que ya usa
     `public/modules/vales/js/permisos.js:roomsParaUsuario` en el
     frontend — se puede portar esa misma lógica a un helper compartido,
     o simplemente intersectar lo pedido contra lo permitido) e ignorar
     cualquier sala que no le corresponda.
  3. `activeConnections`/`userId` (línea 17-19 actual) deja de venir del
     query string del cliente y pasa a venir de `socket.user.id` (ya
     verificado).
- **Prueba de seguridad**: conectar un socket SIN cookie de sesión (ej.
  con `socket.io-client` puro, sin pasar por el navegador autenticado) —
  debe ser rechazado en la conexión. Conectar un socket autenticado como
  Asesor e intentar `register_module` con `'vales:admin'` o
  `'supervisor:99'` — debe quedar ignorado/rechazado, sin recibir eventos
  de esas salas.
- **¿Rompe algo?**: no debería, si el frontend ya calcula las mismas
  salas que el servidor validará. Riesgo de detalle: confirmar que la
  cookie SÍ viaja en el handshake de Socket.IO desde el navegador (por
  defecto sí, mismo origen) antes de dar esto por cerrado.

### 1.3 Cerrar el IDOR de descarga de PDF
- **Archivo**: `src/modules/vales/services/valeConfirmacionService.js`
  (`obtenerValeParaPdf`).
- **Cambio**: aplicar el mismo chequeo de pertenencia que ya usa
  `valeDetalleService._puedeVerVale(usuario, vale, talleres)` antes de
  devolver el vale — si no puede verlo, lanzar el mismo tipo de error que
  ya usa el resto del código (`throw new Error('...')`, capturado como
  400 por el controller existente, sin cambiar el contrato del endpoint).
- **Prueba de seguridad**: loguearse como un Asesor de la tienda A, hacer
  `GET /api/vales/<id-de-un-vale-de-la-tienda-B>/pdf` → debe fallar (400,
  no un PDF). El mismo Asesor pidiendo el PDF de SU PROPIO vale sigue
  funcionando igual.
- **¿Rompe algo?**: no — todo el que hoy debería poder ver ese PDF
  (dueño, su cadena de supervisión, el taller involucrado, Administrador)
  sigue pudiendo.

### 1.4 Rate limiting en el login
- **Archivo**: `src/core/auth/authRoutes.js` (o donde esté montada la ruta
  de login).
- **Dependencia nueva**: `express-rate-limit`.
- **Cambio**: middleware de rate limit aplicado solo a la ruta de login
  (`POST /api/auth.php?action=login` y/o `/api/auth/login`, según cuál se
  use realmente), con una ventana razonable (ej. 10 intentos / 15 minutos
  por IP) — nunca por correo aislado (para no permitir que alguien bloquee
  la cuenta de otro solo probando su correo repetidamente sin la IP
  correcta), pero si se quiere además granularidad por cuenta, combinar IP
  + correo en la clave del limiter.
- **Prueba de seguridad**: hacer 11+ intentos de login fallidos seguidos
  contra la misma ruta → el intento 11 debe responder con un 429 (o el
  código que se configure) en vez de intentar la autenticación real.
  Esperar la ventana y confirmar que vuelve a funcionar.
- **¿Rompe algo?**: no, con límites generosos — un usuario real
  equivocándose 2-3 veces con su contraseña nunca lo alcanza.

### 1.5 Validar magic bytes en uploads y no confiar en la extensión del usuario
- **Archivos**: `src/core/files/supabaseStorage.js` (`subir()`),
  `src/modules/vales/routes.js` (config de `multer`, agregar `fileFilter`
  como primera barrera).
- **Cambio**:
  1. Función pequeña (sin librería nueva) que compare los primeros bytes
     del buffer contra las firmas conocidas de PNG/JPEG/WEBP/PDF (todas
     tienen magic numbers fijos y bien documentados) y rechace si no
     coincide con el `mimetype` declarado.
  2. La extensión del objeto en Storage se deriva de una tabla fija
     `mimetype_real → extensión` (no de `path.extname(nombreOriginal)`).
  3. `fileFilter` en la config de `multer` como primera validación
     (mismo criterio de mimetypes permitidos, antes de que el archivo
     llegue a memoria completa).
- **Prueba de seguridad**: subir un archivo `.txt`/`.html` renombrado con
  extensión `.png` y `Content-Type: image/png` falso → debe ser rechazado
  con un error claro. Subir una imagen real → sigue funcionando igual.
- **¿Rompe algo?**: no, para archivos legítimos. Revisar que las 3
  llamadas existentes a `subirYRegistrarArchivo` (crear vale, entregar
  propuesta, aprobar general) sigan recibiendo el mismo tipo de respuesta
  en el caso exitoso.

### 1.6 XSS almacenado en el módulo de Vales
- **Archivos**: `public/modules/vales/js/utils/formato.js` (agregar
  `escapeHtml`, mismo código que ya existe en
  `public/modules/admin/js/utils/formato.js`),
  `public/modules/vales/js/actions/supervisor.js` (función `campo()` en
  `abrirModalInfoVale`, y la interpolación de `justificacion`),
  `public/modules/vales/js/actions/historial.js` (`actor_nombre`,
  `accion`).
- **Cambio**: envolver cada interpolación de datos de otro usuario en
  `innerHTML` con `escapeHtml(...)`.
- **Prueba de seguridad**: crear un vale con
  `cliente_nombre = '<img src=x onerror=alert(1)>'` desde un Asesor, y
  abrir "Ver info" de ese vale como Supervisor/Encargado → debe mostrarse
  el texto literal (escapado), sin ejecutar ningún script/alert.
- **¿Rompe algo?**: no — el texto visible para caracteres normales no
  cambia.

### 1.7 Actualizar dependencias vulnerables
- **Cambio**: `npm audit fix` (cubre `multer` y las transitivas de
  `qs`/`express`/`body-parser`, todas dentro del rango semver `^` ya
  declarado, sin downgrade de major version).
- **Prueba**: después de actualizar, repetir el flujo completo de uploads
  (crear vale con adjuntos, entregar propuesta, aprobar general) para
  confirmar que `multer` sigue comportándose igual.
- **¿Rompe algo?**: bajo riesgo (parche menor), pero se prueba
  explícitamente por tratarse de la librería de uploads.

---

## Fase 2 — Medio

### 2.1 Mensaje genérico de login (sin enumeración de usuarios)
- **Archivo**: `src/core/auth/authService.js`.
- **Cambio**: unificar los 3 mensajes de error (usuario no encontrado,
  contraseña incorrecta, cuenta desactivada) a uno solo genérico en la
  respuesta al cliente; conservar el detalle real en un `console.log`/log
  de servidor si se quiere seguir diagnosticando internamente.
- **Prueba**: intentar login con un correo inexistente y con un correo
  real + contraseña incorrecta → ambos deben devolver el mismo mensaje.

### 2.2 Revocar sesión al desactivar un usuario
- **REQUIERE DECISIÓN DEL DESARROLLADOR** sobre el nivel de garantía:
  - **Opción mínima** (recomendada para esta fase, sin impacto de
    performance): `adminService.establecerActivoUsuario` emite un evento
    dirigido con `socketManager.sendToUser(usuarioId, 'sesion_revocada',
    {})`; el frontend (todas las páginas protegidas, vía
    `sessionGuard.js` o el propio `socket.js` de cada módulo) escucha ese
    evento y fuerza logout + redirect inmediato. Cubre al usuario mientras
    tenga el socket conectado.
  - **Opción robusta**: `authenticateJWT` verifica `usuarios.activo`
    contra la base de datos con un cache corto en memoria (ej. 30-60s)
    para no golpear la DB en cada request. Cierra también el caso de un
    usuario sin socket conectado, a costa de una consulta/cache adicional
    en el middleware global.
- **Prueba**: desactivar un usuario que tiene una sesión activa en el
  navegador → según la opción elegida, confirmar que pierde el acceso de
  inmediato (opción mínima, si tiene el socket abierto) o dentro de la
  ventana de cache configurada (opción robusta).

### 2.3 No filtrar errores internos al cliente
- **Archivos**: `src/app.js` (handler de errores global), controllers que
  hoy devuelven `error.message` en respuestas 500.
- **Cambio**: cuando el código de respuesta sea 500 (no un `throw new
  Error` de negocio, que ya usa 400), responder con un mensaje genérico
  fijo y loguear el detalle completo solo en el servidor. Puede
  centralizarse en el handler global de `app.js` sin tocar cada
  controller uno por uno, si se envuelve el patrón común.
- **Prueba**: forzar un error no controlado (ej. violar una restricción
  de FK que hoy no se valida antes) → la respuesta al cliente debe ser un
  mensaje genérico, y el detalle completo debe aparecer en el log del
  servidor.

### 2.4 Restringir el CORS de Socket.IO
- **Archivo**: `src/core/websocket/socketManager.js`, `.env.example` /
  `.env` (nueva variable `SOCKET_CORS_ORIGIN`), `src/config/env.js`
  (leerla).
- **Cambio**: `cors: { origin: process.env.SOCKET_CORS_ORIGIN ||
  'http://localhost:3000', methods: ['GET','POST'] }` — en producción,
  Hostinger configura `SOCKET_CORS_ORIGIN` con el dominio real.
- **Prueba**: confirmar que el frontend propio sigue conectando
  normalmente; opcionalmente, confirmar desde una página de otro origen
  que la conexión es rechazada por CORS.
- **¿Rompe algo?**: no, si `SOCKET_CORS_ORIGIN` se configura
  correctamente en cada entorno.

### 2.5 Agregar Helmet (cabeceras HTTP)
- **Archivo**: `src/app.js`.
- **Dependencia nueva**: `helmet`.
- **Cambio**: `app.use(helmet({ contentSecurityPolicy: false }))` antes de
  las rutas — CSP desactivada en este primer paso para no arriesgar
  romper los scripts de Ionicons/Socket.IO cargados desde CDN sin una
  revisión aparte; las demás cabeceras (`X-Frame-Options`,
  `X-Content-Type-Options`, etc.) quedan activas con los defaults de
  Helmet.
- **Prueba**: cargar cualquier página del portal y confirmar en DevTools
  que sigue funcionando igual (sin errores de consola por recursos
  bloqueados) y que las nuevas cabeceras aparecen en la respuesta.
- **Nota**: activar `contentSecurityPolicy` con una política ajustada
  queda como mejora de Fase 3+ una vez se audite cada script/CDN cargado.

### 2.6 Validación de longitud/formato + contraseña mínima
- **Archivos**: `valeCreacionService.validarDatosVale`,
  `adminService.crearUsuario`.
- **Cambio**: límites de longitud explícitos en campos de texto libre de
  vales (coincidiendo con el `VARCHAR` real de cada columna), y longitud
  mínima de contraseña (ej. 8 caracteres) al crear un usuario.
- **Prueba**: intentar crear un vale con un campo excesivamente largo, o
  un usuario con contraseña de 1 carácter → ambos deben rechazarse con un
  mensaje claro (400), no un error de MySQL sin controlar.

---

## Fase 3 — Hardening y mejoras adicionales

### 3.1 `algorithms`/`algorithm` explícito en JWT
- **Archivo**: `src/core/auth/jwtHelper.js` — `{ algorithms: ['HS256'] }`
  en `verify`, `{ algorithm: 'HS256' }` en `sign`.

### 3.2 `maxAge` de la cookie derivado de `JWT_EXPIRES_IN`
- **Archivo**: `src/core/auth/authController.js` — función simple que
  convierta `'12h'`/`'24h'` a milisegundos, reutilizada en login y
  logout.

### 3.3 Retirar o documentar el endpoint CSRF placeholder
- **Archivo**: `src/core/auth/authController.js` (`getCsrfToken`).
- Confirmar primero (grep de `action=csrf` en todo `public/`) que nada lo
  consume antes de retirarlo; si algo lo llama, dejarlo pero documentar
  claramente que no cumple ninguna función real de protección.

### 3.4 Fail-closed en verificaciones de rol desconocido
- **Archivo**: `valeDetalleService.js` (`_puedeVerVale`,
  `_filtrarHistorialPorRol`) — cambiar el default de "permitir todo" a
  "denegar todo" para cualquier rol no contemplado explícitamente.
- **Prueba**: no debería cambiar nada observable con los 10 roles
  actuales (todos siguen las ramas explícitas ya existentes).

### 3.5 `limitInputPixels` explícito en `sharp()`
- **Archivo**: `src/core/files/imageOptimizer.js`.

### 3.6 Body limit explícito de Express
- **Archivo**: `src/app.js` — `express.json({ limit: '200kb' })` (o el
  valor que se prefiera, documentado).

### 3.7 Granularidad de permisos del panel de administración
- **REQUIERE DECISIÓN DEL DESARROLLADOR** — no implementar sin definir
  primero qué escenario de acceso parcial se necesita (hoy solo
  Administrador tiene `admin.ver`, así que no hay urgencia real).

### 3.8 Nota operativa de logging
- Sin cambio de código — documentar en el runbook de despliegue que los
  logs del servidor (incluye SQL con datos de negocio, no secretos) no
  deben quedar accesibles públicamente en el panel de Hostinger.

---

## Resumen de dependencias nuevas por fase

| Fase | Dependencia | Motivo |
|---|---|---|
| 1 | `express-rate-limit` | Rate limiting del login |
| 2 | `helmet` | Cabeceras de seguridad HTTP |
| 1 | (actualización, no nueva) `multer`/`express`/transitivas vía `npm audit fix` | Parchar CVEs de DoS |

## Resumen de variables de entorno nuevas

| Variable | Fase | Motivo |
|---|---|---|
| `SOCKET_CORS_ORIGIN` | 2 | Restringir CORS de Socket.IO al dominio real en producción (ya anticipada como comentario en `.env.example`, nunca leída por el código hasta ahora) |

Ninguna otra variable nueva es necesaria — el resto de las correcciones
reutiliza configuración ya existente (`JWT_SECRET`, `JWT_EXPIRES_IN`,
`NODE_ENV`).
