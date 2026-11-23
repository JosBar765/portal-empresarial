# Reporte de actividad de tiendas (Reportes 2): cómo funciona

> **Actualización 2026-11-23 (`correcciones_83.md`):** la tarjeta y la sección **«Sin entregar»** se llaman ahora **«Por vencer»** (misma definición), y el PDF imprime **todas** las barras de la gráfica por tienda (ya no «las 10 mayores y una fila Otras»).

Documento de referencia de **un solo reporte**, de punta a punta: qué muestra, con qué reglas, cómo se interactúa en pantalla, cómo sale en el PDF y dónde está cada pieza. Su hermano, el reporte de actividad de asesores, está en `reporte_actividad_asesores.md`. Complementa a `reportes_2_guia.md` (la guía general de Reportes 2 y de cómo retomar el trabajo), a `flujo_vale_de_arte.md` §11.1 (reglas de negocio) y a `correcciones_62.md` … `correcciones_66.md` (el detalle de cada cambio).

## 1. En una frase

Dado un período y un filtro de tiendas, el reporte resume **cuántos vales ingresó cada tienda y en qué estado están** (contadores y gráfica) y lista **los vales de cada sección** (el desglose), en pantalla y en PDF.

## 2. Quién lo ve y qué ve

| Aspecto | Regla |
|---|---|
| Permiso | `vales.reporte_actividad_tienda` (se concede por migración solo al Administrador; el resto se asigna desde «Roles y Permisos»). La pestaña «Reportes» la abre `vales.ver_reportes`, que solo abre la pestaña. |
| Alcance | Quien tiene `vales.supervisar` ve solo las tiendas a su cargo y el selector dice «Todas mis tiendas»; cualquier otro con el permiso ve todas. El alcance es por **permiso**, no por nombre de rol. |
| Filtro | Un solo selector de tienda en **modo múltiple** (casillas: una o varias tiendas, o un país o grupo entero con la casilla del padre; menú de `public/js/menuCascada.js`). Entrega ids sueltos («3,7,9»; vacío = todas) y viaja como `tiendaId` (una) o `tiendaIds` (varias). Una tienda fuera de las visibles responde 400. Cambiar una casilla solo marca el resultado como desactualizado (no consulta). Los filtros guardados en el navegador antes del selector múltiple («pais:X», «grupo:Y») se convierten a la lista de sus tiendas al cargar y los ids que ya no existen se descartan (`views/reportes2/valorTiendas.js`). |
| Período | Hoy, Día, Semana, Mes o Desde–Hasta. El período filtra por la **fecha de entrega** del vale. |
| Cuándo se consulta | Solo al presionar **«Generar»** (antes «Actualizar»). Elegir el reporte muestra el selector de tienda (opciones de `/opciones`); cambiar tienda o período después de generar solo marca el resultado como viejo. |

## 3. Reglas de negocio

- Solo cuentan los vales **autorizados** (`vales.autorizado_en` no nulo). Los que esperan autorización nunca entran.
- **Entregado** significa que el vale ya llegó al asesor (la propuesta quedó lista para confirmar o ya confirmada).
- Un vale cae en **una sola sección**, con esta precedencia: atrasado abierto > entregado > sin entregar.
- Única excepción al filtro por fecha de entrega: los **atrasados anteriores al período** (vales abiertos y vencidos con entrega antes de la ventana).
- Los textos usan nombres completos de estados, nunca siglas.

### Nombres vigentes

| Antes | Ahora |
|---|---|
| Reporte de actividad de tienda (combo, título y PDF) | **Reporte de actividad de tiendas** |
| Recibidos (contador) | **Entregados** |
| Fueron urgentes (contador) | **Urgentes** |
| No entregados (sección) | **Sin entregar** |
| Atrasados antes del período | **Atrasados (anteriores al período)** |
| Atrasados en el período | **Atrasados (período actual)** |
| Vales por tienda (contenedor) | **Desglose de Vales de Arte** |

(La pestaña «Reportes» y el reporte «Actividad» antiguos conservaban sus nombres; ya no existen.) En la respuesta del servidor el contador Entregados se sigue llamando `recibidos`.

## 4. La pantalla

Primero el selector de tienda (aparece al elegir el reporte, antes de generar) y el período; con «Generar» se pintan, de arriba abajo: cabecera → **contadores** → **gráfica por tienda** → **Desglose de Vales de Arte** → «Cómo funciona este reporte».

### 4.1 Contadores (cinco tarjetas, dos filas)

