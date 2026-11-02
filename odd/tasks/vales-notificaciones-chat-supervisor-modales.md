# Vales: notificaciones de baja/vencimiento, chats del supervisor y ajustes de modales

Rama: `feat/vales-notificaciones-chat-supervisor-modales` (desde `dev` 3b94fbf). Sin push (lo pide el dueño).

## Objetivo
Cinco ajustes pedidos por el dueño sobre el módulo vales y la administración.

## Alcance autorizado
Solo lo listado en cada tarea. Sin migraciones de BD (el `tipo` de notificación es texto libre de hasta 30 caracteres).

## Ruta y evidencia
Delegada: un escritor para todas las tareas (2+ archivos no triviales por tarea). Mapeo previo por un explorador de solo lectura y verificación del padre en `valeCreacionService.js:262-346` y `valeAdjuntosService.js:150-278`.

## Pruebas
No hay suite ni runner (excepción al test-first documentada en CLAUDE.md). Verificación: `node --check` en cada JS tocado, lectura cruzada y prueba funcional que haga el dueño en su servidor.

## Entrega
Forecast ~250 líneas autorizadas cambiadas (< 400): una sola rama, un commit por tarea, estrategia `ask-on-risk`.

## Tareas
- [x] T1 (109100a) Notificaciones de baja y vencimiento. Hallazgo: ya existen avisos para vencimiento (`EXPIRADO`, `ADJUNTOS_VENCIDOS`, `POR_EXPIRAR`), baja del vale (sin `tipo`) y baja de taller. Huecos: (a) la baja del vale completo no tiene `tipo`: añadir `VALE_DADO_DE_BAJA`; (b) `quitarTallerDeVale` no avisa al diseñador asignado de la fila quitada; (c) los tres cálculos de destinatarios están repetidos: un helper compartido. Destinatarios: asesor dueño, supervisores de su tienda, encargados y asistentes de los talleres activos y diseñadores asignados, calculados antes del borrado.
- [x] T2 (4966588) El supervisor lee (solo lectura) el chat de rechazo de adjuntos y el de rechazo de propuesta: supervisores que cubren al asesor del vale. Backend (`valeAdjuntosService._resolverAcceso`, `valeRechazoPropuestaService` `_resolverAcceso`/`listar`/`hilosVisibles`) y frontend (`actions/adjuntos.js`, `views/buzon.js`).
- [x] T3 (43134e1) Bug «rechazo del rechazo»: el motivo se lee del textarea del chat, que se vacía al enviar el mensaje. Si el textarea está vacío, usar el último mensaje del taller del hilo. `aceptar` no cambia.
- [x] T4 (c19a006) Al cerrar el modal «Ver info» del supervisor se vuelve al modal general («Ver vale» / «Ver info»), también con X, Escape y clic en el fondo: `alCerrar` opcional en `components/modal.js`.
- [x] T5 (77ab409) Los modales de personal de tiendas y de talleres (admin) no se cierran tras agregar o quitar: se refresca la lista y se limpia el formulario sin reabrir otro overlay.
- [x] T6 (0cf988a) «Rechazar» del taller abre un modal propio para el motivo (opción C): se retira el atajo de T3 (último mensaje del hilo) y el motivo se guarda una sola vez. Escape cierra solo el modal pequeño (listener en captura, porque el componente cierra todos los modales abiertos).
- [x] T7 (ed1cdbe) Docs: el supervisor dueño puede rechazar la propuesta de sus vales (migración 26 del padre).

## Criterios de aceptación
- T1: baja manual, baja de taller y vencimientos notifican a todos los involucrados; la campana muestra el `tipo` nuevo; `vale_id` queda en NULL si el vale se borró.
- T2: el supervisor ve ambos hilos sin poder escribir, decidir ni cancelar; un supervisor ajeno recibe 403.
- T3: rechazar el rechazo funciona habiendo enviado antes el mensaje; sin ningún mensaje del taller sigue el error claro.
- T4: los tres modos de cierre reabren el modal general; el resto de modales no cambia.
- T5: tras agregar o quitar, el modal sigue abierto con la lista actualizada y la lista de la página al fondo también.

## Docs a actualizar con el comportamiento
`.agents/modulos/vales de arte/flujo_vale_de_arte.md` (§1.2, §2.1, §8), `documentacion/baja_taller_multitaller.md`, `documentacion/centro_notificaciones_por_modulo.md`, `.agents/modulos/admin/README.md`.

## Progreso y evidencia
- T1 (109100a): helper salasDeInvolucrados en valeHelpers.js usado por darDeBaja y _eliminarValeVencido; tipo VALE_DADO_DE_BAJA; quitarTallerDeVale avisa al diseñador de la fila. node --check OK en valeHelpers, valeCreacionService y valeAdjuntosService; docs flujo §2.1/§8, baja_taller_multitaller y centro_notificaciones actualizados.
- T2 (4966588): esSupervisorDelAsesor en valeHelpers.js; rama supervisor de solo lectura en valeAdjuntosService._resolverAcceso y en valeRechazoPropuestaService (_resolverAcceso, listar, hilosVisibles con lado SUPERVISOR); frontend: puedeLeerConversacionAdjuntos, botón «Ver conversación» en el modal de adjuntos y línea de estado del supervisor. node --check OK (backend y copias .mjs del frontend). Sin navegador: UI no verificada.
- T3 (43134e1): en rechazoPropuesta.js el motivo de «Rechazar» sale de la caja o, si está vacía, del último mensaje del taller del hilo cargado. node --check OK sobre copia .mjs. UI no verificada.
- T4 (c19a006): alCerrar opcional en abrirModal (una sola ejecución, tras retirar el overlay) y uso en «Ver info» del supervisor. node --check OK sobre copias .mjs. UI no verificada.
- T5 (77ab409): tiendaPersonal.js y tallerPersonal.js repintan el cuerpo del mismo modal tras cada alta o baja y refrescan la lista de la página al fondo, sin segundo overlay. node --check OK sobre copias .mjs. UI no verificada.
- T6 (0cf988a): rechazoPropuesta.js con abrirModalMotivoRechazo (abrirModal + wireContador, 200 caracteres); flujo §1.2 actualizado. node --check OK sobre copia .mjs; imports verificados contra valesApi.js y adjuntos.js. UI no verificada (sin navegador).
- T7 (ed1cdbe): flujo §1.2 y §3 (fila del Supervisor de Ventas y nota). Solo documentación.
- Ruta: delegada (un escritor). Un commit por tarea; sin push.

## Siguiente paso
Prueba funcional del dueño en su servidor (reiniciar para cargar el backend); push y PR a decisión del dueño.
