# Reporte de actividad de asesores (Reportes 2): cómo funciona

> **Actualización 2026-11-23 (`correcciones_83.md`):** la tarjeta y la sección **«Sin entregar»** se llaman ahora **«Por vencer»** (misma definición), y el PDF imprime **todas** las barras de la gráfica por asesor.

Referencia de **un solo reporte**. Es el hermano del reporte de actividad de tiendas y comparte con él casi todo: léelo primero (`reporte_actividad_tienda.md`) y aquí solo se explica lo que cambia. Registro cronológico de los cambios: `correcciones_67.md`.

## 1. En una frase

Dado un período y un filtro de tienda, el reporte muestra **cuántos vales ingresó cada asesor y en qué estado están**: los mismos cinco contadores, una gráfica de barras «Vales ingresados por asesor» y el desglose de vales **agrupado por asesor**.

## 2. Quién lo ve y qué ve

| Aspecto | Regla |
|---|---|
| Permiso | `vales.reporte_actividad_asesor` (migración, solo Administrador al inicio; el resto se asigna desde «Roles y Permisos»). |
| Alcance | Quien tiene `vales.supervisar` ve solo a sus asesores (y a sí mismo) y las tiendas a su cargo; cualquier otro con el permiso ve todo. Quien solo tiene `vales.gestionar_taller` recibe 403: este reporte no es para él. |
| Filtro de tienda | El mismo selector de tienda en **modo múltiple** (casillas: una o varias tiendas, o un país o grupo entero con la casilla del padre; menú de `public/js/menuCascada.js`). Entrega ids sueltos («3,7,9»; vacío = todas) y viaja como `tiendaId` (una) o `tiendaIds` (varias). Una tienda fuera de las visibles responde 400. Su valor vive en `state.reporte2.asesorTiendaId`, **separado** del filtro del reporte de tiendas. |
| Filtro de asesores | El selector múltiple de asesores va junto al de tienda, **sin ícono**, y ofrece solo **los asesores de las tiendas elegidas** (una o varias; sin tienda, todos). Cambiar la tienda actualiza la lista sin consultar y saca de la selección a quien ya no está en ella. Acota a los asesores elegidos (`asesorIds`). Quien no trae tienda (el supervisor como «(yo)») se ofrece siempre. |
| Período | El mismo del resto de la pestaña «Reportes». |
| Cuándo se consulta | Solo con **«Generar»** (antes «Actualizar»). Al elegir el reporte aparecen los selectores de tienda y de asesores (de `/opciones`); cambiarlos o cambiar el período solo marca el resultado como viejo. |

## 3. Qué cambia respecto del reporte de tiendas

| Pieza | En asesores |
|---|---|
| **Contadores** | Los mismos cinco, con las mismas definiciones y la misma identidad contable, pero calculados sobre los vales de la tienda elegida (o de todas) y de los asesores visibles. «Entregado» significa que el vale ya llegó al asesor. |
| **Gráfica** | «Vales ingresados por asesor»: una barra por cada asesor que haya metido un vale, **apilada**: un tramo azul con los vales no urgentes y, a continuación, un tramo amarillo con los urgentes (`--color-warning`), con 2 px entre ambos. La cantidad de urgentes va siempre dentro del tramo amarillo, en texto oscuro; el tramo tiene un ancho mínimo (16 px) para que el número quepa aunque sea un solo vale, así que ese tramo no es exactamente proporcional cuando es muy pequeño. El detalle «N vales · U urgentes» sale al pasar el cursor. Lleva una leyenda («No urgentes», «Urgentes»). El resto es como la de tiendas (barras de mayor a menor, porcentaje en la punta, cantidad total a la derecha, diez visibles y «Ver las N restantes», nombres completos alineados a la derecha). Como el color significa «urgente», **no se resalta la barra mayor**. **Es pulsable**: ver §3.1. |
| **Desglose** | Las mismas cuatro secciones (Atrasados anteriores al período, Atrasados período actual, Sin entregar y Entregados); lo que cambia es que las tablas se agrupan **por asesor** y no por tienda. Con el círculo de iniciales junto al nombre, que el reporte de tiendas ya no lleva. |
| **PDF** | Igual que el de tiendas: franja de contadores, gráfica «VALES INGRESADOS POR ASESOR» apilada y con leyenda (10 mayores y «Otras (N asesores)» sin barra), línea divisoria y desglose. Al descargar, el mismo modal «¿incluir el desglose?». El botón del PDF queda deshabilitado hasta generar y mientras el resultado esté viejo. La línea de filtros, en negrita, lleva ambos filtros: «Asesores: Todos  ·  Tiendas: Todas». |
| **Barra enfocada** | Ver §3.1. Con un asesor enfocado, el modal del PDF avisa de quién es y «Sí» imprime **su** desglose (`asesorDesglose`), o solo el de sus urgentes (`soloUrgentes=1`) si el enfoque era el tramo amarillo. Los contadores y la gráfica del PDF siguen siendo los del filtro. El título sale «DESGLOSE DE VALES DE ARTE: <ASESOR>» o «<ASESOR> (SOLO URGENTES)». |

