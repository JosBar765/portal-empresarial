# Rendimiento del Buzón: prefiltro SQL por rol

> Plan original de la rama de prueba `perf/buzon-prefiltro-sql` (eliminada; último commit `8010377`). El trabajo se rehízo limpio en `perf/buzon-prefiltro-dev`: ver `odd/tasks/rendimiento-buzon-prefiltro-dev.md` y el informe en `.agents/modulos/vales de arte/documentacion/rendimiento_buzon_prefiltro.md`.

Rama: `perf/buzon-prefiltro-sql` (sale de `fix/ordenamiento-aparicion-vales` por decisión explícita del usuario, 2026-10-17). Es una rama de **prueba de la solución**: el resultado es un informe para aplicarlo después en DEV; no se pushea ni se abre PR.

## Objetivo
Que `obtenerBuzon` (vista `buzon`) deje de cargar y enriquecer TODOS los vales en cada consulta. El SQL solo acota (superconjunto); el JS sigue siendo la fuente de verdad. Prioridad absoluta: el funcionamiento actual de las vistas no cambia, salvo lo decidido abajo.

## Decisiones (usuario)
- D1 Prefiltro en repositorios, solo vista Buzón: `estado NOT IN (RECIBIDO, CONFIRMADO)` y `fecha_entrega < día siguiente al límite superior` (mes: primer día del mes siguiente de `ventana.fecha || hoy`; rango/día: `hasta + 1`; sin `hasta`/`todo`: sin cota). Lo anterior a la ventana pasa siempre (arrastrados). `fecha_entrega` es DATETIME NOT NULL: nunca `<= 'YYYY-MM-DD'`.
- Alcance por rol: asesor `asesor_id = yo`; supervisor `asesor_id IN (sus asesores + él)`; Administrador/Gerente/otros sin alcance de asesor; encargado y asistentes desde `vale_talleres` (`taller_id = miTaller.id`, `activo = 1`, estado de fila `<> APROBADO`) + cola de fusión (`APROBADO_DEPARTAMENTO`) si tiene `vales.aprobar_general` + vale no terminal. `miTaller` lo sigue resolviendo el JS (`talleresTodos.find(encargado_id === idEfectivo)`) y se pasa su id. Diseñador: su rama no cambia; solo se evita la carga de tablas completas que no usa.
- D2 `vale_talleres` se carga UNA vez, por `vale_id IN (vales cargados)`, con TODAS las filas de esos vales (también las de otros talleres). `listarModificacionesEnTramite` se acota por `vale_original_id IN (...)` (no por el id del MOD-). `listarValesConExtra` por ids. Todos los parámetros de ids son OPCIONALES: reportes (`valeReporteService`, `valeReporteGruposService`) conservan su comportamiento.
- D3 `Map` en lugar de `find` (talleres por id; filas del taller por `vale_id`, conservando la PRIMERA).
- D4 Sin `LIMIT` en SQL. Paginación JS (50, cursor) igual.
- D5 Orden por defecto del Buzón SIN cambios (atraso desc, luego fecha de entrega asc, en JS).
- D6 (revisada) El buscador vuelve a su comportamiento original: corre en memoria sobre la lista ya filtrada por rol, ventana, tarjeta y demás filtros, y compara correlativo + cliente + empresa (contiene, minúsculas). Placeholder y mensaje vacío originales. Se elimina la búsqueda fuera de ventana.
- D7 Se quita el chip «Todo». Predeterminado «Hoy» en Buzón Y Trabajo realizado (mismo selector). Corregir `toolbar.js` (chip nulo, limpiar rango vuelve a «Hoy»). El backend sigue aceptando `todo`.
- D8 (revisada) Trabajo realizado también se acota por `fecha_entrega` en ambos lados de la ventana (mes: primer día del mes a primer día del siguiente; rango: desde / hasta+1; todo: sin cota), solo por fecha, sin alcance por rol (superconjunto exacto: todas las ramas de Trabajo terminan en `dentroDeVentana` sin arrastrados). `vale_talleres` se carga con `listarPorVales` de esos vales. Los reportes conservan sus cargas completas.
- D9 Guardas: lista `IN` vacía no debe generar SQL inválido (devolver vacío). Encargado sin taller ni permiso de fusión: lista vacía con texto claro «No tienes un taller asignado» (sin error ni bloqueo). Supervisor sin asesores sigue viendo los suyos.
- Reportes con service propio: fuera de esta rama; queda como mejora posterior en el informe.

## Reglas de implementación
`.agents/reglas/reglas_implementacion.md`: no cambiar endpoints, payloads, ids/clases/`data-*`, ni textos salvo los de D6/D7/D9; sin abstracciones nuevas; comentarios de una línea; SQL solo en repositorios; commits Conventional Commits en español, sin Co-Authored-By.

