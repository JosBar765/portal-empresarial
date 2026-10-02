# Correcciones #31 — Aviso en vivo de fusión por permiso, no por taller

Rama: `fix/sala-fusion-por-permiso`.

## Problema

La acción de fusionar vales multi-taller ya dependía del permiso `vales.aprobar_general`, pero el aviso en tiempo real de "listo para fusión" (`APROBADO_DEPARTAMENTO`) se enviaba a la sala del taller llamado "Diseño" (`valeCatalogoService.salaFusion()` y un bloque equivalente en `atrasoWatcher.js`). Un encargado de otro taller con el permiso veía la cola al recargar, pero no recibía el toast ni el refresco automático (el servidor no lo dejaba entrar a una sala `taller:<id>` ajena). Si el taller "Diseño" se renombraba o desactivaba, el aviso caía a `vales:admin` y nadie en la práctica se enteraba.

## Cambio

Nueva sala `vales:fusion`, a la que se une cualquier usuario cuyo JWT incluya `vales.aprobar_general`, sin importar rol ni taller.

- `valeHelpers.js`: constantes `PERMISO_FUSION` y `SALA_FUSION`, únicas fuentes del nombre del permiso y de la sala.
- `events.js` (`puedeUnirseASala`): `vales:fusion` se concede si `usuario.permissions` incluye el permiso. Se evalúa antes de las ramas por rol, que devuelven `false` temprano para asesor/supervisor/técnico.
- `valeTallerService.js`: al aprobar un taller que deja el vale en `APROBADO_DEPARTAMENTO`, el aviso va a `SALA_FUSION` (más la sala del taller que aprobó, como antes).
- `atrasoWatcher.js`: la alerta de atraso de un vale `APROBADO_DEPARTAMENTO` va a `SALA_FUSION`. Se eliminó el import de `tallerRepository`, que ya no se usa.
- `valeCatalogoService.js`: se elimina `salaFusion()`.
- `public/modules/vales/js/permisos.js`: `roomsParaUsuario` agrega `vales:fusion` cuando `user.permissions` incluye el permiso (la lógica por rol quedó en `salasPorRol`).

## Comportamiento

- Los permisos viajan en el JWT, que se renueva cada 15 min; un cambio de permisos desde el panel ya recarga a los usuarios conectados (`permisos_actualizados`), momento en que se reúnen a las salas que les corresponden.
- Quien ya fusionaba (Encargado de Diseño y Asistente) no nota diferencia: sigue recibiendo el aviso, ahora por la sala de fusión y no por la de su taller.
- Seguridad: la sala sigue validándose en el servidor contra el usuario autenticado del handshake; el cliente no puede unirse a `vales:fusion` sin el permiso.

## Fuera de alcance (pendiente)

- `puede('aprobarGeneral')` en `public/modules/vales/js/permisos.js` sigue limitado por rol (Encargado de Diseño y Asistente), así que un tercer rol con el permiso recibiría el aviso pero no vería el botón de fusionar. Y la cola `APROBADO_DEPARTAMENTO` solo se arma en el buzón de los roles de encargado de taller (`valeBuzonService.obtenerBuzon`).

## Verificación

Revisión de sintaxis de todos los archivos tocados (`node --check`) y de que no queden referencias a `salaFusion`. No se probó de extremo a extremo con sockets reales.
