# Modificaciones: toda modificación crea un vale MOD + rechazo de propuesta

Rama: `feat/modificaciones-mod-y-rechazo-propuesta` (desde `dev` c4be89a).

## Objetivo
Gerencia pide dos cambios en el módulo Vales de Arte:
1. Las tres modificaciones (básica, media, avanzada) crean un vale MOD con el mismo flujo; el formulario de modificación gana la opción «urgente».
2. El chat de la modificación básica (hoy: chat con el taller que devuelve el vale) se reutiliza como flujo de RECHAZO de la propuesta subida.

## Decisiones del usuario (confirmadas una por una)
### Fechas de entrega de una modificación
- NINGUNA modificación se puede pedir de HOY para HOY, a cualquier hora (10:00 o 14:00), ni básica ni urgente.
- Sin urgente: básica 1 día hábil, media 2, avanzada 3; respetan horarios del taller (hora máxima), días que no reciben vales y festivos (calendario existente); nunca hoy.
- Con urgente: la fecha mínima es el siguiente día que reciba vales (mañana si recibe), para los tres tipos; nunca hoy.
- Misma mecánica que la creación (casilla «urgente» en el formulario).

### Modificación básica = vale MOD
- Funciona exactamente igual que la media y la avanzada (formulario completo, justificación, adjuntos, aprobación del supervisor), solo con los plazos de arriba.
- Se elimina el corrimiento de la fecha de entrega al siguiente día de la básica vieja (ya no hace falta; la fecha de entrega no debe cambiar por un rechazo porque cuenta para el atraso).
- El flujo de chat de la básica vieja NO se desecha: se convierte en el rechazo de propuesta.

### Rechazo de propuesta (reutiliza el chat viejo)
- Solo el asesor dueño del vale puede rechazar (no el supervisor).
- Solo con el vale en `PENDIENTE_CONFIRMACION` (antes de confirmar). Aplica también a vales MOD.
- El asesor elige uno o varios talleres (cada uno en `APROBADO`); solo regresan esos; los demás siguen `APROBADO`.
- Mensaje obligatorio (máx. 200 caracteres). Hilo de conversación propio por taller para propuestas (misma mecánica que el de adjuntos rechazados: un hilo por taller, sin límite de mensajes, 200 caracteres, se cierra por acuerdo, mensajes conservados), separado del hilo de adjuntos.
- El taller (Encargado/Asistente de ese taller) puede ACEPTAR o RECHAZAR el rechazo:
  - Aceptar: el taller vuelve a `PENDIENTE_ASIGNACION` sin diseñador (decide el Encargado), el vale vuelve a `CREADO`, la fecha de entrega NO cambia y el atraso se DESCONGELA (corre otra vez desde la fecha de entrega original, `atraso_congelado_en` = NULL).
  - Rechazar (p. ej. el asesor quería disfrazar una modificación): el vale sigue `PENDIENTE_CONFIRMACION` y el atraso sigue congelado; se le sugiere tramitar una modificación.
- Tras un rechazo del taller el asesor puede volver a rechazar sin límite, continuando el mismo hilo.
- Mientras el rechazo está abierto sin respuesta del taller, el asesor puede cancelar su rechazo y confirmar la propuesta, pero NO puede pedir una modificación hasta que el taller responda.
- Fecha de entrega y cupo: sin cambios por el rechazo.

### Datos
- Producción no tiene ningún vale con modificación básica del chat viejo; solo existen en la base de desarrollo. La migración debe ser idempotente y segura (no hace nada en producción); en desarrollo cierra las abiertas y restaura su fecha.

## Evidencia (mapa del código)
- Básica hoy: `valeModificacionBasicaService.js`, `valeModificacionBasicaRepository.js`, tablas `vale_modificaciones_basicas` y `vale_modificacion_mensajes`, migración `09_modificaciones_por_tipo.sql`; rutas `routes.js:106-115`; frontend `actions/modificacionBasica.js`, `modificacionTipo.js`.
- MOD hoy: `valeModificacionService.js` (solo MEDIA/AVANZADA, `:43`), `valeCreacionService.js` `validarDatosVale` (`urgente = !modificacionTipo && esUrgente(...)`, `:456`), `valeHelpers.js` (`DIAS_HABILES_MODIFICACION`, `DIAS_MINIMOS_SIN_URGENTE`).
- Fechas: `src/core/calendario/calendarioLaboral.js` (`fechaMinimaParaTaller`, `nesimoDiaHabil`, `validarFechaEntrega`), `calendarioService.js`, `fechasEntregaService.js`.
- Hilo de adjuntos: `vale_taller_mensajes`, sección de adjuntos del flujo (`flujo_vale_de_arte.md` ~líneas 395-420).
- Atraso: `vales.atraso_congelado_en` y `vale_talleres.atraso_congelado_en`; se congela al llegar la propuesta al asesor (`valeTallerService.js:370`); reanudar = NULL.
- Bug aparte detectado: `valeHelpers.js:136` `PREFIJO_MOD = /^MODd*-/` (falta la barra invertida de `\d`).

