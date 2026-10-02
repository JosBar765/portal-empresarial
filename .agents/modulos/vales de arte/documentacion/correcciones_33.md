# Correcciones #33 — Mensajes de error más claros para el usuario

Rama: `fix/mensajes-de-error`.

## Diagnóstico

Se revisaron todos los mensajes que llegan a la pantalla (servicios, middlewares, `responderError` y el frontend):

1. **Códigos internos en el texto:** varios mensajes mostraban estados como `EN_PROCESO`, `ESPERANDO_AUTORIZACION` o `APROBADO_DEPARTAMENTO`, o nombres de campo como `clienteNombre`.
2. **Mensajes crípticos o en tercera persona:** "Ya hay una operación en curso…", "Este vale tiene más de un taller — no se puede resolver automáticamente", "Su usuario no tiene un taller asignado", "no pertenece a un asesor bajo su mando".
3. **Permiso técnico a la vista:** el 403 decía "Se requiere el permiso: vales.crear".
4. **Errores internos mal clasificados como de negocio:** un `Error` lanzado por una librería (por ejemplo mysql2 con "Bind parameters must not contain undefined", sin `code`) y los errores de `supabaseStorage` (con nombre de bucket y ruta) se devolvían tal cual. Es la vía por la que podía verse texto de SQL o de Storage.
5. **Mensaje genérico poco útil:** "Ocurrió un error interno en el servidor." no decía qué hacer; los errores comunes de MySQL (duplicado, base caída, bloqueo) terminaban en ese mismo texto.
6. **Frontend:** un fallo de red mostraba "Failed to fetch"; y si el servidor respondía un error sin texto, el mensaje quedaba vacío.

## Cambios

- `erroresHttp.js`:
  - Un error cuya primera línea de pila está en `node_modules` se trata como interno (el detalle va solo al log).
  - Errores conocidos de MySQL con mensaje propio: duplicado (409), dato demasiado largo, referencia inexistente o en uso, bloqueo/deadlock (503) y base sin conexión (503).
  - Mensaje genérico nuevo: "Algo salió mal de nuestro lado. Inténtalo de nuevo en unos minutos; si el problema continúa, avisa al administrador." (también en el manejador global de `app.js`).
- `supabaseStorage.js`: sus errores (configuración, subida, eliminación) pasan a `StorageUploadError`, que ya se trata como interno.
- `permissionMiddleware.js`: "No tienes permiso para realizar esta acción." y "No tienes acceso a este módulo." (sin el código del permiso ni del módulo).
- Servicios de vales (`valeCreacion`, `valeTaller`, `valeConfirmacion`, `valeBuzon`, `valeHelpers`, `valeMutex`, `valePdf`): unos 40 mensajes reescritos en lenguaje de usuario, en segunda persona y sin estados ni nombres de campo (p. ej. "Solo se puede pausar un vale que esté en proceso.", "Ese técnico no está a tu cargo.", "Este vale se está procesando en este momento. Espera unos segundos e inténtalo de nuevo.").
- Acción ya realizada por otra persona (`valeTallerService.aprobarGeneral`): si el vale ya fue fusionado, el mensaje es "Este vale ya fue fusionado por otro encargado. Actualiza la página para ver su estado."; si aún no llegó a ese punto, "Este vale aún no está listo para fusionar." Los demás casos ya cubrían el mismo escenario: autorizar ("Este vale ya fue autorizado."), aprobar modificación ("La modificación de este vale ya fue aprobada.") y asignar ("Este vale ya tiene un técnico asignado en tu taller.").
- `sessionGuard.js` (cargado en todas las páginas): un fallo de red se convierte en "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo."
- `valesApi.js`, `adminApi.js`, `roles.js`, `usuarios.js`: si el servidor no manda texto de error, se muestra "No se pudo completar la acción. Inténtalo de nuevo."

## No cambia

- El texto de los errores de validación del módulo de administración y de login, que ya estaban en lenguaje claro.
- El detalle técnico en el log del servidor, que se conserva completo.

## Verificación

- `responderError` con: error de negocio, `ErrorDeNegocio`, `ER_DUP_ENTRY`, error de SQL, conexión rechazada, `TypeError` y un error de `jsonwebtoken` (librería): los de negocio mantienen su texto; los de librería, SQL y bugs devuelven el mensaje genérico; duplicado → 409; conexión → 503.
- Contra el servidor en desarrollo: técnico sobre un vale ajeno ("Este vale no está asignado a ti."), id inválido ("Identificador inválido."), crear sin permiso y autorizar sin permiso ("No tienes permiso para realizar esta acción."), asignar con técnico ya asignado ("Este vale ya tiene un técnico asignado en tu taller.").
