# Reporte de actividad de diseñadores (Reportes): cómo funciona

> **Actualización 2026-11-23 (`correcciones_83.md`):** lo de **«cada diseñador por su propia parte»** quedó **sin efecto**: un vale compartido se entrega, o se atrasa, para todos sus diseñadores a la vez (contadores, gráfica, desglose y PDF; «justos pagan por pecadores»). Se eliminó el estado por parte y el detalle desplegable; el desglose muestra cada vale una sola vez con un badge por diseñador. «Sin entregar» se llama ahora **«Por vencer»**. Donde este documento diga otra cosa, manda `correcciones_83.md`.

Referencia de **un solo reporte** (el #4 del combo). Comparte con los de tiendas y asesores casi todo el mecanismo (flujo «Generar», contadores pulsables, barras pulsables, PDF con filtros): léelos primero (`reporte_actividad_tienda.md`, `reporte_actividad_asesores.md`) y aquí solo se explica lo propio. Registro de cambios: `correcciones_78.md`.

## 1. En una frase

Dado un período y, opcionalmente, un filtro de diseñadores, el reporte muestra **cuántos vales se asignaron a cada diseñador, cuántos entregó y cuántos de esos llegaron tarde**: los cinco contadores de siempre más **Efectividad** y **Entregas a tiempo**, una gráfica agrupada por diseñador con su columna de porcentajes y el desglose de vales agrupado por diseñador.

## 2. Quién lo ve y qué ve

| Aspecto | Regla |
|---|---|
| Permiso | `vales.reporte_actividad_disenador` (se concede por migración solo al Administrador; el resto desde «Roles y Permisos»). |
| Alcance | Por permiso, no por rol: `vales.gestionar_taller` ve solo sus talleres y los diseñadores de esos talleres; `vales.supervisar` ve su zona; cualquier otro con el permiso ve todo. Con ambos permisos se unen los alcances. |
| Filtro | Selección múltiple de diseñadores (sin selección = todos los del alcance). No tiene selector de tienda. |
| Período | El mismo de Reportes (por fecha de entrega). |

## 3. Reglas de negocio (decisiones del dueño)

- **«Entregado» significa que el Encargado del taller ya aprobó la propuesta** (en revisión no cuenta), igual que en el reporte de talleres.
- **Cada diseñador cuenta por SU propia parte del vale** (decisión del dueño, 2026-11-21): un vale compartido por A y B es «entregado» para A cuando todas las filas de A (dentro de su alcance) están aprobadas, aunque B siga pendiente. Es el criterio del rendimiento antiguo. **Asignados** = vales en los que el diseñador tiene una fila.
- **Entrega tarde**: entregado con `diasTarde` mayor que 0. El atraso es uno solo por vale (hasta que la propuesta llegó al asesor), igual para todos sus diseñadores.
- El grupo **«Sin diseñador asignado»** (id 0) es un grupo normal: nunca cuenta como entregado. En la gráfica (pantalla y PDF) lleva solo la barra de asignados, sin la segunda barra ni las columnas E y T, con su nombre alineado a esa barra y el espacio de la segunda barra conservado.
- Solo cuentan los vales autorizados; los atrasados anteriores al período tienen su sección, como en los demás reportes.

## 4. Contadores

Cuatro tarjetas en la primera fila (**Ingresados · Efectividad · Entregas a tiempo · Sin entregar**) y debajo Atrasados (anteriores, actuales) y Entregados (con y sin atraso), sobre **vales únicos** con la definición de vale completo (no la de cada diseñador). **Este reporte no lleva el contador de Urgentes** (el filtro «urgente» no se aplica aquí aunque haya quedado activo en otro reporte). Las dos tarjetas calculadas:

| Tarjeta | Cálculo |
|---|---|
| **Efectividad** | Entregados ÷ ingresados de todo el alcance («entregados sobre todo el taller»). Detalle «N de M vales entregados». |
| **Entregas a tiempo** | (Entregados − con atraso) ÷ entregados. Detalle «N de M entregas». |

- **Todos los porcentajes de los contadores admiten hasta dos decimales** (sin ceros sobrantes: «50 %», «33.33 %»; sin base, «—»). Incluye Urgentes, que antes salía entero, en los tres reportes con contadores. La gráfica de tiendas y asesores conserva sus porcentajes de reparto en enteros (no son contadores).
- Las dos tarjetas nuevas **no son pulsables**; los ocho contadores pulsables de siempre filtran el desglose igual que en tiendas (ver `reporte_actividad_tienda.md`, «Filtrar por contador»).
- Identidad contable a nivel de vales únicos: entregados + atrasados actuales + sin entregar = ingresados.

## 5. La gráfica «Vales asignados y entregados por diseñador»

- **Una fila por diseñador**, de mayor a menor por asignados; **salen todos** (sin «Ver las N restantes»). Dos barras con **una sola escala**:
  - **Asignados** (azul `--color-primary`): vales que se le asignaron.
  - **Entregados**, apilada: la parte **a tiempo** (verde `--color-success`, decisión del dueño) y la parte **tarde en rojo** (`--color-danger`) con el número de entregas tarde dentro (también cuando es 1). Verde y rojo se parecen para quien tiene daltonismo: por eso el rojo lleva siempre su número dentro.
- **Dos columnas a la derecha**, con una letra en el encabezado y una leyenda bajo el título: **E = Efectividad** (entregados ÷ asignados del diseñador) y **T = Entregas tardías** (entregas tarde ÷ entregados del diseñador). El contador general habla de «a tiempo» y la columna de «tardías», como se pidió.
- **Se presiona como la de asesores** (se vuelve a presionar para quitarlo; clic fuera de las barras también lo quita): el **nombre** o la barra **Asignados** enfocan todos los vales del diseñador (modo `todos`); la parte **a tiempo** de Entregados, solo los entregados (`entregados`); la parte **roja**, solo las entregas tarde (`tarde`). Los contadores pasan a los del diseñador en ese modo y el desglose se filtra; después se puede aplicar un contador encima (intersección).

## 6. El PDF

- Franja de contadores de **dos filas** (72 pt, como tiendas y asesores; la primera con las cuatro tarjetas y sin Urgentes), gráfica agrupada con la columna E/T y la leyenda, y el desglose. Salen **todos** los diseñadores (sin «Otros»); si no caben en la página, las filas siguen en la siguiente. Nota al pie: «Un vale compartido cuenta para cada diseñador por su parte; la suma de los diseñadores puede superar los totales.»
- Colores del PDF: asignados `#2563EB`, a tiempo `#16A34A`, tarde `#DC2626`. Los porcentajes nulos salen como «-» (el PDF no admite la raya larga).
- Con una barra enfocada y/o contadores el modal ofrece las tres opciones de siempre (con los filtros aplicados / todo el desglose / sin desglose). Los contadores y la gráfica del PDF son siempre los de la consulta general.

## 7. API

`GET /api/vales/reportes/actividad-disenador` (y `/pdf`, `/opciones`), permiso `vales.reporte_actividad_disenador`.

| Parámetro | Rutas | Significado |
|---|---|---|
| `ventana`, `fecha`, `desde`, `hasta` | ambas | Período. |
| `disenadorIds` | ambas | Lista de diseñadores. Fuera del alcance: 400. |
| `desglose=0` | PDF | Imprime sin el desglose. |
| `disenadorDesglose=<id>` | PDF | Imprime el desglose de ese diseñador (el enfocado). Acepta `0` («Sin diseñador asignado»). Un id que no está en el reporte: 400. |
| `disenadorModo=entregados\|tarde` | PDF | Con `disenadorDesglose`: solo sus entregados / solo sus entregas tarde. Otro valor: 400. |
| `desgloseEstado`, `desgloseUrgentes=1` | PDF | Los filtros de contador (ver `reporte_actividad_tienda.md`); se aplican después del enfoque. |

`contadores` del JSON añade a lo habitual (`ingresados`, `urgentes{total,porcentaje}`, `sinEntregar`, `atrasados`, `recibidos`):

```text
efectividad, aTiempo           // porcentajes con hasta 2 decimales, null sin base
porDisenador: [{ id, nombre, asignados, entregados, tarde, efectividad, tardias }]   // alimenta la gráfica y la columna E/T
porGrupo: { "<id>": { todos, urgentes, entregados, tarde } }   // contadores por diseñador y modo de enfoque
```

## 8. Mapa de archivos

**Backend** (`src/modules/vales/`)

| Archivo | Responsabilidad |
|---|---|
| `services/valeReporteDisenadores.js` (puro) | Semántica «por su parte»: `parteEntregada`, `abiertoDeParte`, `fichaPorParte`, `seccionDeEntrega` (precedencia única de secciones), `resumenPorDisenador`, `contadoresUnicos`. |
| `services/valeReporteContadores.js` (puro) | `porcentajeDe` y `porcentajeONulo` (2 decimales), variantes de `porGrupo` (`entregados`, `tarde`), `formatearPorcentaje`/`conSimboloPorcentaje` para el PDF. |
| `services/valeReporteGruposService.js` | `armar`: ficha por parte del diseñador, contadores de diseñadores, `completarContadores` (vales únicos). |
| `services/valeReporteEquiposService.js` | Pide `contadores` para diseñadores y arma el PDF enfocado (`soloGrupoDesglose`, modo, filtros). |
| `services/valeReporteFiltroDesglose.js` (puro) | `soloGrupoDesglose`, `ESTADO_DE_MODO`, `filtrarDesglose`, `aplicarFiltroPdf`. |
| `services/valeReportePdfService.js` | Franja de tres filas y `_graficaDisenadores`. |
| `controllers/valeController.js`, `utils/reporteErrores.js` | Parámetros `disenadorDesglose`, `disenadorModo` y su registro en el log. |

**Frontend** (`public/modules/vales/js/`)

| Archivo | Responsabilidad |
|---|---|
| `views/reportes2/graficaDisenadores.js` | La gráfica agrupada y su interacción. |
| `views/reportes2/contadoresActividad.js` | Las dos tarjetas nuevas. |
| `views/reportes2/enfoque.js` | `enfocarPayload` con los modos, `ESTADO_DE_MODO`. |
| `views/reportes2/actividadEquipos.js`, `actividadReporte.js` | Configuración del reporte y selección de la gráfica. |
| `views/reportes2/paramsPdf.js`, `modalDesglosePdf.js` | Parámetros del PDF y modal. |
| `utils/formatoPorcentaje.js` | Formato de porcentajes con hasta 2 decimales. |

## 9. Decisiones y por qué

- **Cada diseñador por su parte** (decisión del dueño): evalúa justamente la efectividad individual; con «hasta que terminen todos» un diseñador quedaría como «no entregado» por culpa de otro.
- **Contadores del taller sobre vales únicos**: un vale compartido no cuenta dos veces en los totales; por eso la suma de los diseñadores puede superar los totales.
- **Efectividad = entregados ÷ ingresados** (decisión mía, por confirmar): incluye los vales del período cuya entrega aún no llega. El rendimiento antiguo excluía los no vencidos y usaba un decimal.
- **Verde** para «entregados a tiempo» (decisión del dueño, 2026-11-21; antes era azul oscuro): verde y rojo se parecen con daltonismo, por eso el rojo lleva su número dentro.
- **El PDF de un diseñador enfocado no hace una segunda consulta**: filtra el reporte ya armado (`soloGrupoDesglose`); así también funciona con el id 0.

## 10. Varias reglas están duplicadas: pruebas que las cruzan

| Regla | Dónde vive | Prueba |
|---|---|---|
| Filtro por contador | `filtroContadores.js` ↔ `valeReporteFiltroDesglose.js` | `scripts/reportes/probarFiltroDesglose.mjs` |
| Enfoque de un grupo del desglose | `enfoque.js` (`enfocarPayload`) ↔ `soloGrupoDesglose` | `probarFiltroDesglose.mjs` y `probarEnfoqueDisenador.mjs` |
| Modo de barra → estado de filtro | `ESTADO_DE_MODO` en `enfoque.js` ↔ en `valeReporteFiltroDesglose.js` | `probarEnfoqueDisenador.mjs` |
| Formato de porcentajes | `formatoPorcentaje.js` ↔ `valeReporteContadores.js` | `probarEnfoqueDisenador.mjs` |

Otras pruebas de piezas puras: `probarContadoresDisenador.mjs` (semántica por parte y contadores), `probarGraficaDisenadores.mjs` (marcado de la gráfica y las tarjetas) y `probarPdfDisenadores.mjs` (textos, colores y márgenes del PDF, decodificando el contenido). Todas se corren con `node scripts/reportes/<nombre>.mjs`, sin base de datos ni servidor; salen con código distinto de 0 si algo falla.

## 11. Casos límite y límites conocidos

- Un diseñador elegido sin vales aparece con ceros y porcentajes «—».
- Un vale compartido figura en el desglose de cada diseñador (en la sección que le toca a cada uno): la suma de las secciones puede superar el total de vales únicos.
- Con más de 5000 vales el desglose se omite (aviso), pero los contadores y la gráfica siguen exactos.
- **Nada de esto se probó en el navegador ni con datos reales:** el cableado de `armar`, del servicio y del controlador necesita la base de datos y solo se revisó por lectura; la pantalla y el PDF solo se verificaron con datos de prueba y de forma estructural (el PDF no se vio dibujado).

## 12. Cómo comprobarlo (mínimo)

1. Abrir «4. Reporte de actividad de diseñadores» con un período con vales: deben verse siete tarjetas (las dos últimas, Efectividad y Entregas a tiempo), la gráfica agrupada con las columnas E y T y su leyenda.
2. Presionar el nombre, la barra azul, la parte verde y la roja de un diseñador: cambian los contadores y el desglose; volver a presionar lo quita.
3. Con un vale compartido entre dos diseñadores donde solo uno terminó, comprobar que cuenta como entregado solo para ese.
4. Descargar el PDF con y sin una barra enfocada y con un contador filtrado (modal de tres opciones).

## Desglose de vales (2026-11-23)

Una fila por vale, en la sección del **vale completo** (si un diseñador terminó y el otro no, es atrasado o por vencer), con un badge por diseñador y un botón que despliega el estado individual de cada uno. Con un diseñador enfocado, las filas siguen su parte. Detalle y código en `correcciones_82.md`.
