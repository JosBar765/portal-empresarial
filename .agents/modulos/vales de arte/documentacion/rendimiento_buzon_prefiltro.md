# Rendimiento del Buzón y Trabajo realizado: prefiltro SQL y eventos

Rama final: `perf/buzon-prefiltro-dev` (sale de `origin/dev` `ab9cef0`; ver la sección 9 con el resultado).
El trabajo se hizo primero en `perf/buzon-prefiltro-sql` (sale de `fix/ordenamiento-aparicion-vales`, base `ec4af71`), una rama de prueba que **se eliminó** al rehacerlo limpio sobre `dev`; su último commit fue `8010377`. Las secciones 1 a 8 son el análisis que se hizo en esa rama y siguen valiendo como explicación de lo hecho.
Plan y estado por tarea: `odd/tasks/rendimiento-buzon-prefiltro.md` (plan original) y `odd/tasks/rendimiento-buzon-prefiltro-dev.md` (rama final).
Fecha de las mediciones: 2026-10-17 y 2026-10-19 (Guatemala).

## 1. Veredicto de mergeabilidad de la rama de prueba contra `origin/dev` (ab9cef0)

- **Texto: limpio.** `git merge-tree --write-tree origin/dev perf/buzon-prefiltro-sql` no marca conflictos. Los tres archivos que tocaron los dos lados (`socket.js`, `views/buzon.js`, `valeBuzonService.js`) mezclan solos.
- **Lógica: NO es seguro mergear tal cual.** Hay una regresión funcional confirmada por lectura del diff de `dev` (sección 6), que Git no detecta.
- Decisión: no mergear esa rama. Se creó una rama nueva desde `dev` actualizado con el cambio neto (sección 7) y el ajuste de la sección 6. Resultado en la sección 9.
- Lo revisado de `dev`: el diff de `valeBuzonService.js`, `socket.js` y `views/buzon.js`, y los métodos de `valeModificacionBasicaRepository.js`. No se ejecutó el código de `dev` ni se revisaron sus otros 35 archivos.

## 2. Problema

`valeBuzonService.obtenerBuzon` cargaba en cada consulta todos los vales (`valeRepository.listarTodos`), toda la tabla `vale_talleres` (dos veces), los vales con extras y las modificaciones en trámite; enriquecía, filtraba por rol y ventana, contaba y ordenaba en memoria, y recién entonces paginaba de a 50. Cada evento de WebSocket hacía que cada navegador repitiera la consulta (incluida la de Reportes). El historial no tiene tope, así que el costo crecía con él.

## 3. Qué se hizo

Principio: el SQL solo **acota** (superconjunto) y el JS de cada rol sigue siendo la fuente de verdad. Por eso listas, orden y tarjetas no cambian.

