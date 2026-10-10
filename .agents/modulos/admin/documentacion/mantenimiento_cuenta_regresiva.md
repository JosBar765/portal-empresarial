# Modo Mantenimiento con cuenta regresiva (Administración)

Al activar el mantenimiento empieza una **cuenta regresiva de 10 minutos** (`MINUTOS_CUENTA_REGRESIVA`, constante en `src/core/permissions/maintenanceMiddleware.js`, no editable desde la pantalla). Durante ella los usuarios siguen trabajando y ven un aviso; al llegar a 0 se bloquea el sistema y se cierran las sesiones de todos los usuarios que no son Administrador (rol_id 1).

## Base de datos

Script `mantenimiento_cuenta_regresiva.sql` (idempotente; reversa en su encabezado). Agrega a `mantenimiento_config`:

- `inicia_en` DATETIME NULL: fin de la cuenta / inicio del bloqueo. NULL con el mantenimiento activo = bloqueo ya en curso (comportamiento anterior; no cierra sesiones).
- `sesiones_cerradas_en` DATETIME NULL: sello del cierre de sesiones de esa activación (una sola vez; permite completarlo tras un reinicio).

## Flujo

1. `PUT /api/admin/mantenimiento` `{ activo: true, mensaje, password }` guarda `inicia_en = NOW() + 10 min` (reloj de MySQL) y limpia `sesiones_cerradas_en`. Activar estando ya activo responde error («El Modo Mantenimiento ya está activo.») y no reinicia la cuenta. Emite por socket `mantenimiento_programado` `{ segundosRestantes, mensaje }` a todos.
2. Durante la cuenta `maintenanceGate` no bloquea. Los clientes que no son Administrador muestran una barra fija («El sistema entra en mantenimiento en MM:SS. Guarda tu trabajo.» + el mensaje), cuentan localmente y se resincronizan cada 30 s con `GET /api/mantenimiento/estado` (`{ activo, enCuentaRegresiva, bloqueando, segundosRestantes, mensaje }`; exige sesión). Código en `public/js/mantenimientoAviso.js`, cargado en el dashboard y en Vales de Arte.
3. Al llegar a `inicia_en` el temporizador del servidor: borra las filas de `sesiones_activas` de usuarios con `rol_id <> 1`, envía `sesion_revocada` a sus sockets (sala `usuario:<id>`) y sella `sesiones_cerradas_en`. El gate responde 503 a los no administradores (HTML con botón «Cerrar sesión» o JSON `{ mantenimiento: true }`).
4. `PUT` con `{ activo: false }` (en cuenta o ya bloqueando) limpia todo, cancela el temporizador y, si estaba en cuenta, emite `mantenimiento_cancelado`.

## Detalles

- **Reinicio del servidor:** el estado vive en la base. Al arrancar (`refrescar()`) se rearma el temporizador; si la cuenta ya venció y `sesiones_cerradas_en` es NULL, el cierre se ejecuta en el acto.
- **Reloj:** el servidor calcula los segundos restantes con `TIMESTAMPDIFF` de MySQL y los clientes cuentan localmente; no se usa el reloj del navegador.
- **Acceso «a medias»:** el access token (JWT) de un usuario cerrado puede seguir firmado hasta 15 min, pero el gate lo bloquea y su refresh token ya no existe.
- **Quien entra con el bloqueo activo:** el login no está detrás del gate; ve la pantalla de mantenimiento y su botón llama a `POST /api/auth/logout` (también fuera del gate) y lo lleva a `/login/`.
- **Administrador:** nunca ve el aviso ni el bloqueo; su vista «Modo Mantenimiento» muestra «Entra en mantenimiento en MM:SS» con el botón «Cancelar mantenimiento».

## Para producción

1. Importar `mantenimiento_cuenta_regresiva.sql` **antes** de desplegar.
2. Desplegar el código y reiniciar la aplicación.