| Tarjeta | Qué cuenta |
|---|---|
| **Ingresados** | Vales autorizados con entrega en el período, tras filtros y alcance. No se recortan por el tope de 5000 vales de las listas. |
| **Urgentes** | Porcentaje de los ingresados con la marca `urgente`; detalle «N de M vales» (0 % si no hay). |
| **Sin entregar** | Vales del período abiertos y dentro del plazo. |
| **Atrasados** | Total con dos categorías: **Anteriores** (entrega antes del período; la sección «anteriores») y **Actuales** (atrasados del período). |
| **Entregados** | Total con dos categorías: **Con atraso** (`diasTarde` mayor que 0, el mismo cálculo de la sección Entregados) y **Sin atraso** (todos los demás: el mismo día, antes, o sin fecha de llegada registrada). |

Identidad contable: **Entregados + Atrasados actuales + Sin entregar = Ingresados**. Los atrasados **anteriores no suman** en Ingresados porque su entrega es anterior al período.

Cada categoría lleva punto y rótulo, no solo color. Las tarjetas con categorías (Atrasados y Entregados) deciden su diseño por **su propio ancho** (consulta de contenedor): si no caben el total y las categorías lado a lado (~360 px), el total pasa a una línea («Atrasados 12») y las categorías bajan en dos columnas.

### Filtrar por contador

Presionar un contador **filtra el desglose** (lo que se lista); presionarlo de nuevo quita el filtro. Es local: no consulta nada (se filtra lo ya generado, como la barra enfocada) y no cambia los números de las tarjetas, que describen todo el conjunto o la barra enfocada. Ingresados no es pulsable. Los contadores dejan de ser pulsables si el desglose está omitido (más de 5000 vales).

| Se presiona | Se muestran |
|---|---|
| **Urgentes** | solo vales urgentes del período (no los «atrasados anteriores», que quedan fuera de «Ingresados») |
| **Sin entregar** | la sección Sin entregar |
| **Atrasados** (total) | los atrasados anteriores y los del período actual |
| Atrasados · **Anteriores** / **Actuales** | solo «Atrasados (anteriores al período)» / solo «Atrasados (período actual)» |
| **Entregados** (total) | la sección Entregados |
| Entregados · **Con atraso** / **Sin atraso** | los entregados con `diasTarde` mayor que 0 / los demás |

- **Un filtro de estado a la vez** (pulsar otro cambia); **Urgentes** es aparte y se **combina** con el de estado (intersección: por ejemplo Atrasados + Urgentes).
- Se combina con la barra enfocada: primero la barra, luego el contador. Los filtros activos se ven como fichas con × sobre el desglose, con «Quitar filtros»; si no queda ningún vale, aparece «Ningún vale cumple el filtro elegido.».
- Se limpia al elegir otro reporte; sobrevive a repintar y a regenerar el mismo reporte. No se guarda en el navegador.
- Código: `views/reportes2/filtroContadores.js` (puro, `aplicarFiltroContador`) y `contadoresActividad.js` (botones con `aria-pressed`).

### 4.2 Gráfica «Vales ingresados por tienda»

- **Qué es:** barras horizontales de mayor a menor, una por tienda, con el porcentaje en la **punta** de la barra y la cantidad en la columna de la derecha. La tienda que más vales metió va en azul y las demás en gris. Los nombres van completos, alineados a la derecha, y la columna mide lo que el nombre más largo.
- **Cuándo aparece:** cuando el filtro abarca **más de una tienda** («Todas», todas las de un país o todas las de un grupo) y al menos una tiene vales. Con una sola tienda en el filtro no aparece (el servidor manda `porTienda` en `null`).
- **Por qué barras y no un pie:** el seed trae 27 tiendas y un pie con tantas porciones no se lee; las barras comparan mejor. El dueño aceptó la recomendación.
- **Diez visibles:** el resto se despliega con «Ver las N restantes». El estado desplegado se recuerda entre cargas.
- **Cuenta todo:** los vales por tienda salen de todos los ingresados, sin el tope de 1000.

### 4.3 Barra enfocada (interacción)

Presionar fuera de las barras (título, bordes de la gráfica) también quita el enfoque. Presionar una barra (o su nombre o su cifra) **enfoca los contadores y el desglose en esa tienda**; la barra lleva un borde. Presionarla de nuevo quita el enfoque.