### 3.1 Buzón: prefiltro por rol (`valeBuzonService.js`, repositorios)
- `valeRepository.listarParaBuzon({ estadosTerminales, asesorIds, valeIds, desdeInclusivo, hastaExclusivo })`, con `ORDER BY v.id` (el `listarTodos` original no tenía orden; así los empates quedan estables).
- Criterio del Buzón: estado distinto de RECIBIDO/CONFIRMADO y `fecha_entrega < día siguiente al límite de la ventana`. Lo anterior a la ventana siempre pasa (arrastrados). `fecha_entrega` es DATETIME: nunca usar `<= 'YYYY-MM-DD'`.
- Límites de ventana (`_limitesDeVentana`): mes = primer día del mes a primer día del mes siguiente (de `ventana.fecha || hoyISO()`); rango = `desde` y `hasta + 1 día`; `todo` o sin `hasta` = sin cota.
- Alcance por rol (`_cargarAbiertosDelBuzon`): asesor `asesor_id = yo`; supervisor sus asesores + él; Administrador/Gerente/otros sin alcance; encargado y asistentes desde `vale_talleres` (`taller_id = miTaller`, `activo`, estado de fila distinto de APROBADO, vía `valeTallerRepository.listarValeIdsDeTallerSinEstado`) más la cola de fusión (`valeRepository.listarIdsPorEstado(APROBADO_DEPARTAMENTO)`) si tiene `vales.aprobar_general`. `miTaller` lo resuelve el JS como siempre y se pasa su id.
- `vale_talleres` se carga una vez (`valeTallerRepository.listarPorVales(ids)`, todas las filas de esos vales, `activo = 1`, `ORDER BY vt.id`) y se pasa a `_enriquecerConTaller(vales, valeTalleresPrecargados = null)`. Con ese segundo parámetro también se acotan `listarValesConExtra(valeIds)` y `listarModificacionesEnTramite(originalIds)` (esta última por `vale_original_id`, no por el id del MOD-).
- Los parámetros de ids son **opcionales**: los reportes (`valeReporteService`, `valeReporteGruposService`) comparten esos métodos y no cambian.
- `Map` en lugar de `find` (talleres por id; filas del taller por `vale_id`, conservando la primera fila).
- El Diseñador no carga tablas completas (resuelve su lista con sus propias consultas).
- Listas `IN ()` vacías nunca llegan a SQL (devuelven vacío).
- Encargado sin taller y sin permiso de fusión: lista vacía con `mensajeVacio: 'No tienes un taller asignado.'` (campo aditivo de la API; el frontend lo muestra en el estado vacío).

### 3.2 Trabajo realizado (`valeBuzonService.js`)
- Todas las ramas de Trabajo terminan en `dentroDeVentana` sin arrastrados, así que cargar solo `fecha_entrega` dentro de la ventana, por ambos lados, es un superconjunto exacto. Se usa el mismo `listarParaBuzon` sin filtro de estado ni de rol.
- Encargados y asistentes: la última propuesta de cada vale se traía con una consulta por fila. Ahora `propuestaRepository.obtenerUltimasPorValesYDisenadores(valeIds)` la trae en una consulta (clave `${vale_id}-${disenador_id}`, `MAX(id)` por par).
- Diseñador: antes traía todo su historial de aprobados y hacía 2 consultas por fila antes de aplicar la ventana. Ahora carga los vales de la ventana (`listarParaBuzon` con los `valeIds` de sus aprobados y las cotas) y las propuestas en lote, respetando el orden original de sus asignaciones.
- Buzón del Diseñador: una consulta con la cota superior en vez de `obtenerPorId` por asignación.

### 3.3 Frontend
- Se quita la pestaña/chip «Todo»; el predeterminado es «Hoy» en Buzón y Trabajo (mismo selector, estado compartido). Limpiar un rango vuelve a «Hoy». El backend sigue aceptando `todo`. Archivos: `index.html`, `state.js`, `layout/toolbar.js`.
- El buscador **quedó como estaba**: en memoria, dentro de la vista, por correlativo + cliente + empresa. Se probó una búsqueda fuera de ventana por correlativo y se revirtió para no hacer consultas grandes (con fragmentos cortos coincidiría con casi todo el historial).
- `views/buzon.js`: contador de carga (`ultimaCarga`) para descartar respuestas viejas, incluida la de «cargar más».
- `socket.js`: los eventos seguidos comparten una recarga (400 ms, el temporizador no se reinicia); con la pestaña oculta la recarga se difiere hasta que vuelve a verse (`visibilitychange`); Reportes **no** se recarga con eventos (tiene su botón «Actualizar» y ahora un texto que lo indica en `views/reportes.js`). El toast y el beep no cambian.

