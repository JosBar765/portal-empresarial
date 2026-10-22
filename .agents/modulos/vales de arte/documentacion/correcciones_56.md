# Correcciones 56 — Toda modificación crea un vale MOD y rechazo de propuesta

Rama: `feat/modificaciones-mod-y-rechazo-propuesta` (desde `dev`). Pedido de gerencia.

## Qué cambia

- **La modificación básica crea un vale MOD**, igual que la media y la avanzada (formulario completo, justificación, adjuntos y autorización del supervisor). Solo cambia el plazo: +1, +2 y +3 días hábiles. `vales.modificacion_tipo` admite `BASICA`.
- **«Urgente» en las modificaciones:** el formulario de modificación tiene la casilla «Pedido urgente»; con ella la fecha mínima es el siguiente día que reciba vales, para los tres tipos.
- **Nunca de hoy para hoy:** ninguna modificación (básica, media, avanzada ni urgente) puede pedirse para el día de la solicitud, a ninguna hora. Respeta la hora máxima del taller, los días que no recibe vales y los feriados (calendario existente).
- **Se retira el corrimiento de la fecha de entrega** de la básica anterior (`fechaMinimaModificacionBasica` en `calendarioLaboral.js` y `calendarioService.js`, y la aplicación/restauración de `vales.fecha_entrega` del repositorio): la fecha de entrega ya no cambia por un chat porque cuenta para el atraso.
- **El chat de la básica anterior pasa a ser el rechazo de propuesta.** Con el vale en `PENDIENTE_CONFIRMACION` (también un MOD), el asesor dueño (permiso `vales.rechazar_propuesta`; el supervisor no) rechaza la propuesta de uno o varios talleres `APROBADO` con un mensaje obligatorio de 1 a 200 caracteres. Cada taller (encargado o asistente) responde por separado:
  - **Acepta:** su fila pasa a `PENDIENTE_ASIGNACION` sin diseñador, el vale vuelve a `CREADO`, la fecha de entrega no cambia y el atraso se descongela (`atraso_congelado_en = NULL` en la fila y en el vale).
  - **Rechaza** (mensaje obligatorio): el vale sigue en `PENDIENTE_CONFIRMACION` con el atraso detenido; el asesor puede volver a rechazar sin límite.
- **Hilo propio por taller** (`vale_rechazo_propuesta_mensajes`), separado del de adjuntos, 200 caracteres por mensaje y sin límite de mensajes. Una nueva ronda continúa el mismo hilo; al aceptar, el hilo se cierra a la vista y los mensajes se conservan (los ve en el historial quien tiene `vales.ver_historial`, en «Conversación del rechazo de propuesta»).
- **Bloqueos del asesor:** con un rechazo abierto no se puede confirmar ni pedir una modificación (servidor y pantalla); puede cancelar el rechazo y luego confirmar.
- **Avisos:** eventos `RECHAZO_PROPUESTA_SOLICITADO`, `_MENSAJE`, `_ACEPTADO`, `_RECHAZADO` y `_CANCELADO` entre el asesor y la sala del taller (encargado y asistentes); el supervisor no recibe aviso ni lee el hilo. Cada paso queda en `vale_historial`.
- **Pantalla:** «Rechazar propuesta» en el visor del paso 5 del asesor dueño (selección de talleres y mensaje); etiqueta «Rechazo de propuesta» en la fila mientras está abierto, «Rechazo respondido» cuando el taller rechazó, y chat con «Cancelar rechazo» (asesor) o «Aceptar» / «Rechazar» (taller). La etiqueta del tipo de modificación en la autorización del supervisor ya incluye «básica».
- **Corrección de un error:** la expresión `PREFIJO_MOD` de `valeHelpers.js` era `/^MODd*-/` (le faltaba la barra invertida de `\d`) y no reconocía `MOD2-`, `MOD3-`…; ahora es `/^MOD\d*-/`.

## Migración (importar ANTES de desplegar)

`database/modificacion_basica_con_vale.sql` amplía el ENUM de `vales.modificacion_tipo` con `BASICA`.

`database/rechazo_propuesta.sql` (idempotente): tablas `vale_rechazos_propuesta` y `vale_rechazo_propuesta_mensajes`; permisos `vales.rechazar_propuesta` (rol Asesor de Ventas) y `vales.responder_rechazo_propuesta` (los mismos roles que tenían `vales.responder_modificacion_basica`); y la limpieza de la básica anterior: las solicitudes `EN_CONVERSACION` pasan a `CANCELADA` y su vale recupera la fecha de entrega anterior a la solicitud. En producción no hay solicitudes, así que no cambia datos. No borra `vale_modificaciones_basicas`, `vale_modificacion_mensajes` ni el permiso `vales.responder_modificacion_basica`: quedan sin uso. Los usuarios deben cerrar sesión e iniciar de nuevo.

## Archivos

Servidor: `services/valeRechazoPropuestaService.js` y `repositories/valeRechazoPropuestaRepository.js` (renombrados desde la básica), `controllers/valeController.js`, `routes.js`, `services/valeService.js`, `valeBuzonService.js`, `valeDetalleService.js`, `valeConfirmacionService.js`, `valeModificacionService.js`, `valeTallerService.js`, `valeHelpers.js`, `valeCreacionService.js`, `fechasEntregaService.js` y `core/calendario/calendarioLaboral.js` / `calendarioService.js`.
Cliente: `actions/rechazoPropuesta.js` (renombrado), `actions/asesor.js`, `modificacionTipo.js`, `historial.js`, `supervisor.js`, `forms/valeForm.js`, `views/buzon.js`, `api/valesApi.js`, `permisos.js`, `socket.js`, `utils/modificacionesVistas.js` y `css/styles.css`.

## Verificación

Con la base local, un script de un solo uso con vales de prueba creados y borrados al final:

- Rechazar con el vale en `PENDIENTE_CONFIRMACION`; el supervisor no puede rechazar ni leer el hilo; mensaje vacío o de 201 caracteres rechazado; no se duplica un rechazo abierto; otro taller no accede.
- Con el rechazo abierto, confirmar y pedir una modificación fallan con mensaje claro; cancelar el rechazo y luego confirmar funciona.
- El taller rechaza (mensaje obligatorio): el vale sigue en `PENDIENTE_CONFIRMACION` con el atraso detenido y el asesor rechaza de nuevo en el mismo hilo.
- El taller acepta: fila en `PENDIENTE_ASIGNACION` sin diseñador, vale `CREADO`, misma fecha de entrega, atraso descongelado y mensajes conservados.
- Vale de dos talleres con uno elegido: solo ese regresa. Un vale MOD admite el rechazo.
- No cubierto: el dibujo de las pantallas en el navegador y los avisos en tiempo real con el servidor corriendo.