### 3.1 Barra enfocada (interacción)

- **El nombre, la cifra o el tramo azul** de la barra de un asesor enfocan los contadores y el desglose en **todos** sus vales.
- **El tramo amarillo** (urgentes) los enfoca solo en sus vales **urgentes**: los contadores se calculan solo sobre ellos.
- Pulsar de nuevo el mismo objetivo quita el enfoque; pulsar el otro cambia de modo. También lo quita presionar fuera de las barras (título, leyenda, bordes de la gráfica). La barra enfocada lleva borde y, en el modo de urgentes, también el tramo amarillo.
- El selector de tienda, el de asesores, la gráfica y el PDF no cambian por el enfoque. El enfoque es **local y no consulta nada**: `views/reportes2/enfoque.js` filtra el resultado ya generado con `contadores.porGrupo["<idAsesor>"]` (`todos` para el modo normal, `urgentes` para el amarillo, donde además solo quedan en el desglose los vales con `urgente === true`). Con más de 5000 vales en el período no hay desglose que filtrar: la pantalla muestra el aviso «Demasiados vales para listarlos» y el enfoque solo cambia los contadores; el PDF del asesor enfocado sí imprime su desglose.
- Cambiar el selector de tienda o el de asesores descarta el enfoque. Estado: `state.reporte2.asesorElegida`, `asesorElegidaNombre` y `asesorElegidaUrgentes`.
- Limitación: el tramo amarillo se pulsa con el ratón o el dedo; con teclado, la barra enfoca solo el modo «todos» (un botón dentro de otro no es válido).

### 3.2 Filtrar por contador y PDF con filtros

Igual que en el reporte de tiendas (ver `reporte_actividad_tienda.md`, «Filtrar por contador» y «PDF con filtros de la vista»). Aquí los contadores se calculan sobre los asesores visibles y la barra enfocada es la de un asesor: con su tramo amarillo (solo urgentes) y un contador, el PDF «con los filtros aplicados» imprime el desglose de ese asesor con ambos filtros; los parámetros son `asesorDesglose`, `soloUrgentes=1`, `desgloseEstado` y `desgloseUrgentes=1`.

## 4. De dónde se llega

- Desde el selector de reportes de la pestaña (combo).
- **Desde el reporte de tiendas:** al presionar el **nombre** de una tienda en su gráfica aparece un modal «¿Quieres ir al reporte de actividad de asesores de <tienda>?». «Sí» abre este reporte con esa tienda ya elegida, **sin asesores elegidos** (para ver a todos los de la tienda) y con el **mismo período**. «No», o cerrar el modal, deja todo como estaba. El modal solo se ofrece si la persona tiene el permiso de este reporte.

## 5. API

- `GET /api/vales/reportes/actividad-asesor/opciones` (JSON `{ alcance, filtros }` con las tiendas y los asesores visibles; no recorre vales; 120 por minuto por usuario), `GET /api/vales/reportes/actividad-asesor` (JSON) y `GET /api/vales/reportes/actividad-asesor/pdf` (PDF; ambos comparten 30 por minuto por usuario), con `requirePermission('vales.reporte_actividad_asesor')`. Los fallos responden `{ error, codigo, referencia, etapa }` (ver `reportes_errores.md`).

