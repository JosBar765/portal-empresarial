# Paginación, jerarquía y filtros a escala — análisis y propuestas

Este documento responde al punto 8 de `analisis_correcciones_8.md`. Es
**solo análisis y propuestas — nada de esto está implementado todavía**. La
idea es elegir una de estas soluciones (o una combinación) en un
`analisis_correcciones_9.md` futuro.

---

## 1. Cómo funciona HOY exactamente (con referencias de código)

Antes de proponer nada hay que ser precisos sobre qué es un bug real y qué
ya funciona correctamente, porque el comportamiento actual mezcla ambas
cosas.

### 1.1 El pipeline server-side (`valeService.obtenerBuzon`)

Cada request a `GET /api/vales` hace, en este orden:

1. `valeRepository.listarTodos()` — trae **todos** los vales de la tabla
   (`SELECT * FROM vales`, sin `WHERE` ni `LIMIT`), sin importar cuántos
   pida el frontend.
2. Se enriquece cada uno con `atrasado`/`diasAtraso` (`enriquecer`,
   calculado en Node, no en SQL).
3. Según el rol, un método `_buzonX` filtra por ventana de tiempo, calcula
   **las tarjetas de contador sobre ese conjunto filtrado completo** y
   aplica `filtroContador`/`soloAtrasados` — también sobre el conjunto
   completo, no sobre una página.
