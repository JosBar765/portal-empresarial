# Sistema de Autenticación, RBAC y Seguridad con JWT (Especificación Técnica para Agentes de IA)

Este documento documenta la arquitectura de seguridad, gestión de sesiones y protección de rutas implementada en el **Portal Web de Herramientas Empresariales**. Ha sido redactado con precisión técnica para que cualquier agente de IA pueda comprender, mantener y expandir el sistema sin romper sus principios fundamentales.

---

## 1. Descripción de la Arquitectura de Seguridad

La arquitectura de seguridad ha transicionado de una gestión de sesión basada en estado en memoria (express-session) a una **arquitectura basada en tokens JWT sin estado (stateless)** almacenados en cookies seguras.

```text
               ╔════════════════════════════════════════════╗
               ║             Usuario / Navegador            ║
               ╚════════════════════════════════════════════╝
                  │ GET /dashboard          │ API Request
                  │                         │ with Cookie / Header
                  ▼                         ▼
   ┌─────────────────────────────┐   ┌─────────────────────────────┐
   │    Estáticos Públicos       │   │   Filtro Global Express     │
   │  (/login, /css, /js, etc.)  │   │     (authenticateJWT)       │
   └─────────────────────────────┘   └──────────────┬──────────────┘
                  │                                 │
                  │              ┌──────────────────┴──────────────────┐
                  │              │ ¿Token Válido en Cookie/Header?     │
                  │              └──────────┬──────────────────────┬───┘
                  │                         │ Sí                   │ No
                  │                         ▼                      ▼
                  │                 ┌──────────────┐       ┌──────────────┐
                  │                 │ Adjuntar     │       │ handleUnauth │
                  │                 │ req.user     │       └──────┬───────┘
                  │                 └───────┬──────┘              │
                  │                         │                     ├─► API: 401 JSON
                  │                         ▼                     │
                  │                 ┌──────────────┐              └─► HTML: 302 Redirect
                  ▼                 │ Servir Vista │                  to /login
   ┌─────────────────────────────┐  │   o API      │
   │   Visualización / Cliente   │◄─┴──────────────┘
   └─────────────────────────────┘
```

### Principios Básicos de Diseño:
1. **JWT como Única Fuente de Verdad**: La identidad del usuario (ID, Nombre, Rol, Permisos y Módulos Permitidos) se lee directamente del payload decodificado del JWT en el backend. Los parámetros en el body o query no son válidos para identificar al usuario actual, previniendo la suplantación de identidad.
2. **HttpOnly Cookies**: El token JWT se almacena bajo una cookie llamada `token` con el flag `httpOnly: true`. Esto evita que códigos JavaScript maliciosos (XSS) accedan al token. Adicionalmente, cuenta con `sameSite: 'strict'` para mitigar ataques CSRF.
3. **Control de Acceso Granular (RBAC)**: Autorización basada en permisos individuales en vez de depender estrictamente de nombres de roles. Un usuario tiene asignado un rol, y el rol se mapea con una lista de permisos en el backend.

---

## 2. Prevención de la "Sesión Cómplice" (Go Back Protection)

La vulnerabilidad de "Sesión Cómplice" ocurre si un usuario cierra sesión e intenta volver a ingresar haciendo click en el botón "Atrás" del navegador o escribiendo la URL directa `/dashboard`. Si la página se sirve de forma puramente estática, el navegador podría renderizarla desde su caché en disco, exponiendo la interfaz confidencial del módulo.

### Solución Implementada:
1. **División de Estáticos en Express**:
   En [`src/app.js`], los recursos públicos se sirven en la sección superior mediante middlewares estáticos estándar:
   ```javascript
   app.use('/assets', express.static(path.join(__dirname, '../public/assets')));
   app.use('/css', express.static(path.join(__dirname, '../public/css')));
   app.use('/js', express.static(path.join(__dirname, '../public/js')));
   app.use('/login', express.static(path.join(__dirname, '../public/login')));
   ```
   Cualquier otra ruta confidencial (`/dashboard`, `/modules`) se define **después** de inyectar el middleware interceptor global `authenticateJWT`.
2. **Deshabilitación de Caché**:
   El middleware [`authenticateJWT`] fuerza al navegador a no cachear las respuestas protegidas inyectando cabeceras HTTP específicas antes de evaluar el token:
   ```javascript
   res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
   ```
   Esto obliga al navegador a contactar al servidor en cada click atrás/adelante en vez de cargar la vista desde la memoria caché.
3. **Intercepción 302**:
   Si el token no es válido o ha sido borrado (como ocurre al presionar Salir/Logout), `authenticateJWT` evalúa la naturaleza de la petición:
   *   Si es una **petición de página/documento HTML**: Genera una redirección HTTP 302 inmediata hacia `/login/?expired=true`.
   *   Si es una **petición API (JSON)**: Retorna un código HTTP 401 con detalles en formato JSON.

---

## 3. Desglose del Código y Archivos Core de Seguridad

Cualquier agente de IA que trabaje sobre este repositorio debe revisar y mantener los siguientes archivos:

