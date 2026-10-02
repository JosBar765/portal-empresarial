# Correcciones #31 — Fusión de vales multi-taller por permiso: aviso en vivo, cola, tarjetas y botón

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

## Cola, tarjetas y botón por permiso (frontend)

Quedaban tres puntos del frontend atados al rol en vez del permiso:

- `permisos.js`: `puede('aprobarGeneral')` ya no compara contra los roles 4 y 7, sino contra `vales.aprobar_general` (nuevo helper `tienePermiso`); el Administrador conserva su excepción previa. De esto dependen el botón "Aprobar y fusionar", el "Ver propuesta" de la fusión y la opción "Aprobado por Talleres" del filtro de estado.
- `config/contadores.js`: los cinco roles de encargado de taller comparten una sola configuración de tarjetas. Las de fusión (`pendientesFusion`, `fusionadosHoy`, `totalFusionados`) llevan `permiso: 'vales.aprobar_general'`.
- `views/buzon.js` (`renderContadores`): filtra las tarjetas que exigen un permiso que el usuario no tiene.

El backend ya calculaba la cola y las filas de "Trabajo realizado" por permiso (`valeBuzonService`: `puedeFusionar`), así que no cambió.

Alcance: aplica a los roles de encargado de taller (4, 5, 7, 9 y 10), cuyo buzón es el que mezcla la cola de fusión. Un rol de otro tipo (asesor, supervisor, técnico, gerente) con el permiso no vería la cola, porque su buzón tiene otra estructura.

## Verificación

Revisión de sintaxis y de que no queden referencias a `salaFusion`, más pruebas en navegador con el permiso concedido al Encargado de Protextil (que no participaba en los vales):

- Recibe en vivo el aviso de "listo para fusión"; un Gerente sin el permiso que pide unirse a `vales:fusion` y `vales:admin` no recibe nada.
- Su buzón muestra la tarjeta "Vales por fusionar" y el botón "Aprobar y fusionar" en cada vale `APROBADO_DEPARTAMENTO`; en "Trabajo realizado", las tarjetas de fusionados.
- La fusión por API la acepta el backend (el vale pasa a `PENDIENTE_CONFIRMACION`).
- El Encargado de UV/3D, sin el permiso, no ve tarjetas ni botones de fusión.