4. `ordenarPorGrupos`/`ordenarPorFecha` ordena esa lista **completa**
   (jerarquía de estados + atraso, ver corrección #8.3 más arriba).
5. Recién en `obtenerBuzon`, DESPUÉS de todo lo anterior, se aplica
   `busqueda` (texto) sobre la lista completa ya ordenada, y solo al final
   se hace `.slice(offset, offset + limit)` para devolver una página de 50.

**Esto ya es correcto para lo que el punto 8 pregunta sobre atrasados y
contadores**: como el orden y los contadores se calculan sobre el conjunto
COMPLETO antes de recortar la página, un vale que está muy atrasado pero
"vive" en la fila 800 de la tabla ya aparece bien posicionado (según la
jerarquía de su grupo) desde la página 1 — no hace falta que el usuario
haga scroll para que "suba"; nunca estuvo mal ubicado. Y las tarjetas de
contador (`Atrasados`, `Pend. confirmación`, etc.) siempre reflejan el total
real de la base de datos, no solo lo que el navegador ya cargó.

### 1.2 Lo que SÍ es un bug real: dos filtros que quedaron client-side

En `public/modules/vales/js/app.js`, `renderTabla()`:

```js
// El texto ya viene filtrado del servidor (state.busqueda, ver cargarBuzon/
// construirQueryBase — analisis_correcciones_5.md #12); acá solo queda el
// filtro de estado, que sí es puramente de la página ya cargada.
const estadoFiltro = $('#filtro-estado').value;
let filas = state.vales.filter(v => !estadoFiltro || estadoActivo(v) === estadoFiltro);
filas = aplicarOrdenPersonalizado(filas);
```

Dos cosas corren **solo sobre `state.vales`** (lo que el navegador ya
descargó), no contra el servidor:

- El desplegable **"Todos los estados"** (`#filtro-estado`). Sus propias
  opciones también se arman solo con lo ya cargado (`poblarFiltroEstado`:
  `[...new Set(state.vales.map(v => estadoActivo(v)))]`) — un estado que
  solo existe en vales que todavía no se han descargado ni siquiera
  aparece como opción seleccionable.
- El **ordenamiento por columna** (clic en el encabezado de Correlativo /
  Fecha Ingreso / Fecha Entrega / Fecha Evento — `aplicarOrdenPersonalizado`).

Esto SÍ es el escenario exacto que describe el punto 8: si hay 1000 vales,
se cargan los primeros 50 (página 1), y el usuario filtra por un estado que
solo tienen vales de la página 3 en adelante, la tabla se queda vacía (o
casi) y el scroll infinito (`wireScrollInfinito`, dispara con
`window.addEventListener('scroll', ...)` cuando el usuario se acerca al
final del documento) **puede no volver a dispararse nunca**, porque una
tabla filtrada a pocas filas no genera suficiente alto de página como para
que el usuario necesite/pueda hacer scroll. El resultado: esos vales nunca
se cargan, y el usuario ve "no hay resultados" cuando en realidad sí los
hay, más adelante en la base de datos.

### 1.3 Riesgo real de fondo: reordenar sobre un dataset que cambia entre páginas

Aunque el punto 1.1 es correcto en un instante dado, cada página
(`offset`/`limit`) es una consulta **independiente** que vuelve a ejecutar
TODO el pipeline (`listarTodos` + enriquecer + filtrar + ordenar) con la
hora actual y el estado actual de la base de datos en ESE momento. El
"atraso" es relativo a `new Date()` (para vales no congelados, ver
corrección #8.7) y el estado de cualquier vale puede cambiar entre el
request de la página 1 y el de la página 2 (otro usuario aprueba algo, pasa
la medianoche, etc.). Como no existe un cursor/snapshot estable, dos
páginas consecutivas de `offset`/`limit` pueden, en teoría, repetir un vale
que "saltó de posición" entre ambos requests, u omitir uno que se movió
justo al límite entre página 1 y página 2. A la escala actual (decenas de
vales, ventana de minutos entre páginas) es un riesgo casi teórico, pero
crece con el volumen y con el tiempo que tarda un usuario en hacer scroll
hasta el final.

### 1.4 Escalabilidad de cargar la tabla completa en cada request

`listarTodos()` no tiene límite — a mayor cantidad total de vales en el
sistema (sin importar cuántos matchean el filtro actual), más fila trae
MySQL, más objetos enriquece/ordena Node, en **cada** request (cada scroll,
cada clic en un contador, cada tecla del buscador tras el debounce). Con
los volúmenes actuales (decenas de vales de semilla) esto es instantáneo;
en algún punto de crecimiento (miles de vales activos) empezará a notarse
en latencia y memoria, aunque el resultado siga siendo correcto.

---

## 2. Respuestas directas a las preguntas del punto 8

> "¿Qué va a pasar con la jerarquía de agrupación y el ordenamiento... si
> no hay ningún vale atrasado en los primeros 50 pero sí en los siguientes
> 50 con scroll? ¿Se mueven al principio?"

No necesitan moverse: el orden ya se calcula sobre el conjunto completo
ANTES de recortar la página (§1.1), así que un vale atrasado que "vive" más
allá de la posición 50 en la tabla cruda ya aparece bien ubicado (según su
grupo de jerarquía) desde la página 1, si su jerarquía/atraso lo ubican
ahí. Lo que sí puede pasar, y es una limitación real (§1.3), es que dos
páginas consecutivas se calculen en instantes de tiempo ligeramente
distintos si la base de datos cambió entre medio.

> "Los filtros se aplican solo a la tabla, ¿cierto? ¿Qué pasa si hay más
> atrasados en la DB pero el filtro solo se aplica a la tabla?"

Depende de CUÁL filtro: `filtroContador`, `soloAtrasados` (Atrasados) y la
búsqueda de texto **sí son server-side**, contra la base de datos completa
(§1.1) — ahí la pregunta ya está resuelta, no hay inconsistencia. El
desplegable de estado y el clic en encabezados de columna, en cambio, **sí
son client-side** y **sí tienen exactamente el problema que describís**
(§1.2) — esto es un bug real a corregir, no una limitación aceptable de
diseño.

---

## 3. Opciones de solución (de menor a mayor esfuerzo)

### Opción A — Arreglo quirúrgico: mover los dos filtros que faltan al servidor

Convertir `#filtro-estado` y el clic en encabezados de columna al MISMO
patrón que ya usan `filtroContador`/`busqueda`/`soloAtrasados`
(`construirQueryBase()` + `cargarBuzon()`, es decir, refrescar contra el
servidor en cada cambio en vez de filtrar/ordenar `state.vales` en el
navegador).

- **Resuelve** exactamente el bug de §1.2 (el caso concreto que describe el
  punto 8) sin tocar la arquitectura de fondo.
- **No resuelve** §1.3 (estabilidad entre páginas) ni §1.4 (escala) — sigue
  cargando la tabla completa en cada request, solo que ahora TODOS los
  filtros son consistentes entre sí.
- Costo: bajo. Es el candidato natural para el arreglo #9 si la prioridad
  es cerrar el bug concreto ya.

### Opción B — Cursor estable en vez de `offset`/`limit`

Mantener el resto del pipeline igual (orden calculado en Node sobre el
conjunto completo), pero en vez de pedir "la página N" por número,
pedir "lo que sigue después de este cursor" — por ejemplo, el `id` (o una
combinación orden+id) del último vale ya mostrado. El backend recorre el
array ya ordenado hasta encontrar ese cursor y devuelve los siguientes 50 a
partir de ahí, en vez de recalcular un `offset` numérico contra un dataset
que pudo haber cambiado.

- **Resuelve** §1.3 de forma barata (los vales no "saltan" de página aunque
  el resto de la tabla cambie entre requests).
- No resuelve §1.4 — el pipeline sigue cargando y ordenando todo en Node en
  cada request, el cursor solo cambia CÓMO se recorta la página resultante.
- Costo: bajo-medio. Compatible con la Opción A (de hecho, conviene
  aplicarlas juntas).

### Opción C — Mover filtro + orden + paginación a SQL

Reescribir cada `_buzonX` para que el `WHERE`/`ORDER BY`/`LIMIT ... OFFSET`
corran en la base de datos en vez de en Node — el "atraso" pasaría a ser una
expresión SQL (`fecha_entrega < NOW() AND estado NOT IN (...)`) y la
jerarquía de grupos, un `ORDER BY CASE estado WHEN ... THEN 1 ... END,
fecha_entrega`.

- Es la única opción que de verdad resuelve §1.4 a gran escala: la base de
  datos solo devuelve las filas que realmente hacen falta, con índices
  (`idx_vales_estado`, `idx_vales_fecha_entrega`, ya existen en el schema)
  haciendo el trabajo pesado.
- Costo: alto. Cada `_buzonX` tiene lógica de negocio específica por rol
  (estados lógicos del asesor, scoping por taller del encargado, la
  columna derivada `estado_taller`, etc.) que hoy vive en JS y habría que
  traducir a SQL con cuidado de no romper ningún caso — y el mock de
  `src/config/database.js` (usado en este entorno sin MySQL) necesitaría
  una reimplementación en paralelo del mismo `WHERE`/`ORDER BY`/`LIMIT`
  para no divergir del comportamiento real. Es una reescritura de fondo,
  no un parche.
- Debería combinarse con la Opción B (cursor) para paginación profunda
  eficiente, en vez de `OFFSET` puro (que en SQL también se vuelve lento a
  medida que el offset crece).

### Opción D — Columna de "prioridad" precalculada (para volúmenes muy grandes)

Si algún día el volumen de vales activos crece mucho (varios miles), incluso
el `ORDER BY` de la Opción C puede no alcanzar por lo compleja que es la
jerarquía de negocio. La opción de fondo sería mantener una columna
numérica en `vales` (ej. `prioridad_orden`) recalculada cada vez que cambia
el estado o la fecha relevante del vale (en los mismos puntos donde hoy se
llama `registrarHistorial`/`actualizarEstado`), de forma que el `ORDER BY`
sea un simple `ORDER BY prioridad_orden` con índice. El atraso en sí seguiría
siendo dinámico (cambia con el paso del tiempo sin que nadie toque el vale),
así que necesitaría además un job/cron liviano que recalcule esa columna
para los vales activos al menos una vez al día.

- Es la opción más escalable de todas, pero también la más compleja e
  intrusiva — añade un mecanismo de sincronización nuevo (columna derivada +
  recálculo) que hay que mantener consistente para siempre.
- No se recomienda a menos que el volumen real lo justifique.

---

## 4. Recomendación

Dado el volumen actual del negocio (una operación regional con un puñado de
asesores y talleres, no "big data") y que el punto 8 pide explícitamente
plantear opciones sin aplicarlas todavía, la recomendación para
`analisis_correcciones_9.md` es:

1. **Aplicar la Opción A** (cerrar el bug real de `#filtro-estado` y el
   orden por columna) — es el único punto de este análisis que es un bug
   de verdad, no una limitación de escala aceptada.
2. **Aplicar la Opción B** (cursor) junto con la A, porque es barata y
   elimina de raíz el riesgo teórico de §1.3 sin tocar el resto del
   pipeline.
3. Dejar la Opción C (SQL) en espera hasta que haya una señal real de que
   hace falta — por ejemplo, medir cuánto tarda `GET /api/vales` en
   producción (o revisar `SELECT COUNT(*) FROM vales`) y solo emprender la
   reescritura si la latencia empieza a notarse o el conteo total supera
   algo del orden de unos pocos miles de filas.
4. La Opción D queda fuera de alcance salvo que el negocio crezca a un
   volumen mucho mayor al actual.
