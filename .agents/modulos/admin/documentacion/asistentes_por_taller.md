# Asistentes por taller

## Qué cambió

- Hay un rol de asistente por tipo de taller: Asistente de Diseño (rol 7), de Diseño UV/3D, de Protextil y de Diseño Local. Cada uno hereda de su rol de encargado (4, 5, 9, 10) mediante `roles.hereda_de_rol_id`.
- Un taller puede tener varios asistentes, sin límite por taller ni por tienda.
- El asistente puede asignarse a cualquier taller de su tipo, incluido Diseño Local.
- En el flujo de vales, el asistente actúa como el encargado de su taller (buzón, sockets, detalle). La fusión (`vales.aprobar_general`) solo la tiene si el rol del encargado la tiene.

## Reglas de herencia

- Los permisos del rol de asistente se editan solo hacia abajo: nunca más que su encargado. Dar un permiso que el padre no tiene falla con error (pestaña de roles y API).
- Quitar un permiso al rol del encargado lo quita, en la misma operación, de sus roles de asistente.
- Agregar un permiso al encargado **no** se propaga: se agrega a mano al asistente.

## Claim del JWT

El token incluye `heredaDeRolId` (leído de `roles.hereda_de_rol_id` en login y refresco). Un token sin ese claim con `rolId` 7 se trata como asistente del padre 4.

## Cómo un rol es de asistente

Solo mediante el script `asistentes_por_taller.sql`. `crearRol` no tiene campo de padre, así que un rol creado desde la pantalla nunca es de asistente.

## Asistente de un taller sin encargado

No tiene buzón y ve el error «El taller al que fuiste asignado no tiene un encargado.» (decisión del usuario, 2026-10-12). Lo lanza `idEncargadoEfectivo` (`valeCatalogoService.js`); el validador de salas de `events.js` lo captura y rechaza la sala.

## Para producción

1. Respaldo de la base.
2. Importar `asistentes_por_taller.sql` **antes** de desplegar (el claim nuevo lee `roles.hereda_de_rol_id`). Es idempotente y solo agrega.
3. Desplegar el código y reiniciar la aplicación.
4. Los usuarios afectados deben volver a iniciar sesión para recibir el claim. El usuario actual con rol 7 sigue funcionando por el respaldo del rol 7.
5. Reversa: volver al código anterior (el script es aditivo y no estorba); la reversa de la base está en su encabezado.