### A. Helper JWT: [`src/core/auth/jwtHelper.js`]
Abstrae la librería `jsonwebtoken` utilizando variables de entorno de seguridad:
*   `generateToken(payload)`: Firma el payload conteniendo `{ id, nombre, email, rolId, rolNombre, modulosPermitidos, permissions, sid }` con `JWT_SECRET` y la vida del access token (`ACCESS_TOKEN_EXPIRES_IN`, por defecto `15m`).
*   `verifyToken(token)`: Verifica y descodifica el token. Retorna el payload si es válido, o `null` si está corrompido o expiró.

### B. Middleware de Seguridad: [`src/core/permissions/permissionMiddleware.js`]
Define las políticas y guards de rutas:
*   `authenticateJWT`: Interceptor global. Lee la cookie `token`, valida, inyecta `Cache-Control` y adjunta el payload decodificado a `req.user`. Si falla, delega a `handleUnauthorized`.
*   `requireAuth`: Asegura que el flujo cuenta con `req.user` inicializado por el interceptor global.
*   `requirePermission(permissionCode)`: Valida que `req.user.permissions` incluya el código solicitado (ej. `vales.crear`). Si no, responde con un HTTP 403.
*   `requireModule(moduleName)`: Valida que `req.user.modulosPermitidos` incluya el nombre del módulo. Los administradores (`rolId === 1`) se saltan esta comprobación automáticamente.

### B2. Servicio de tokens: [`src/core/auth/tokenService.js`]
Sesión = **access token corto** (cookie `token`) + **refresh token opaco y rotativo** (cookie `refresh_token`, `REFRESH_TOKEN_EXPIRES_IN`, por defecto `12h` como techo absoluto desde el login). Ambas cookies: `httpOnly`, `sameSite: 'strict'`, `path: '/'`.
*   El refresh token nunca se guarda en claro: `sesiones_activas` solo tiene su hash SHA-256 (`refresh_hash`) y el anterior (`refresh_anterior_hash`).
*   `autenticar(req, res)` (usado por `authenticateJWT`, `sessionCheck` y los redirects de `/` y `/login`): si el access token venció, lo renueva solo con el refresh, releyendo rol, permisos y `activo` de la base. Un usuario desactivado o con permisos cambiados lo refleja en la siguiente renovación (minutos), sin depender del socket.
*   Cada renovación rota el refresh token con compare-and-set. Peticiones paralelas con el mismo refresh comparten resultado durante 30 s (en memoria: el sistema es un solo proceso).
*   Presentar un refresh token ya rotado (fuera de esa ventana) = posible robo: se elimina la sesión completa.
*   `POST /api/auth/refresh` fuerza una renovación (lo usa el evento de socket `permisos_actualizados`).
*   La presencia por sockets (`conexiones_activas`) ya no borra la fila al llegar a 0: solo marca `sin_conexiones_desde`. Un login nuevo recibe 409 si la sesión tiene sockets o los perdió hace menos de 30 s; una sesión abandonada se reemplaza y su refresh deja de servir. Los reinicios del servidor conservan las sesiones vigentes.

### C. Controlador de Autenticación: [`src/core/auth/authController.js`]
Gestiona la creación y destrucción de las cookies seguras:
*   `loginPost`: Autentica credenciales vía base de datos, construye el payload del JWT, lo firma y lo inyecta como cookie HttpOnly segura:
    ```javascript
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: ACCESS_MAX_AGE   // (+ cookie refresh_token; ver tokenService.fijarCookies)
    });
    ```
*   `logout`: Destruye el token del navegador inyectando un token vacío y una fecha de expiración inmediata en el pasado:
    ```javascript
    res.cookie('token', '', { httpOnly: true, expires: new Date(0), path: '/' });
    ```
*   `sessionCheck`: Retorna el estado `{ autenticado: true/false, user: {...} }` leyendo el token directamente del navegador si existe.

---

## 4. Guía para Extender Módulos Protegidos

Si como agente necesitas crear un nuevo módulo (ej. `inventario`):
1. **Crear vistas en Frontend**: Coloca tu código HTML y recursos bajo [`public/modules/inventario/`].
2. **Definir Rutas del Módulo en Backend**: En `src/modules/inventario/routes.js`, aplica los guards específicos utilizando los middlewares de permisos centralizados:
   ```javascript
   const { requirePermission } = require('../../core/permissions/permissionMiddleware');
   router.get('/', requirePermission('inventario.ver'), controller.listar);
   ```
3. **Registrar Módulo en Express**:
   En `src/app.js`, añade las rutas del backend **después** del middleware global de JWT:
   ```javascript
   // src/app.js
   app.use(authenticateJWT); // <--- Interceptor global activo
   
   // ... Rutas protegidas ...
   app.use('/api/inventario', requireAuth, require('./modules/inventario/routes'));
   ```
4. **Agregar permisos a la semilla**: Añade los permisos correspondientes (ej. `inventario.ver`) en [`database/seed.sql`] y asígnalos a los roles autorizados.
