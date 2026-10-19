# Rendimiento del Buzón (rama limpia desde dev)

Rama: `perf/buzon-prefiltro-dev`, sale de `origin/dev` (`ab9cef0`, 2026-10-19). Sin upstream a propósito: NO se pushea hasta que lo pida el usuario. Rehace el trabajo de `perf/buzon-prefiltro-sql` (en origen) con historial limpio y compatible con `dev` actual. El informe completo del trabajo original está en `.agents/modulos/vales de arte/documentacion/rendimiento_buzon_prefiltro.md` (rama `perf/buzon-prefiltro-sql`); el plan y las decisiones, en `odd/tasks/rendimiento-buzon-prefiltro.md` de esa rama.

## Objetivo
Que el Buzón y Trabajo realizado dejen de cargar todo el historial en cada consulta y en cada evento de WebSocket, sin cambiar lo que se ve en las vistas (salvo lo decidido abajo).

## Decisiones (usuario, ya tomadas en la rama original)
- El SQL solo acota (superconjunto); el JS de cada rol sigue decidiendo. Sin `LIMIT` en SQL; paginación JS de 50 con cursor. Orden por defecto del Buzón sin cambios (atraso desc, luego fecha de entrega asc, en JS).
- Buzón: abiertos (no RECIBIDO/CONFIRMADO) con `fecha_entrega < día siguiente al límite de la ventana`; lo anterior siempre pasa. Alcance por rol (asesor, supervisor, encargado y asistentes desde `vale_talleres` + fusión; diseñador sin tablas completas).
- Trabajo realizado: solo `fecha_entrega` dentro de la ventana por ambos lados; propuestas en una consulta por lote (encargados y diseñador).
- Se quita «Todo»; «Hoy» por defecto en Buzón y Trabajo. El buscador queda como estaba (en memoria, dentro de la vista: correlativo, cliente y empresa).
- Reportes no se recarga con eventos de WebSocket (botón «Actualizar» + texto). Recarga agrupada, diferida con la pestaña oculta y con respuestas viejas descartadas.
- Notificaciones: un INSERT para todos los destinatarios y retención de 30 días desde la emisión (leídas o no).
- Encargado sin taller: texto «No tienes un taller asignado» (campo aditivo `mensajeVacio`).

## Ajuste nuevo por `dev` (modificación básica)
`_buzonEncargado` de `dev` muestra siempre, sin depender de la ventana, los vales cuya fila de mi taller ya está APROBADA pero tienen una conversación de modificación básica `EN_CONVERSACION` con mi taller (el vale puede estar RECIBIDO). El prefiltro del encargado debe incluirlos: método nuevo en `valeModificacionBasicaRepository` para los `vale_id` abiertos del taller (Administrador: todos) y carga de esos vales sin filtro de estado ni de fecha, unidos por `id`.

## Reglas
`.agents/reglas/reglas_implementacion.md`: no cambiar endpoints, payloads (salvo el campo aditivo), ids/clases/`data-*` ni textos salvo los decididos; sin abstracciones nuevas; SQL solo en repositorios; comentarios de una línea; archivos CRLF se editan conservando CRLF. Commits Conventional Commits en español, sin Co-Authored-By.

## Tareas
- [x] T1 Aplicar el cambio neto de código de `perf/buzon-prefiltro-sql` (`git diff ec4af71 origin/perf/buzon-prefiltro-sql -- src public`) sobre `dev` y revisar que cada hunk encaja con el código de `dev`. Aplicó limpio con `git apply --3way`; commit `f0a91a6`.
- [x] T2 Ajuste de la modificación básica en el prefiltro del encargado y asistentes. `listarValeIdsAbiertosDeTaller` + `_conBasicasAbiertas`; commit `6387afc`.
- [x] T3 (commits `f0a91a6`, `6387afc`, `d7d7dd3`, `d72aff4`, `fbaebdb`) Dejar el historial en commits de unidad: (a) prefiltro SQL del Buzón y Trabajo acotado con propuestas en lote, (b) ajuste de básicas, (c) sin «Todo» + «Hoy» + respuestas viejas, (d) recarga por evento + Reportes manual, (e) notificaciones.
- [x] T4 `node --check` de todo lo cambiado y relectura del diff contra `dev`.
- [ ] T5 Verificación A/B del mismo momento contra `origin/dev` (necesita los scripts de `database/` de `dev` en la BD de pruebas y básicas abiertas en el generador). Pendiente de aprobación del usuario por el tiempo que lleva.
- [ ] T6 Documentar en `.agents/modulos/vales de arte/documentacion/` (adaptar el informe original a lo que quede).

## Rutas
Un writer delegado para T1-T4 (13 archivos de código); T5 aparte.

## Progreso
T1-T4 hechos en cinco commits de unidad; sin pushear. Pendientes T5 y T6.