### 3.4 Notificaciones (`src/core/notifications`)
- `registrar` guarda a todos los destinatarios con un solo INSERT multi-fila y una sola relectura (`notificacionRepository.crearParaUsuarios`, devuelve un `Map` usuario → fila con la misma forma que `crear`). Antes eran INSERT + SELECT por destinatario, en serie. La relectura usa `id >= insertId` + usuario + módulo + mensaje, sin asumir ids consecutivos.
- Retención: se borra toda notificación emitida hace más de 30 días, leída o no (`purgarAntiguas`, `DIAS_DE_RETENCION = 30`). Antes: solo leídas con más de 60 días; las no leídas nunca expiraban. Sin cambios de esquema.
- Se evaluó y descartó cachear los destinatarios (cada consulta cuesta ~1 ms, va en segundo plano; el costo mayor son los INSERT por destinatario; riesgo de datos viejos).

## 4. Decisiones que se tomaron en el camino
- El orden por defecto del Buzón (atraso desc, luego fecha de entrega asc) **no** equivale a `fecha_entrega ASC`: el atraso se congela en PENDIENTE_CONFIRMACION. Se mantiene en JS.
- Sin `LIMIT` en SQL: los contadores y el cursor necesitan el conjunto completo de la ventana. La paginación sigue en JS (50, cursor).
- No se llevaron tarjetas, atraso ni pipeline a SQL (duplicaría reglas de negocio).
- No se toca la sala de administradores del WebSocket ni el pool de conexiones (10) ni los índices.

## 5. Resultados

Entorno: MySQL 8.4 en un contenedor aparte, 2.000 vales sintéticos (15% pendientes, 258 multitaller), un usuario por rol, 1.422 casos (rol × vista × ventana × filtros), `obtenerBuzon` llamado directo (sin servidor). Tiempos de la primera página, mediana por caso. Comparación **A/B del mismo momento** (código base contra código nuevo, ambos corriendo uno tras otro).

| Prueba | Casos | Diferencias | Resultado |
|---|---|---|---|
| A/B completo (base `6c7de13` vs rama a `64b82a4`) | 1.422 | 0 | Todo: 72,8 → 19,1 ms (3,8×). Buzón sin «Todo»: 61,7 → 14,5 ms (4,3×). Trabajo sin «Todo»: 82,8 → 29,6 ms (2,8×) |
| Encargados + asistente, Trabajo (`92a586d`) | 309 | 0 | 55,9 → 27,9 ms (2,0×); Diseño 103 → 32; UV/3D 49,6 → 28; Asistente 64 → 33; Protextil 41 → 25; Diseño Local 53 → 23 |
| Diseñador, Trabajo (`a01ed77`) | 51 | 0 | 56,8 → 9,7 ms (5,8×) |
| Diseñador, Buzón (`5fd81c9`) | 57 | 0 | 8,3 → 7,0 ms (1,2×) |
| Notificaciones (script contra la BD de pruebas) | — | — | Una fila por usuario, misma forma de payload, la de 31 días se borra y la de 29 se conserva |

Buzón por rol en el A/B completo (ms, antes → después): Administrador 39,4 → 18,3; Asesor 62,4 → 11,3; Supervisor 88,9 → 20,6; Supervisor sin asesores 65,6 → 4,9; Enc. Diseño 89,3 → 20,1; Enc. UV/3D 39,3 → 13,5; Enc. Protextil 43,0 → 13,2; Enc. Diseño Local 66,5 → 11,8; Asistente 100,0 → 23,4; Diseñador 42,5 → 8,0; Gerente 39,6 → 14,6.

Consulta aislada de propuestas (pool de 10): con 133 filas, una consulta por fila cuesta 27 ms y una sola consulta 2 ms; con 240 filas, 41 ms contra 2,5 ms.

Limitaciones: datos sintéticos, un solo escenario (15% pendientes), una corrida por caso en el A/B completo, MySQL en Docker local. Sirve la proporción, no los milisegundos de producción. Con más pendientes la mejora del Buzón es menor. Cuando se compararon corridas tomadas con una hora de diferencia aparecieron diferencias (hash y orden de empates) que desaparecieron al comparar en el mismo momento: siempre comparar A/B del mismo momento. No se hizo la corrida final completa con todos los cambios juntos ni la prueba visual en navegador.