- El selector de tienda, la gráfica y el PDF **no cambian**.
- **El enfoque es local y no hace ninguna consulta:** `views/reportes2/enfoque.js` (`enfocarPayload`) filtra el resultado ya generado; los contadores de la tienda salen de `contadores.porGrupo["<id>"]` y se filtran las secciones y los atrasados anteriores. Enfocar no cambia la marca de «resultado viejo» ni la hora de «Generado».
- Con más de 5000 vales en el período no hay desglose que filtrar: la pantalla muestra el aviso «Demasiados vales para listarlos» y el enfoque solo cambia los contadores (que siguen exactos). El PDF de la tienda enfocada sí imprime su desglose.
- El enfoque se descarta solo si eliges otra tienda en el selector, o si la tienda enfocada deja de estar en la gráfica (cambió el período o el filtro).
- La barra es un botón (`aria-pressed`) y se puede usar con el teclado.
- Estado: `state.reporte2.tiendaElegida` (id) y `tiendaElegidaNombre`.

### 4.3.1 Nombre pulsable: ir al reporte de asesores

Presionar el **nombre** de una tienda (no la barra) abre un modal «¿Quieres ir al reporte de actividad de asesores de <tienda>?». **Sí** abre el reporte de asesores con esa tienda elegida, sin asesores elegidos y con el mismo período (`irAReporte` del shell, `grafica.irAAsesores` de `actividadTienda.js`); **No** o cerrar el modal no cambia nada. El nombre es un botón con subrayado al pasar el cursor, y solo lo es si la persona tiene el permiso del reporte de asesores. Detalle del destino: `reporte_actividad_asesores.md`.

### 4.4 Desglose de Vales de Arte

Un panel con **cuatro secciones plegables**, cada una con su contador: Atrasados (anteriores al período), Atrasados (período actual), Sin entregar y Entregados (esta última plegada por defecto). Las secciones sin vales se omiten. Cada sección es una tabla de vales agrupada por tienda. «Atrasados (anteriores al período)» es la primera y comparte tabla y pliegue con las demás (su clave propia es `atrasadosAnteriores`). Si el período no tiene vales pero hay atrasados anteriores, se muestra esa sección y debajo el aviso de «sin vales en este período».

## 5. El PDF

Botón «Descargar PDF» de la pestaña; queda **deshabilitado** hasta generar y mientras el resultado esté viejo (hay que volver a presionar «Generar»). Al ser el reporte de tienda, primero abre un **modal**: «¿Quieres incluir el desglose de Vales de Arte en el reporte?».

| Respuesta | Qué se imprime |
|---|---|
| **Sí, incluir el desglose** | Todo: cabecera, contadores, gráfica y desglose. |
| **No, sin desglose** | Cabecera, contadores y gráfica (sin las secciones de vales). |
| Cerrar el modal (X, Escape, clic fuera o «atrás» del celular) | Se cancela: no se descarga nada. |

Con una **barra enfocada** en la gráfica, el PDF sí consulta al servidor (`tiendaDesglose`); el modal avisa qué tienda es y «Sí» imprime el desglose **de esa tienda**, bajo el título «DESGLOSE DE VALES DE ARTE: <TIENDA>»; los contadores y la gráfica del PDF siguen siendo los del filtro.

### PDF con filtros de la vista

Si hay algún **filtro de la vista** activo (barra enfocada, contador o ambos), «Descargar PDF» ofrece tres opciones, cada una con su número de vales y el aviso de más de 100 filas: **Con los filtros aplicados** (el desglose del grupo enfocado y del contador), **Todo el desglose** (ignora la barra y los contadores) o **Sin desglose**; cerrar el modal cancela. Sin filtros activos el modal es el de siempre (Sí / No). Los contadores y la gráfica del PDF siguen siendo los de la consulta general. Si el desglose completo está omitido (más de 5000 vales) no se ofrece «Todo el desglose».
- Parámetros solo del PDF: `desgloseEstado` (uno de `sinEntregar`, `atrasados`, `atrasadosAnteriores`, `atrasadosActuales`, `entregados`, `entregadosConAtraso`, `entregadosSinAtraso`; otro valor responde 400) y `desgloseUrgentes=1`, además de `desglose=0`, `tiendaDesglose`/`asesorDesglose` y `soloUrgentes=1`.
- El servidor aplica la misma regla en `valeReporteFiltroDesglose.js` (`filtrarDesglose`, `aplicarFiltroPdf`); el encabezado del PDF lleva la línea «Desglose filtrado: …» y, si ningún vale cumple, la nota «Ningún vale cumple el filtro del desglose.». **Las dos implementaciones (frontend y servidor) deben mantenerse iguales**: las compara `node scripts/reportes/probarFiltroDesglose.mjs` sobre los mismos datos (correrla antes y después de tocar cualquiera de las dos).
- Código del modal: `views/reportes2/modalDesglosePdf.js` y `paramsPdf.js` (puro).

### Estructura de la página 1