## Restricciones
- Migración nueva `NN_tema.sql`, aditiva e idempotente; no editar scripts aplicados ni `schema.sql`/`seed.sql` para producción (CLAUDE.md §7). Documentar sin el correlativo.
- Acciones por permiso, no por nombre de rol. Identidad solo desde `req.user`. Errores con `responderError`. No devolver 401 por errores de negocio (usar 403/400).
- Conservar ids DOM, clases y `data-*`; archivos CRLF; estados con nombre completo; comentarios cortos de una línea.
- Sin cambios de cupo ni de plazos de vigencia.

## Tareas
- [x] T1 · Reglas de fecha de modificación (nunca hoy para hoy; 1/2/3 días hábiles; urgente = siguiente día que reciba vales) en calendario, validación del servidor y calendario del formulario.
- [x] T2 · La modificación BÁSICA crea un vale MOD (selector, formulario, servicio, plazos), `urgente` permitido en MOD, casilla «urgente» en el formulario de modificación, quitar el corrimiento de fecha y el flujo viejo del chat de la básica. Corregir el regex `PREFIJO_MOD`.
- [x] T3 · Rechazo de propuesta: hilo propio por taller, solicitar/aceptar/rechazar/cancelar, descongelar atraso, bloqueos del asesor, avisos y frontend.
- [x] T4 · Migración de datos y permisos (cierre de básicas abiertas en desarrollo, permisos nuevos si aplican) y documentación (`flujo_vale_de_arte.md`, changelog en `correcciones/`).

- [x] T5 · Chat de rechazo de propuesta permanente y de solo lectura (ajuste del usuario tras 6cdef28).

## Ajuste del usuario: el chat permanece como registro
- El chat de rechazo funciona por turnos, igual que el de adjuntos rechazados. Una vez aceptado el acuerdo (o cerrada la ronda por rechazo del taller o cancelación) ya no se pueden enviar mensajes, pero el chat PERMANECE VISIBLE en solo lectura, también después de que el taller entregue la corrección y el asesor marque el vale como recibido (`RECIBIDO`). Es el registro de que el vale fue rechazado y mandado a corregir y del motivo o el acuerdo.
- Quién lo consulta: el asesor dueño y el taller completo (Encargado, asistentes y el diseñador asignado de ese taller). El supervisor NO. El Administrador y el Gerente lo ven en el historial del vale, igual que el chat de adjuntos (quien tenga `vales.ver_historial`).
- Sin etiqueta visual extra: basta un acceso al hilo en el vale; ninguna marca «Rechazado y corregido».
- Cada nueva ronda de rechazo continúa el mismo hilo del taller (el historial completo queda visible).

## Rutas
Delegated direct, un escritor por vez: W1 = T1+T2, W2 = T3+T4 (commit entre ambos). Disparadores: 2+ archivos no triviales y lectura previa para escribir.

## Entrega
Un commit por tarea o por pareja coherente; push solo cuando el usuario lo pida. Estimado total > 400 líneas: estrategia por defecto `ask-on-risk` (preguntar al usuario por cadena de PR si el conteo lo supera antes del siguiente commit).

## Verificación
Sin tests ni linter. `node --check`; scripts de un solo uso contra la BD de desarrollo (cuenta `claude@grupopremia.com`; el servidor corre el usuario y no recarga el backend); comparación de salidas de lo que no debe cambiar contra una copia de HEAD; prueba de calendario con fechas fijas (jueves, viernes, festivo, hora antes/después de la máxima).

## Progreso
W1 (T1+T2) hecho, sin commit, verificado con `node --check` y scripts de un solo uso (calendario con fechas fijas; HEAD vs trabajo en vales normales idénticos). Migración nueva `11_modificacion_basica_con_vale.sql` (ENUM de `vales.modificacion_tipo` ampliado a BASICA; aplicada en desarrollo). Regex `PREFIJO_MOD` corregido. Pendiente para T3: conservar el chat viejo; quitar `fechaMinimaModificacionBasica` (calendario) cuando se retire su servicio; etiqueta `BASICA` en `actions/supervisor.js:142`. Pendiente W2 (T3+T4).

W2 (T3+T4) hecho, sin commit: renombres con git mv a valeRechazoPropuesta* y actions/rechazoPropuesta.js; tablas vale_rechazos_propuesta y vale_rechazo_propuesta_mensajes (hilo por vale_taller_id); permisos vales.rechazar_propuesta (Asesor) y vales.responder_rechazo_propuesta; migración 12_rechazo_propuesta.sql aplicada en desarrollo (segunda corrida sin cambios); changelog correcciones_56.md y flujo §1.1/§1.2/§3/§7. Verificado: node --check de todo lo editado y un script de un solo uso con 36 comprobaciones (36/36) con vales de prueba borrados al final. Sin probar: render en navegador y sockets en vivo.

W3 (T5) hecho, sin commit: el hilo del rechazo permanece visible en solo lectura. Servidor: GET de rondas devuelve todas (abiertas y cerradas) y GET de mensajes sirve el hilo completo con el estado de la última ronda, en cualquier estado del vale; el diseñador asignado lee (nunca escribe, 403); supervisor y terceros 403; cada fila del buzón y de «Trabajo realizado» trae `hilos_rechazo_propuesta` (una consulta por página). Cliente: botón «Ver conversación del rechazo» y aviso de cierre sin caja ni botones. Sin migración ni permisos nuevos. Verificado con node --check y un script de un solo uso (82/82, incluidas las 36 anteriores adaptadas), vales de prueba borrados. Sin probar: render en navegador y sockets en vivo.