## 6. Compatibilidad con `dev` (modificación básica): discrepancia confirmada

`dev` agregó la **modificación básica** (`valeModificacionBasicaRepository`, tabla `vale_modificaciones_basicas`), que también se puede pedir con el vale ya RECIBIDO. En `_buzonEncargado`, `dev` añade `conBasica`: recorre `todosConTaller` y muestra siempre, **sin depender de la ventana**, el vale cuya fila de mi taller ya está aprobada pero tiene una conversación `EN_CONVERSACION` abierta con mi taller.

Con el prefiltro de esta rama, `todosConTaller` ya viene acotado: esos vales no tienen fila sin aprobar (están APROBADA), pueden ser RECIBIDO y pueden tener fecha fuera de la cota. **Desaparecerían del Buzón del encargado** y de los asistentes. Git no lo detecta porque el texto mezcla bien.

Ajuste a aplicar en la rama nueva (en `_cargarAbiertosDelBuzon`, rama de encargado/asistentes):
1. Nuevo método en `valeModificacionBasicaRepository`, por ejemplo `listarValeIdsAbiertosDeTaller(tallerId)`: `SELECT DISTINCT m.vale_id FROM vale_modificaciones_basicas m JOIN vale_talleres vt ON vt.id = m.vale_taller_id WHERE m.estado = 'EN_CONVERSACION' AND vt.taller_id = ?` (para el Administrador, sin filtro de taller).
2. Cargar esos vales con una llamada **sin** filtro de estado ni de fecha (`listarParaBuzon({ valeIds })`) y unirlos por `id` al conjunto normal.
3. Verificar que `conBasica` sigue dando el mismo resultado (los vales ya visibles se excluyen por `yaVisibles`).

Sin hallazgos en: `socket.js` de `dev` (solo amplía la lista de tipos de evento de chat; no choca con la recarga agrupada), `views/buzon.js` de `dev` (cambios de render), enriquecimiento de básicas en `_enriquecerConTaller` (usa `vales.map(v => v.id)`, así que queda acotado al conjunto cargado), vistas de Asesor, Supervisor y Trabajo (solo reciben los campos de básicas por el enriquecimiento).

No verificado: el efecto de `MOD2-`/`MOD3-` en el Map de modificaciones en trámite (una clave por original); y que al aceptarse una básica sobre un vale RECIBIDO su estado cambie y el prefiltro lo cargue (por la descripción del commit `441d052` debería, pero no se ejecutó).

## 7. Cómo se rehízo desde `dev` actualizado (hecho; receta original)

1. `git fetch origin && git switch -c perf/buzon-prefiltro-dev origin/dev`.
2. Aplicar el cambio **neto** de código (no los commits intermedios: `33b0aa5` trae una búsqueda por correlativo que `124e7aa` revirtió):
   `git diff 6c7de13 origin/perf/buzon-prefiltro-sql -- src public > prefiltro.patch` y `git apply --3way prefiltro.patch`.
   El merge de texto es limpio, pero revisar `valeBuzonService.js`: `_enriquecerConTaller` de `dev` tiene un bloque nuevo de básicas dentro del que recibe el segundo parámetro.
3. Aplicar el ajuste de la sección 6.
4. Commits sugeridos (Conventional Commits, en español): prefiltro del Buzón; Trabajo acotado y propuestas en lote; sin «Todo» y «Hoy» por defecto; recarga por evento; notificaciones en lote y retención.
5. Verificar con A/B del mismo momento: para medir sobre `dev` hay que cargar en la BD de pruebas los scripts de `database/` de `dev` (incluida la tabla de básicas) y agregar algunas básicas abiertas (también sobre vales RECIBIDO) al generador. Comparar el commit base `origin/dev` contra la rama nueva: listas, orden, contadores y hash de campos tienen que ser idénticos.
6. Antes del merge: prueba visual por rol, en especial el Buzón de encargados y asistentes con una modificación básica abierta, y Reportes (texto de actualización manual).