## Verificación (sin test suite)
`node --check`; BD sintética de ~2.000 vales en un contenedor MySQL aparte (puerto/volumen propios, compose fuera del repo); script que llama a `obtenerBuzon` directo (sin levantar el servidor) por rol × ventana × vista, guarda respuesta + tiempo; comparar ANTES (código del commit base) vs DESPUÉS: respuestas idénticas (listas, orden, tarjetas) salvo D6/D7/D9, y tiempos.

## Tareas
- [ ] T0 Entorno de medición: contenedor MySQL aparte + 2.000 vales sintéticos + script de captura/comparación + línea base (código sin cambios).
- [x] T1 Repositorios: métodos con prefiltro y por ids (opcionales), `listarPorVales`, guarda de listas vacías. (commit 33b0aa5)
- [x] T2 `valeBuzonService`: usar prefiltro por rol, una sola carga de `vale_talleres`, `Map`, saltar cargas en diseñador. (commit 33b0aa5)
- [x] T3 Buscador por correlativo fuera de ventana: REVERTIDO por D6 revisada (buscador original).
- [x] T4 Frontend: quitar «Todo», predeterminado «Hoy», texto de lista vacía del encargado. (commit 00f34f0)
- [x] T5 Medición DESPUÉS, comparación de respuestas y tiempos. Hecha después con A/B del mismo momento (código base 6c7de13 vs rama, 15% de pendientes, 1.422 casos, un usuario por rol): 1.422 idénticos, 0 diferencias. Buzón ~4,3× (mediana 61,7 → 14,5 ms), Trabajo sin «Todo» ~2,8× (82,8 → 29,6 ms). Sin mejora en Trabajo del Diseñador (~97 ms) ni del Encargado UV/3D (~53 ms). Una sola corrida por caso, datos sintéticos, Docker local.
- [x] T6 Informe en `.agents/modulos/vales de arte/documentacion/rendimiento_buzon_prefiltro.md`. Incluye el veredicto de mergeabilidad contra `origin/dev` (ab9cef0): el texto mezcla limpio, pero hay una regresión funcional con la modificación básica en el Buzón del encargado; se recomienda rehacerlo en una rama nueva desde `dev`.

- [x] T7 Trabajo realizado acotado por ventana (D8) y buscador original (D6). (commit 124e7aa)
- [x] T9 Mejoras de consultas por rol tras la medición: Trabajo del encargado y asistentes con propuestas en una sola consulta (92a586d, A/B 309 idénticos, 2,0×), Trabajo del diseñador con vales de la ventana + propuestas en lote (a01ed77, A/B 51 idénticos, 5,8×) y Buzón del diseñador en una consulta (5fd81c9, A/B 57 idénticos, 1,2×).
- [x] T10 Reportes ya no se recarga con los eventos de WebSocket (se actualiza con su botón «Actualizar») y muestra un texto que lo indica (`socket.js`, `views/reportes.js`). Se evaluó cachear los destinatarios de notificaciones y se descartó: cada consulta cuesta ~1 ms y va en segundo plano.
- [x] T11 Notificaciones: `registrar` guarda a todos los destinatarios con un solo INSERT y una sola relectura (antes 2 consultas por destinatario, en serie) mediante `crearParaUsuarios`; la limpieza pasa a 30 días desde la emisión (leídas o no) con `purgarAntiguas`. Probado contra la BD de perf (forma del payload igual, una fila por usuario, la de 31 días se borra y la de 29 se conserva). Sin cambios de esquema. Los avisos no leídos también expiran a los 30 días.
- [x] T8 Recarga por evento de WebSocket: los eventos seguidos comparten una recarga (400 ms), con la pestaña oculta se difiere hasta volver a verla, y las respuestas anteriores a la última carga pedida se descartan. Solo frontend (`socket.js`, `views/buzon.js`); toast y beep no cambian. Verificado con `node --check` y relectura del diff; sin medición.

## Rutas (inline / delegada) y evidencia
Mapeo y comparación de vistas: explorador delegado (2 informes). T0: worker delegado. T1–T4: un writer delegado (2+ archivos no triviales). T5: worker delegado.

## Progreso
T1-T4 implementados y revisados con `node --check` y relectura del diff (sin harness). Campo aditivo de la API: `mensajeVacio` (encargado sin taller). Pendiente: T5 omitida, T6 informe.

T7: `listarAbiertosParaBuzon` pasa a `listarParaBuzon` (`desdeInclusivo` opcional, `estadosTerminales` opcional, `ORDER BY v.id` para orden estable como el natural de `listarTodos`); `_cotaSuperior` pasa a `_limitesDeVentana`. Verificado con `node --check` y relectura del diff.