1. **Encabezado:** logo, título, período, quién y cuándo lo generó, y la línea de filtros («Tiendas: Todas las tiendas») **en negrita** (solo en los reportes de Reportes 2; antes iba resaltada en amarillo).
2. **Franja de contadores** de dos filas (~9 % de la página): Ingresados · Urgentes · Sin entregar / Atrasados (Anteriores, Actuales) · Entregados (Con atraso, Sin atraso).
3. **Gráfica «Vales ingresados por tienda»:** las 10 mayores y una fila «Otras (N tiendas)» con su suma, **sin barra** (sumar varias tiendas no es comparable con una sola). Porcentaje en la punta de cada barra y cantidad a la derecha. Se omite si la respuesta no trae `porTienda`.
4. **Línea gris divisoria** (solo si el desglose se incluye y no arranca en una página nueva).
5. **Desglose:** Atrasados (anteriores al período), Atrasados (período actual), Sin entregar y Entregados, con los mismos títulos que la pantalla, en mayúsculas.
6. **Firmas** al final de la última página y el pie «Vales de Arte · Página N de M».

## 6. API

Tres rutas, protegidas con `requirePermission('vales.reporte_actividad_tienda')`:

- `GET /api/vales/reportes/actividad-tienda/opciones` (JSON `{ alcance, filtros }` con las tiendas visibles; no recorre vales; limitador de 120 por minuto por usuario)
- `GET /api/vales/reportes/actividad-tienda` (JSON; limitador de 30 por minuto por usuario, compartido con el PDF)
- `GET /api/vales/reportes/actividad-tienda/pdf` (PDF)

Todo fallo responde `{ error, codigo, referencia, etapa }`; ver `reportes_errores.md`.

| Parámetro | Rutas | Significado |
|---|---|---|
| `ventana`, `fecha`, `desde`, `hasta` | ambas | Período. |
| `tiendaId` / `tiendaIds` | ambas | Una tienda o una lista de ids (varias tiendas, o las de un país o grupo). Mal formado: 400. Fuera de las visibles: 400. |
| `desglose=0` | PDF | Imprime sin el desglose (por defecto lo incluye). |
| `tiendaDesglose=<id>` | PDF | Imprime el desglose de esa tienda (la enfocada). Si no es visible para el usuario: 400. |

### Respuesta JSON (campos del reporte de tienda)

`titulo`, `alcance` (`todas` o `supervisadas`), `periodo`, `tiendaIds`, `resumenFiltros`, `conteos`, `atrasadosVigentes` (los anteriores al período), `grupos` (`agruparPor: 'tienda'`, `secciones`, `totalVales`, `truncado`, `desgloseOmitido`), `filtros.tiendas` y `contadores`:

```text
contadores: {
  ingresados,
  porTienda: [{ id, nombre, total }] | null,   // de mayor a menor; null si el filtro es una sola tienda
  urgentes:  { total, porcentaje },
  sinEntregar,
  atrasados: { total, anteriores, actuales },
  recibidos: { total, conAtraso, sinAtraso },  // «Entregados» en pantalla
  porGrupo:  { "<idTienda>": { todos: C, urgentes: C } }   // C = ingresados, urgentes{total,porcentaje}, sinEntregar,
                                                           //     atrasados{total,anteriores,actuales}, recibidos{total,conAtraso,sinAtraso}
}
```

## 6.1 Mapa de archivos

**Backend** (`src/modules/vales/`)

| Archivo | Responsabilidad |
|---|---|
| `controllers/valeController.js` | `reporteActividadTienda`, `opcionesActividadTienda`, `reporteActividadTiendaPdf` y `_filtrosReporteTienda` (valida ids, `desglose` y `tiendaDesglose`). |
| `services/valeReporteContadores.js` | Módulo puro con las reglas de conteo (también calcula `porGrupo`). |
| `services/valeReporteTiendaService.js` | Arma el reporte: alcance, filtro, `contadores` (Atrasados y Sin entregar salen de `conteos`) y `generarPdf` (incluye la lógica de la tienda enfocada). |
| `services/valeReporteGruposService.js` | `armar` y `_contadores` (ingresados, urgentes, entregados con y sin atraso, `porTienda`). |
| `services/valeReportePdfService.js` | `_encabezado` (resaltado), `_contadoresActividad`, `_graficaTiendas`, `_divisionDesglose`, `_secciones` y `_vigentes` (títulos de Reportes 2 en `TITULOS_REPORTES2`). |

**Frontend** (`public/modules/vales/js/` y `css/reportes2.css`)

