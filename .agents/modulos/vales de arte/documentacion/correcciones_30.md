# Correcciones #30 — Permisos "Ver módulo", Administrador protegido y permiso antes de cada acción

Rama: `feature/permisos-ver-modulo`.

## Punto 1 — JWT y almacenamiento (solo diagnóstico, sin cambios de código)

- **¿Se usa HttpOnly?** Sí. El JWT viaja en la cookie `token` con `httpOnly: true`, `sameSite: 'strict'` y `secure` en producción (`authController.js`). El frontend nunca lo toca: `localStorage` solo guarda preferencias de interfaz (pestaña activa, sidebar colapsado).
- **Duración de 12 h**: ver la propuesta pendiente de confirmación en la conversación (access token corto + refresh token). No se implementó nada.

## Punto 2 — Permisos

### 2.1 Permiso "Ver {módulo}" como acceso global

Los permisos `vales.ver` y `admin.ver` ya existían; ahora son realmente el acceso al módulo:

- `src/core/permissions/modulesCatalog.js` (nuevo): catálogo único de módulos. Lo usan `/api/modules` (tarjetas del dashboard) y el gate de acceso.
- `requireModuleAccess` (`permissionMiddleware.js`), montado en `app.use('/modules', …)`: sin el permiso "ver", la página redirige a `/dashboard/?vista=modulos` y cualquier recurso del módulo (JS/CSS) responde 403. El `?vista=modulos` evita el rebote del Administrador hacia su panel.
- `/api/vales` y `/api/admin` exigen `vales.ver` / `admin.ver` a nivel de montaje, además del permiso de cada ruta. Tener `vales.crear` sin `vales.ver` ya no sirve para llamar la API a mano.
- `modulosPermitidos` del JWT (`authService._cargarPermisosYRol`) ahora incluye un módulo solo si el usuario tiene su permiso `.ver`; antes bastaba cualquier permiso de ese módulo.

### 2.2 Permisos del Administrador no removibles

- Backend (`adminService.actualizarPermisosRol`): para el rol 1, si la lista nueva omite un permiso que ya tiene, responde 400 `No se pueden quitar permisos al rol Administrador.` Agregar permisos sí se permite, y lo agregado queda igual de protegido. Los ids se validan como enteros positivos.
- Frontend (`views/roles.js`): en el modal de permisos del Administrador las casillas marcadas quedan deshabilitadas, "Marcar/Desmarcar todos" las ignora y se muestra un aviso. Es solo UX; la regla real está en el backend.
- Los demás roles siguen siendo editables.
- Los permisos actuales del Administrador no cambian (sigue sin write de vales, ver `CLAUDE.md`).

### 2.3 Permiso antes de cada acción

Auditoría de rutas: todas las rutas de `vales/routes.js` y `admin/routes.js` ya declaraban su `requirePermission`; lo que faltaba era el gate de páginas y el "ver" a nivel de módulo (2.1). No hubo rutas sin guard que corregir.

## Pruebas

Script contra la base demo con JWT firmados localmente (19 comprobaciones, todas OK): gate de páginas/recursos, API con y sin "ver", `/api/modules`, rechazo de quitar/vaciar permisos al Administrador, ids inválidos, agregar permisos, y edición normal de otro rol. La base se restauró al terminar.
