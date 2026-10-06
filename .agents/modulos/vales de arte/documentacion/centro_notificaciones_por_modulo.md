# Centro de notificaciones por módulo

El centro de notificaciones dejó de ser global: **cada notificación pertenece a un módulo** y cada módulo muestra solo las suyas. Rama `fix/centro-notificaciones`.

## Qué cambió

- **Datos:** la tabla `notificaciones` tiene la columna `modulo` (`VARCHAR(30)`, id del catálogo `modulesCatalog.js`: `vales`, `admin`…), con el índice `(usuario_id, modulo, leida_en, id)`. `valeEvents` guarda las suyas con `modulo: 'vales'`.
- **API** (`/api/notificaciones`):
  - `GET /?modulo=<id>`: lista paginada, con `noLeidas` de ese módulo.
  - `POST /leer-todas` con `{ modulo }`: marca solo las de ese módulo.
  - `POST /:id/leer`: sin cambios.
  - `GET /resumen`: `{ vales: 3, admin: 0 }`, las no leídas de cada módulo (alimenta las burbujas del dashboard).
  - Un `modulo` ausente o que no exista en el catálogo responde `400` («El módulo de las notificaciones no es válido.»).
- **Tiempo real:** el evento `notificacion_nueva` lleva `modulo`; cada centro ignora los de otros módulos.
- **Pantallas:**
  - **Vales de Arte** y **Administración**: cada uno inicia su campana con su id (`centroNotificaciones.iniciar({ socket, modulo })`). Administración, que aún no genera notificaciones, muestra su campana con «No hay notificaciones.».
  - **Dashboard:** ya no tiene campana. Cada tarjeta de módulo muestra una **burbuja roja con el número de no leídas** (como las apps del celular; «99+» a partir de 100; oculta si es 0), que sube en vivo y se recalcula al volver a la página.
- **Limpieza de 60 días:** sin cambios, aplica a las leídas de todos los módulos.

## Para sumar notificaciones a un módulo nuevo

1. Que el módulo esté en `modulesCatalog.js`.
2. Al guardar, llamar a `notificacionService.registrar(usuariosIds, { modulo: '<id>', mensaje, ... })`.
3. En su página, tener `<div class="notif-root" id="notificaciones-root">`, cargar `/js/notificaciones.js` e iniciar `window.centroNotificaciones.iniciar({ socket, modulo: '<id>' })`. La burbuja del dashboard aparece sola.

## Base de datos existente

```sql
ALTER TABLE notificaciones ADD COLUMN modulo VARCHAR(30) NOT NULL DEFAULT 'vales' AFTER usuario_id;
ALTER TABLE notificaciones DROP INDEX idx_notificaciones_usuario,
  ADD INDEX idx_notificaciones_usuario (usuario_id, modulo, leida_en, id);
```

Las notificaciones que ya existían quedan como `vales`.

## Verificación

Por API: la lista y el contador se filtran por módulo, marcar todas de `admin` no toca las de `vales`, el resumen coincide, un módulo ausente, inexistente o con inyección da 400 y un usuario no ve las de otro. En pantalla: Administración muestra «No hay notificaciones.»; el dashboard no tiene campana y la tarjeta de Vales muestra su burbuja (10 → 11 al llegar una notificación en vivo); dentro del módulo la campana coincide y, al leerlas todas y volver al dashboard, la burbuja desaparece.
