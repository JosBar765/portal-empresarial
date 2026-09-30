# Correcciones #30 — Access token corto con refresh token, permisos "Ver módulo", Administrador protegido y permiso antes de cada acción

Ramas: `feature/permisos-ver-modulo` (punto 2) y `feature/refresh-token` (punto 1).

## Punto 1 — Access token corto + refresh token rotativo

Diagnóstico: el JWT ya viajaba en cookie httpOnly (`sameSite: strict`, `secure` en producción); `localStorage` solo guarda preferencias de interfaz. Lo mejorable era la vida del token (12 h): un permiso revocado o una cuenta desactivada seguían valiendo hasta 12 h para quien no tuviera el socket abierto, y un token robado servía todo ese tiempo.

Implementado (`src/core/auth/tokenService.js` y ajustes en auth/middleware/socket):

- **Access token de 15 min** (`ACCESS_TOKEN_EXPIRES_IN`) + **refresh token** opaco y rotativo en cookie httpOnly (`REFRESH_TOKEN_EXPIRES_IN`, 12 h como techo absoluto de la sesión, igual que antes). La variable vieja `JWT_EXPIRES_IN` ya no se usa.
- Solo el hash SHA-256 del refresh token se guarda (`sesiones_activas`). Columnas nuevas: `refresh_hash`, `refresh_anterior_hash`, `refresh_expira_en`, `sin_conexiones_desde`; `database/schema.sql` actualizado y `sesionRepository.asegurarEsquema()` las agrega solas a bases existentes al arrancar.
- `authenticateJWT`, `session_check` y los redirects de `/` y `/login` renuevan el access vencido de forma transparente desde el refresh, releyendo rol/permisos/`activo` de la base: un cambio de permisos o una cuenta desactivada surte efecto en la siguiente renovación (≤15 min) aunque no haya socket. No hubo cambios en el frontend: el 401 (y el aviso de sesión expirada) ahora solo aparece cuando la sesión de verdad murió.
- Rotación en cada renovación con compare-and-set; peticiones paralelas con el mismo refresh comparten resultado 30 s. Un refresh ya rotado que reaparece fuera de esa ventana revoca toda la sesión (posible robo).
- Socket: el handshake acepta un access vencido si su firma es válida y su sesión sigue vigente (mismo `sid`), para que las reconexiones no fallen.
- Presencia vs. sesión: perder sockets (navegar entre páginas, recargar) ya **no borra** la fila, porque ahora guarda el refresh token; solo marca `sin_conexiones_desde`. Un login nuevo recibe 409 si la sesión tiene sockets o los perdió hace menos de 30 s; una abandonada se reemplaza (su refresh deja de servir). Reiniciar el servidor conserva las sesiones vigentes (`reiniciarPresencia` en vez de `limpiarTodas`).
- `logout` funciona con el access vencido y limpia ambas cookies.

Despliegue: al arrancar con esta versión se migra la tabla y las sesiones abiertas (sin refresh token) se descartan: todos inician sesión una vez. En `.env` reemplazar `JWT_EXPIRES_IN` por `ACCESS_TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` (o quitar la línea para usar 15 m / 12 h).

Pruebas (base demo, 43 comprobaciones OK): login con dos cookies httpOnly/strict, solo el hash en la base, renovación con access vencido, techo de sesión intacto, 6 renovaciones simultáneas con el mismo resultado, `/refresh`, `/` y `/login` con solo refresh, `session_check`, sockets (vencido con sesión viva / sin cookies / firma falsa / sesión revocada), token alterado, reuso tras la ventana (revoca), token de varias rotaciones (401 sin tumbar la sesión), reemplazo de sesión abandonada y 409 con sockets, logout con access vencido, techo vencido, usuario desactivado y permisos frescos. En navegador con access de 15 s: navegación real entre Dashboard/Administración/Vales, rotación visible en la base y sesión intacta tras reiniciar el servidor.

## Punto 2 — Permisos

### 2.1 Permiso "Ver {módulo}" como acceso global

Los permisos `vales.ver` y `admin.ver` ya existían; ahora son realmente el acceso al módulo:

- `src/core/permissions/modulesCatalog.js` (nuevo): catálogo único de módulos. Lo usan `/api/modules` (tarjetas del dashboard) y el gate de acceso.
- `requireModuleAccess` (`permissionMiddleware.js`), montado en `app.use('/modules', …)`: sin el permiso "ver", la página redirige a `/dashboard/?vista=modulos` y cualquier recurso del módulo (JS/CSS) responde 403. El `?vista=modulos` evita el rebote del Administrador hacia su panel.
- `/api/vales` y `/api/admin` exigen `vales.ver` / `admin.ver` a nivel de montaje, además del permiso de cada ruta. Tener `vales.crear` sin `vales.ver` ya no sirve para llamar la API a mano.
- `modulosPermitidos` del JWT (`authService._cargarPermisosYRol`) ahora incluye un módulo solo si el usuario tiene su permiso `.ver`; antes bastaba cualquier permiso de ese módulo.

### 2.2 Permisos de administración del Administrador no removibles