Las herramientas de medición (`harness.js`, `compare.js`, `generate.js`, `docker-compose.yml`) están en la carpeta temporal de la sesión, fuera del repo. Si se pierden, rehacerlas: llaman a `obtenerBuzon(usuario, filtros)` directo con las variables de entorno apuntando a la BD de pruebas, recorren todas las páginas por cursor y guardan lista, contadores, total, bytes y tiempos; el A/B del código base usa `git worktree add --detach <ruta> <commit>` con `NODE_PATH` apuntando al `node_modules` del repo.

## 8. Cambios de comportamiento visibles
- No existe «Todo»; ambas pestañas abren en «Hoy». El Buzón no muestra vales con entrega posterior al período elegido hasta cambiarlo; Trabajo muestra solo las entregas de hoy.
- Reportes no se actualiza solo (botón «Actualizar» y texto aclaratorio).
- Encargado sin taller: texto «No tienes un taller asignado» en la lista vacía.
- Las notificaciones (leídas o no) se borran a los 30 días de emitidas.
- Campo nuevo en la respuesta del Buzón: `mensajeVacio` (aditivo).

## 9. Resultado en la rama final `perf/buzon-prefiltro-dev`

Commits sobre `dev` (`ab9cef0`): prefiltro SQL por rol y Trabajo acotado (`f0a91a6`), ajuste de las modificaciones básicas del encargado (`6387afc`), sin «Todo» y «Hoy» por defecto (`d7d7dd3`), recarga por evento y Reportes manual (`d72aff4`), notificaciones en lote y retención de 30 días (`fbaebdb`), y los mensajes del chat de una básica ya no recargan la lista (`b59bf76`), más los commits de documentación. El cambio de código aplicó limpio desde la rama de prueba (`git apply --3way`), sin resolver nada a mano.

**Verificación A/B contra `origin/dev` (`ab9cef0`), mismo momento.** La BD de pruebas se llevó al esquema de `dev` (`09_modificaciones_por_tipo.sql`) y se sembraron 20 modificaciones básicas (14 `EN_CONVERSACION`, 4 `RECHAZADA`, 2 `ACEPTADA`) sobre vales pendientes de confirmación y cerrados de este mes, pasados y futuros, en los cuatro tipos de taller. 802 casos (11 roles, Buzón y Trabajo, ventanas hoy, mes y mes anterior): 802 idénticos, 0 diferencias. En el chequeo crítico, los encargados y el asistente ven los mismos vales con básica abierta con ambos códigos, incluidos los recibidos y los de fecha futura.
Mediana de la primera página, antes → después: todos 62,6 → 20,8 ms (3,0×); Buzón del Diseñador 8,1×; Trabajo del Diseñador 25,6×; Buzón del Encargado de Diseño 1,9×; Buzón del Asistente 2,0×. Una sola corrida por caso, datos sintéticos, Docker local.

**Prueba visual del usuario:** se solicitó una modificación básica sobre un vale recibido (GT-MTC-0926-138) como asesor y se vio en el Buzón del taller: correcto.

**Reglas de dominio confirmadas:** un vale multitaller solo combina Diseño, UV/3D y Protextil (el backend rechaza Diseño Local con talleres de Munditrofeos: `valeCreacionService.js`, validación dentro de `if (tiendaIdAsesor !== null)`), y no debe existir un vale cerrado con filas de taller sin aprobar. Corrección de cobertura: el generador de datos sintéticos mezcló Diseño Local en unos 100 de sus 258 vales multitaller, que en producción son imposibles; la cobertura multitaller realista del A/B fue de unos 158 vales (todos idénticos).

**Pendiente para el merge:** que el usuario abra el PR de `perf/buzon-prefiltro-dev` a `dev`; la corrida final completa del A/B (opcional); y, con datos reales, una consulta de solo lectura que cuente vales cerrados con filas de taller sin aprobar (debe dar cero).
