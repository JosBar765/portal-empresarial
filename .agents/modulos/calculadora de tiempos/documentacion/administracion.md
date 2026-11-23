# Calculadora de Tiempos — administración

Solo con `tiempos.administrar`. Rutas `/api/tiempos/admin/*`.

## Borrador y publicación
- La primera vez que se guarda algo se crea un **borrador** como copia de la versión en uso (número sugerido: 5.0 → 5.1). Solo hay un borrador a la vez.
- Los usuarios siguen viendo la versión en uso hasta **publicar**: el administrador pone número, fecha y una nota; la publicada pasa a «reemplazada».
- No se puede publicar un borrador sin cambios. Descartar el borrador no toca lo publicado.
- Una versión anterior puede reutilizarse como borrador (si no hay otro borrador).

## Qué se edita
| Pestaña | Qué | Ruta |
|---|---|---|
| Rangos y días | Nombre, si se muestra, si lleva moldes o lanyard, y los rangos con días por etapa de un producto | `PUT /admin/productos/:clave` (`POST /admin/productos` crea) |
| Extras | Rangos de cada tipo de UV y las reglas generales (moldes, colores, margen) | `PUT /admin/extras` |
| Avisos | Avisos de un producto y avisos generales | producto: `PUT /admin/productos/:clave`; generales: `PUT /admin/avisos-generales` |
| Etapas y líneas | Renombrar y agregar (no se borran) | `PUT /admin/catalogos` |

Otras rutas: `GET /admin/estado`, `GET /admin/tabla`, `GET /admin/cambios`, `POST /admin/publicar`, `DELETE /admin/borrador`, `GET /admin/versiones`, `GET /admin/versiones/:id/cambios`, `POST /admin/versiones/:id/usar-como-borrador`, `GET /admin/actividad`.

## Reglas al guardar (`calculo/validacion.js`)
- Rangos: cantidades enteras desde 1; cada rango empieza donde termina el anterior + 1; el **último** rango es siempre «en adelante» y «a convenir» (su inicio se calcula solo); un día por cada etapa del producto (0 a 365).
- Un producto nuevo nace **oculto**; para mostrarlo necesita al menos un rango con días.
- Nombres de producto únicos (2 a 150 caracteres); avisos de hasta 255 caracteres (máximo 10 por lista); reglas dentro de límites (por ejemplo colores incluidos de 1 a 12).
- Los errores vuelven por campo con el motivo y cómo corregirlo (`campos` en la respuesta 400).

## Historial
Cada guardado, publicación y descarte queda en `tiempos_historial` con quién lo hizo (pantalla «Actividad reciente»). El «qué cambió» de una versión se calcula comparándola con la anterior.