- Alcance: solo los permisos del módulo `admin` (`admin.ver`, `admin.usuarios.gestionar`, etc., actuales y futuros). Los de otros módulos, como `vales.ver`, se le pueden agregar y quitar como a cualquier rol.
- Backend (`adminService.actualizarPermisosRol`): para el rol 1, si la lista nueva omite un permiso `admin` que ya tiene, responde 400 `No se pueden quitar al Administrador los permisos del módulo de administración.` Los ids se validan como enteros positivos.
- Frontend (`views/roles.js`): en el modal del Administrador solo las casillas marcadas del grupo `admin` quedan deshabilitadas; "Marcar/Desmarcar todos" las ignora y un aviso lo explica. Es solo UX; la regla real está en el backend.
- Los demás roles siguen siendo editables.

### 2.3 Permiso antes de cada acción

Auditoría de rutas: todas las rutas de `vales/routes.js` y `admin/routes.js` ya declaraban su `requirePermission`; lo que faltaba era el gate de páginas y el "ver" a nivel de módulo (2.1). No hubo rutas sin guard que corregir.

## Pruebas

Script contra la base demo con JWT firmados localmente (19 comprobaciones, todas OK): gate de páginas/recursos, API con y sin "ver", `/api/modules`, rechazo de quitar/vaciar permisos al Administrador, ids inválidos, agregar permisos, y edición normal de otro rol. La base se restauró al terminar.

## Variables de entorno obligatorias, sin valores por defecto

Rama: `feature/env-obligatorias`.

- `src/config/env.js` ya no tiene valores por defecto: cada variable de `.env.example` es obligatoria. Por cada una que falte (o esté vacía) se imprime una línea `[FATAL] Falta la variable de entorno X en el .env.` y el proceso termina; se listan todas juntas, no solo la primera.
- Validaciones de formato: `NODE_ENV` ∈ `development|production|test`; `PORT`/`DB_PORT` enteros 1-65535; `JWT_SECRET` ≥ 32 caracteres (en producción no puede ser el valor de ejemplo); `ACCESS_TOKEN_EXPIRES_IN`/`REFRESH_TOKEN_EXPIRES_IN` = entero positivo + `s|m|h|d` (cualquier cantidad: `45s`, `90m`, `2h`, `7d`); `SOCKET_CORS_ORIGIN` = uno o varios orígenes exactos separados por coma (sin barra final, sin `*`, `https` en producción); `SUPABASE_URL` URL válida; `DB_PASSWORD` puede estar vacía solo fuera de producción.
- `SOCKET_CORS_ORIGIN` ahora es obligatoria y se usa desde `config` (`socketManager` ya no lee `process.env` ni cae a `http://localhost:3000`).
- Pruebas (47 comprobaciones OK): cada variable ausente, vacía o con formato inválido, valores válidos arbitrarios, producción con secreto de ejemplo / origen `http` / contraseña vacía, varios errores a la vez, y arranque real con el `.env` actual (CORS responde solo al origen permitido).
- Al actualizar: el `.env` local debe reemplazar `JWT_EXPIRES_IN` por `ACCESS_TOKEN_EXPIRES_IN` y `REFRESH_TOKEN_EXPIRES_IN` y definir `SOCKET_CORS_ORIGIN` (el `.env` de esta máquina ya quedó actualizado; los de otros entornos hay que ajustarlos).

## Seguridad — Fase 1 del plan de remediación

Rama: `security/fase-1` (detalle y resultados en `plan_remediacion_30.md`, sección "Resultado de la Fase 1").

- **Usuarios sin secretos:** el repositorio de usuarios lista columnas explícitas; `password_hash`, `intentos_fallidos` y `bloqueado_hasta` ya no viajan al navegador.
- **Errores:** `core/utils/erroresHttp.js` (`responderError`, `ErrorDeNegocio`) separa errores de negocio (se muestra el mensaje) de internos (MySQL, Storage, bugs: mensaje genérico y detalle al log). Los ids de rutas/cuerpos se validan con `core/utils/validar.js` (`idObligatorio`, `idOpcional`).
- **Login:** tipos y largos validados, correo normalizado, bloqueo de cuenta (5 fallos → 15 min), segundo límite por IP (solo fallos), tiempo de respuesta igualado con un hash ficticio.
- **Gate de módulos:** decodifica y normaliza la ruta (`%76ales`, `./`, `//`, mayúsculas, puntos finales).
- **Sesiones:** cambiar contraseña o desactivar a un usuario elimina su sesión al instante.
- **Logs:** sin SQL con valores ni hashes; el correo del login se sanea (`core/utils/logs.js`).
- **Imágenes:** se rechazan por dimensiones declaradas (> 40 MP) leyendo solo la cabecera (`core/files/imagenDimensiones.js`).
- **`TRUST_PROXY`:** nueva variable obligatoria del `.env` (0 = sin proxy; Hostinger normalmente 1).
- **Pruebas reutilizables:** `scripts/security/` (`pruebas-fase1.js`, `pruebas-sesion.js`, `prueba-e2e-vale.js`, `stub-storage.js`) — requieren una base desechable, nunca la de desarrollo con datos reales.