| Parámetro | Significado |
|---|---|
| `ventana`, `fecha`, `desde`, `hasta` | Período. |
| `tiendaId` / `tiendaIds` | Una tienda o una lista de ids (varias tiendas, o las de un país o grupo). Mal formado o ajeno: 400. |
| `asesorIds` | Lista de asesores. Fuera del alcance: 400. |
| `desglose=0` | Solo el PDF: imprime sin el desglose. |
| `soloUrgentes=1` | Solo vales urgentes (el enfoque del tramo amarillo). Hoy solo lo usa el PDF, junto con `asesorDesglose`; en pantalla el enfoque es local. |
| `asesorDesglose=<id>` | Solo el PDF: imprime el desglose de ese asesor (el enfocado). Fuera del alcance: 400. |

La respuesta añade a la del resto de reportes de equipo: `tiendaIds`, `filtros.tiendas` y `contadores`, con la misma forma que en tiendas (`ingresados`, `urgentes`, `sinEntregar`, `atrasados`, `recibidos`) más **`porAsesor`**: `[{ id, nombre, total, urgentes }]` de mayor a menor por `total`, que alimenta la gráfica apilada (`urgentes` es cuántos de esos vales tienen la marca `urgente`). `porTienda` no viene en este reporte. También trae **`porGrupo`**: `{ "<idAsesor>": { todos: C, urgentes: C } }`, con C = ingresados, urgentes `{ total, porcentaje }`, sinEntregar, atrasados `{ total, anteriores, actuales }` y recibidos `{ total, conAtraso, sinAtraso }` (calculado por `valeReporteContadores.js`), que alimenta el enfoque local.

## 6. Mapa de archivos

| Archivo | Qué hace aquí |
|---|---|
| `services/valeReporteEquiposService.js` | Para el tipo `asesor`: valida y aplica el filtro de tienda, pide los contadores y los completa; `generarPdf` pasa `incluirDesglose`. |
| `services/valeReporteGruposService.js` | `_contadores` calcula `porAsesor` cuando se agrupa por asesor; `completarContadores` (compartido con tiendas) suma Atrasados y Sin entregar. |
| `services/valeReportePdfService.js` | `_graficaBarras` genérico (tiendas y asesores). |
| `controllers/valeController.js` | `_filtrosReporteEquipo` lee `tiendaId`, `tiendaIds` y `desglose` para asesores. |
| `views/reportes2/actividadEquipos.js` | `filtroAsesorConTienda`: el selector de tienda junto al de asesores; configuración del reporte (`contadores`, `graficaClave: 'porAsesor'`, `preguntarDesglose`). |
| `views/reportes2/graficaBarras.js` | La gráfica genérica y su interacción. |
| `views/reportes2/enfoque.js` | El enfoque de barras sobre el resultado ya generado (sin consulta). |
| `services/valeReporteContadores.js` | Reglas de conteo y `porGrupo`. |
| `views/reportes2/textos.js` | `TEXTOS_ASESOR`: título de la gráfica y las notas de ayuda con los contadores. |

## 7. Decisiones y por qué

- **El selector de tienda se suma al de asesores, no lo reemplaza.** Quien ya filtraba por asesores no pierde nada; si el dueño prefiere dejar solo la tienda, basta quitar el selector de asesores de `filtroAsesorConTienda`.
- **Estado propio (`asesorTiendaId`).** Así ir de tiendas a asesores no cambia el filtro del reporte de tiendas, que sigue en «Todas las tiendas».
- **Gráfica pulsable con dos objetivos** (pedido del dueño el 2026-11-20): nombre y tramo azul = todos los vales del asesor; tramo amarillo = solo los urgentes. Urgentes en amarillo y no en rojo, también a pedido suyo.
- **Selector múltiple de asesores:** su panel se alinea a la derecha en pantallas anchas (`reportes2.css`), porque el filtro vive en el borde derecho de la cabecera y el panel se salía de la ventana.
- **El modal del PDF también aplica aquí:** el reporte es «similar» al de tiendas y su PDF tiene la misma estructura.

## 8. Casos límite

- Una tienda sin vales en el período: estado vacío con «Ver el mes completo» (salvo que haya atrasados anteriores).
- Un asesor con menos del 1 % se rotula «<1 %».
- Quien supervisa ve el selector de tienda acotado a sus tiendas y «Todas mis tiendas».
- Todo lo del servidor se verificó con `node --check` y datos de prueba; **falta probarlo con datos reales** (lo hace el dueño).