| Archivo | Responsabilidad |
|---|---|
| `views/reportes2.js` | Shell de la pestaña: filtros desde `/opciones`, «Generar», estado «viejo», errores y `descargarPdf` (si el reporte devuelve `null`, no descarga). |
| `views/reportes2/actividadTienda.js` | Configuración del reporte de tienda: filtro, `sinAvatar`, `preguntarDesglose` y `grafica` (enfoque de barras). |
| `views/reportes2/actividadReporte.js` | Render común: una sola consulta al generar, contadores, gráfica, desglose y PDF. |
| `views/reportes2/enfoque.js` | `enfocarPayload` y `existeGrupo`: el enfoque de barras sobre el resultado ya generado. |
| `views/reportes2/contadoresActividad.js` | Las cinco tarjetas. |
| `views/reportes2/graficaBarras.js` | La gráfica (genérica: tiendas y asesores) y su interacción. |
| `views/reportes2/modalIrAAsesores.js` | El modal del nombre de una tienda. |
| `views/reportes2/modalDesglosePdf.js` | El modal del PDF (usa `components/modal.js`). |
| `views/reportes2/textos.js` | Todos los textos del reporte. |
| `state.js` | `state.reporte2` (`tiendaId`, `tiendaElegida`, `tiendaElegidaNombre`…). |

## 7. Decisiones y por qué

- **Dos filas de contadores** (maqueta aprobada): cinco tarjetas no caben en una línea del PDF ni de la pantalla.
- **Barras, no pie:** ver §4.2.
- **La barra enfoca contadores y desglose, no el selector.** La primera versión cambiaba el selector completo (había que inventar un «valor anterior» y la gráfica desaparecía al elegir una sola tienda); el dueño aclaró que solo debía filtrar el desglose y los contadores, y se rehízo más simple.
- **«Otras» sin barra en el PDF:** una barra que suma varias tiendas aplastaba a las individuales y comparaba cosas distintas.
- **El nombre de la tienda nunca se recorta:** el dueño lo pidió; las barras ceden espacio.
- **Renombres:** nacieron solo en Reportes 2 porque «Reportes» y «Actividad» eran anteriores; esos ya se retiraron (`correcciones_69.md`).

## 8. Casos límite

- Sin vales en el período: aparece el estado vacío con «Ver el mes completo» (salvo que haya atrasados anteriores).
- Un solo vale en una sola tienda: la gráfica sale con una barra al 100 %.
- Una tienda con menos del 1 % se rotula «<1 %».
- Si la tienda enfocada ya no existe en el resultado (`existeGrupo`), el enfoque se descarta; enfocar nunca hace una consulta que pueda fallar.
- Un `tiendaDesglose` ajeno o mal formado responde 400, nunca 401 (el cliente trata cualquier 401 de `/api/` como sesión vencida).
- En el celular, la descarga directa del PDF la gestiona el navegador fuera de la página; el modal sí es un modal propio y su «atrás» lo cierra sin salir del módulo (ver `correcciones_66.md`, «El gesto “atrás”»).

## 9. Cómo comprobarlo (mínimo)

0. Elegir el reporte: aparece el selector de tienda y no se consulta nada. Cambiar tienda o período no consulta; el aviso «Cambiaste los filtros…» y el PDF deshabilitado aparecen solo si ya había un resultado.
1. Elegir «Todas las tiendas» y un período con vales y presionar «Generar»: deben verse cinco tarjetas, la gráfica y el desglose; **Entregados + Atrasados actuales + Sin entregar = Ingresados**.
2. Presionar una barra: cambian los contadores y el desglose, la barra queda con borde y el selector no cambia; presionarla de nuevo lo deshace.
3. Elegir una sola tienda en el selector: la gráfica desaparece.
4. Descargar el PDF con «Sí» y con «No», con y sin barra enfocada, y cerrando el modal sin elegir.
5. En celular (o ancho de 390 px): las tarjetas y la gráfica se acomodan y los nombres de las tiendas se leen completos.

## 10. Estado y pendientes

- Todo lo descrito está construido y verificado con `node --check` y con PDF, HTML y módulos puros con datos de prueba; **falta probarlo con datos reales en el navegador** (lo hace el dueño), incluido el flujo «Generar» y el enfoque local.
- Los cambios de esta documentación están en la rama `feat/vales-reportes-2` **sin push**; el PR a `dev` lo abre el dueño.
- Contadores para los reportes de talleres, diseñadores y asesores: el dueño los definirá reporte por reporte.
- Maquetas en Figma (archivo `N85CeWuBlGxZ7xCwK64Czg`): PDF `24:2`; pantalla `26:2` (escritorio) y `26:43` (celular). La propuesta de pie `28:2` y `28:101` quedó **descartada** a favor de las barras.
