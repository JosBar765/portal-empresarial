# Correcciones 53 — Reportes: pestaña por permiso para Gerencia, nuevo período y tabla unificada

Rama: `feature/reportes-gerencia` (desde `dev`).

## Qué cambia

- **Pestaña por permiso, sin excepciones por rol.** `valeReporteService.resolverAlcance` ya no lanza «Tu rol no tiene reportes»: cualquier rol con `vales.ver_reportes` y sin alcance propio (hoy el Gerente) recibe el alcance global de solo lectura, igual al del Administrador. La interfaz muestra el botón únicamente por el permiso (`sidebar.js`); al quitarlo desaparece la pestaña y la API responde 403.
- **Migración (solo datos, idempotente):** `database/05_reportes_gerente.sql` otorga `vales.ver_reportes` al rol Gerente (rol 8), buscando el permiso por código. Los Gerentes con sesión abierta deben volver a entrar. `schema.sql` y `seed.sql` no se tocan.
- **Barra de período propia de Reportes:** Hoy · Día · Semana (lunes–domingo) · Mes · Desde–Hasta; sin «Todo». Flechas ‹ › y un calendario según el tipo (día, semana resaltada completa, cuadrícula de meses; el rango usa dos campos). Abre en «Hoy». Las otras vistas conservan su barra; la barra global se oculta en Reportes. El servidor valida el período (`resolverVentanaReporte`) y compara con el período anterior de igual duración.
- **Tabla unificada** (reemplaza «Por asesor» y «Vales del período» para Gerente, Administrador, Supervisor y Encargado/Asistente): filas de personas con **Creados, Autorizados y Último creado** y chips de **atrasados** y **sin propuesta**; al pulsar una fila se despliega la mini tabla de sus vales (**Vale, Estado/pipeline, Entrega, Atraso, Propuesta y Acciones**: ver vale, ver propuesta e historial). «Expandir/contraer todo» y se recuerda lo abierto al actualizar.
- **Agrupar por** Asesor (por defecto; Diseñador para el Encargado), Diseñador, Taller o Tienda, con filtros de tienda, taller, asesores y diseñadores (alcance validado en el servidor: un Supervisor solo ve a sus asesores y un Encargado solo su taller).
- **Orden:** los vales de cada fila, y las filas por su peor vale: 0) sin asignar («Por asignar»), 1) atraso (más días arriba), 2) paso más bajo del pipeline, 3) sin propuesta adjunta, y luego la entrega más cercana. «Atrasado» solo cuenta vales abiertos.
- **Qué vales:** los **creados en el período** (por su fecha de creación). Las tarjetas de indicadores siguen contando acciones por el día en que ocurrieron.
- **PDF:** misma estructura (persona con sus vales, estado del pipeline, entrega, atraso y propuesta) y los filtros activos en el encabezado.
- Asesor y Diseñador conservan su vista simple.

## Archivos

Servidor: `services/valeReporteService.js`, `services/valeReporteGruposService.js` (nuevo), `services/valeReportePdfService.js`, `repositories/propuestaRepository.js` (propuesta por lote), `repositories/reporteRepository.js` (opciones de filtro), `controllers/valeController.js`. Navegador: `js/views/reportes.js`, `js/components/barraPeriodoReportes.js` y `selectorMultiple.js` (nuevos), `js/state.js`, `js/layout/sidebar.js`, `css/reportes.css`. Base de datos: `database/05_reportes_gerente.sql`.

## Verificación

Con los 60 vales de prueba: el Gerente ve la pestaña y el reporte global (grupos por asesor, diseñador, taller y tienda; semana, rango y mes); «todo» responde 400; sin el permiso responde 403; el Supervisor no puede pedir un asesor ajeno ni el Encargado un taller ajeno; Asesor y Diseñador reciben su vista simple. En pantalla: barra de período con calendario de semana, filtros, tabla y mini tabla; sin desbordes a 375 px. PDF revisado. La migración se aplicó dos veces sin error.

## Ajuste posterior: tarjetas y tabla más simples

- **Tarjetas del alcance global (Gerente/Administrador):** solo Vales creados, Autorizados, Propuestas entregadas, Ciclo completo (crear → confirmar), Tiempo de producción promedio, **Sin propuesta** (vales abiertos ya en los talleres sin propuesta adjunta; reemplaza a «Abiertos ahora») y Atrasados ahora.
- **Porcentajes bajo las tarjetas:** se quitaron (comparaban contra el período anterior de igual duración); las tarjetas quedan solo con su valor.
- **Tabla principal:** se quita la columna «Último creado» (también del PDF) y el botón de historial de la mini tabla (quedan «Ver vale» y «Ver propuesta»).
- **Secciones vacías:** los paneles sin contenido ya no se crean (solo existe el de la tabla unificada, o los de la vista simple del Asesor y el Diseñador).

## Ajuste posterior: tarjetas con ícono de información

- Cada tarjeta lleva un ícono ⓘ junto a la etiqueta; la explicación del indicador sale en un globo al pasar el ratón, enfocar con el teclado o tocar (se cierra con Esc o al tocar fuera). Se quitó el texto explicativo que ocupaba la tarjeta; las que muestran el estado de hoy llevan una etiqueta «Ahora mismo» y las de alerta (Sin propuesta, Atrasados) un fondo suave en rojo.
- Las explicaciones salen del servidor (`AYUDAS_KPI` en `valeReporteService.js`, por rol), de modo que cada indicador de cada rol tiene la suya.
- «Cómo se calculan estos indicadores» se rehízo: reglas generales (período, «Ahora mismo» y la tabla) y, debajo, la definición de cada indicador que ve ese rol, tomada de las mismas explicaciones.

## Ajuste posterior: PDF sin contadores y con encabezado más pequeño

- El PDF ya no incluye la sección de indicadores (tarjetas); queda el encabezado, los filtros y la tabla de personas con sus vales (o el listado simple del Asesor y el Diseñador).
- El encabezado es más pequeño: logo de 22 pt, título de 12 pt, subtítulo y datos de 7.5–8.5 pt y menos espacio antes de la tabla. Se quitó el método de indicadores de `valeReportePdfService.js`.

## Ajuste posterior: agrupaciones y filtros por rol

Cada rol agrupa y filtra solo su personal a cargo:

| Rol | Agrupar por | Filtros |
|---|---|---|
| Administrador / Gerente | Asesor, Diseñador, Taller, Tienda | Todos |
| Supervisor | Asesor | Asesores (de todas las tiendas que cubre, él mismo como «(yo)»), Tienda (solo las que cubre) y Taller (los de esas tiendas) |
| Encargado / Asistente | Diseñador | Diseñadores de sus talleres (él como «(yo)») y Taller, solo si tiene 2 o más a cargo |

- Con una sola agrupación, la pantalla muestra un rótulo fijo en lugar de los botones.
- Si se pide a mano una agrupación o un filtro que el rol no tiene (agrupar por taller siendo supervisor, tienda o asesores siendo encargado, diseñadores siendo supervisor, tienda o taller ajenos), la API responde 400.
- Archivos: `valeReporteService.js` (`resolverAlcance`, `obtenerReporte`, `_opcionesDeFiltro`), `reporteRepository.js` (`listarTiendasPorSupervisor`), `views/reportes.js`.

## Ajuste posterior: orden de «Agrupar por» y sin contadores

- El orden de las agrupaciones es **Tienda, Taller, Asesor, Diseñador** (la que abre por defecto sigue siendo Asesor, o Diseñador para el Encargado).
- La pestaña Reportes ya no muestra las tarjetas de contadores para ningún rol: abre directo con los filtros y la tabla. El servidor sigue calculando `kpis` (no se tocó la API).
- «Cómo se calculan estos indicadores» pasa a «Cómo funciona este reporte» y conserva solo las reglas del período y de la tabla.

## Ajuste posterior: PDF vertical y estado por paso

- El PDF del reporte pasa a **Carta vertical** y se quita la columna **Cliente** (en pantalla sigue). Tabla unificada: Vale, Estado (la más ancha), Entrega, Atraso y Propuesta; Asesor y Diseñador, Correlativo, Estado, Entrega y sus columnas.
- **Estado por paso del pipeline**, en una sola línea: «Paso 3 de 5 - Producción | En proceso» (o «Paso 5 de 5 - Completado | Recibido»); detrás, quién tiene el turno o los talleres listos si aplica («Encargado», «1 de 3 talleres listos»). Si no cabe pasa a una segunda línea. Sin barra de pasos ni texto de atraso.
- **Columna Atraso con semáforo** (también en el listado de Asesor y Diseñador), solo con el color de la letra, sin fondo: rojo con los días si está atrasado («8 días»), naranja si vence hoy y amarillo oscuro si va al día. Entrega, Atraso y Propuesta van centradas y las columnas se reparten para llenar el ancho; el estado queda pegado al correlativo. Cuando el estado pasa a dos líneas, el bloque queda centrado en la fila.
- Los vales de varios talleres muestran el paso del taller más atrasado, igual que en pantalla.
- `valeReporteService._listado` agrega `pipeline` a cada fila para que el listado de Asesor y Diseñador use el mismo formato; la pantalla lo ignora.

## Ajuste posterior: Rendimiento se elimina y nace «Cupo de talleres»

- **Rendimiento se elimina del sistema** (y la API de «Encontrar vale»): se borran su pantalla, `valeRendimientoService`, `valeBusquedaService`, las rutas `/rendimiento-gerencia` y `/buscar`, `charts.js` y `rendimiento.css` (las reglas que Reportes aún usa pasaron a `reportes.css`; también se quitó el código de las tarjetas de indicadores, que ya no se ven). La migración `quitar_rendimiento.sql` borra el permiso `vales.ver_gerencia`.
- **Nueva pestaña «Cupo de talleres»** (permiso nuevo `vales.ver_cupo`, migración `cupo_talleres.sql`, que lo da al Supervisor): calendario mensual con mapa de calor del cupo diario de los talleres con límite de sus tiendas, vales por autorizar como «+N» y detalle por día con la lista de vales. Ver `flujo_vale_de_arte.md` §12.
- Los usuarios deben cerrar sesión y volver a entrar para que el permiso cambie.

## Ajuste posterior: todo por fecha de entrega y vista «Taller»

- **Todo el reporte filtra por la fecha de entrega** de los vales (antes, por la fecha de creación o de cada acción): la tabla unificada, el listado de Asesor y Diseñador y el PDF. La pantalla y el PDF muestran «Fecha de entrega: Octubre 2026», y el resumen de cada fila pasa de «Creados» a «Vales».
- **Vista Taller (Encargado/Asistente):**
  - Franja de indicadores sobre la tabla: **Entrantes** (vales del período que ya llegaron a sus talleres), **Entregados** (el Encargado ya aprobó la propuesta del taller; en revisión aún no cuenta), **% efectividad** (entregados ÷ entrantes), **% a tiempo** (entregados sin atraso en su taller ÷ entregados; el atraso del taller termina cuando el Encargado aprueba, no cuando el Diseñador entrega) y **Atrasados sin entregar** (vales del período con entrega vencida que el taller no ha entregado: no se trabajaron, o se trabajaron y no se enviaron a revisión). Con valor cero en el divisor se muestra «—».
  - La tabla agrega la columna **Fecha de ingreso** y deja de mostrar el cliente bajo el correlativo.
  - Los diseñadores listados son solo los de sus talleres (antes un vale de varios talleres traía también a los de los otros).
  - **PDF:** resumen de los cinco indicadores bajo el encabezado y dos listas planas, **ATRASADOS** y **DEMÁS VALES**, cada una por fecha de entrega (la más antigua primero), con las columnas Vale, Fecha de ingreso, Estado, Entrega, Atraso, Diseñador y **Terminado** (Sí/No, antes «Propuesta»).
- Un vale atrasado con menos de un día completo de atraso se muestra como «Atrasado» en la columna Atraso del PDF.
- Archivos: `valeReporteGruposService.js`, `valeReporteService.js` (`_listado`, `_primerasEntregas`), `valeReportePdfService.js`, `views/reportes.js`, `css/reportes.css`.

## Ajuste posterior: información por día en el calendario del Buzón y visor emergente

- **Calendario desplegable del Buzón con información por día** (la que se abre desde «Octubre 2026»):
  - **Supervisor** (permiso `vales.ver_cupo`): semáforo por día con barras por taller con límite, «+N» de vales por autorizar y, en el pie, el detalle del día (`Diseño 3/15 · 12 libres`).
  - **Diseñador y Encargado/Asistente de taller:** número de vales con entrega ese día (los del diseñador, o los de su taller) con intensidad de color y el mismo pie de detalle.
  - Con información, elegir un día lo marca y el pie ofrece **«Ver vales de este día»** (filtra el Buzón) y **«Ver reporte de este día»** (abre Reportes con período «Día» en esa fecha de entrega). Asesor, Gerente y Administrador conservan el calendario de siempre.
  - API: `GET /api/vales/calendario-buzon?anio=&mes=`, que responde según el rol (`cupo`, `conteo` o `null`).
- **Se elimina la pestaña «Cupo de talleres»** y sus rutas `/cupo-talleres`; el cupo vive en el calendario. El permiso `vales.ver_cupo` se conserva (migración `cupo_talleres.sql`, con textos actualizados).
- **Visor emergente de vale y propuesta** (`components/visorDocumento.js`): reemplaza abrir una pestaña nueva en el Buzón, el modal «Ver» del Supervisor y la tabla de Reportes. Casi pantalla completa en escritorio y pantalla completa en celular, pestañas «Vale de arte» / «Propuesta» cuando existen ambos, PDF o imagen integrados, indicador de carga, Esc y clic fuera para cerrar, foco atrapado y devuelto, y los botones «Abrir en pestaña» y «Descargar» como respaldo. El PDF del vale sigue pasando por `/api/vales/:id/pdf`, así que el vale se marca como visto igual que antes.

## Ajuste posterior: propuesta con nota y enlaces

- **Entregar propuesta (Diseñador) y fusión (Encargado/Asistente)** ahora comparten un componente (`adjuntosPropuesta.js`) con tres secciones: **Archivo** (PDF de hasta 5 MB), **Enlaces** (hasta 5, con nombre opcional, solo https, con aviso del dominio y errores en cada fila) y **Nota** de hasta 500 caracteres con contador. Un resumen sobre los botones dice qué se va a enviar y el botón «Entregar» se habilita solo con el PDF y «Aprobar y Fusionar» también solo con el PDF.
- **Regla:** al **entregar**, el **PDF es obligatorio**: una propuesta solo con enlaces no es válida; los enlaces y la nota son complementos opcionales (decisión del dueño, 2026-10-14). Entregar sin PDF responde 400 (antes una propuesta vacía generaba la alerta roja). La **fusión** también exige siempre el PDF (decisión del dueño, 2026-10-14).
- **Datos:** migración `propuesta_nota_enlaces.sql` (columnas `vale_propuestas.nota` y `vales.propuesta_general_nota`, tabla `vale_propuesta_enlaces`); aditiva e idempotente. La validación vive en `services/propuestaAdjuntos.js` y se repite en el servidor (https, hasta 5 enlaces, sin usuario ni contraseña, nota de hasta 500 caracteres). El historial queda como «entregó propuesta (archivo, 2 enlaces y nota)».
- **Verla:** el visor emergente carga `GET /api/vales/:id/propuesta` (tipos `taller`, `general` y `ultima`, con la misma regla de acceso que el detalle) y muestra el archivo incrustado y, al lado, un panel con las observaciones y las tarjetas de enlace, que abren en una pestaña nueva con `rel="noopener noreferrer"`. Si solo hay enlaces, el panel ocupa todo el visor. El modal «Revisar propuesta» del Encargado también muestra la nota y los enlaces, y la fusión abre el visor de la propuesta de cada taller.
- **Botones «Ver propuesta»** del Buzón y de Reportes aparecen también cuando la propuesta solo tiene enlaces (`propuesta_extra` / `propuesta_taller_extra`); en Reportes «Propuesta: Sí» cuenta los enlaces.

## Ajuste posterior: tabla «Vales por diseñador»

- Al agrupar por diseñador (pantalla y PDF) se quita la columna/cifra **Autorizados** y la columna «Propuesta» pasa a **«Terminado»** con Sí o No (el taller ya terminó su parte; para otros roles, el vale ya está completo). En la columna Atención, «sin propuesta» pasa a «sin terminar». Las demás agrupaciones no cambian.

## Ajuste posterior: encargados que trabajan vales y filtro por taller

- El filtro «Todos los diseñadores» (Administrador y Gerente) ahora lista también a los **encargados y asistentes de taller** (y a cualquiera con vales asignados), con la etiqueta «· Encargado» / «· Asistente» en el filtro, las fichas, la tabla agrupada por Diseñador y el PDF. Antes solo listaba a quienes estaban asignados a un taller como diseñadores, y un encargado que se asigna vales a sí mismo no se podía elegir.
- **Con un taller elegido**, el filtro de diseñadores solo muestra a quienes trabajan en ese taller, al cambiar de taller se quitan las personas elegidas que ya no aplican, y al agrupar por Diseñador solo salen los diseñadores de ese taller (antes, un vale de varios talleres traía también a los de los otros talleres).
- Archivos: `reporteRepository.js` (`listarDisenadores`, `listarNombres`), `valeReporteService.js`, `valeReporteGruposService.js`, `views/reportes.js`. Sin migración.

## Ajuste posterior: entregar propuesta exige siempre el PDF

- **Entregar propuesta** ahora exige **siempre un documento PDF**: el botón «Entregar» queda deshabilitado hasta adjuntarlo (con el aviso «Adjunta el PDF de la propuesta para continuar») y la API responde 400 sin archivo, aunque lleve enlaces. Los **enlaces y la nota** pasan a ser complementos opcionales. La fusión del Encargado exige lo mismo (PDF obligatorio).

## Ajuste posterior: visor sin botón «Ver propuesta» y con encabezado compacto

- Como el visor ya muestra el vale y la propuesta en pestañas, se quita el ícono aparte «Ver propuesta» de las filas del Buzón y de la tabla de Reportes: el ojo abre el visor (siempre en «Vale de arte») y la pestaña «Propuesta» aparece cuando existe. Los modales de revisión, fusión, Asesor y Supervisor no cambian.
- El encabezado del visor ya no muestra el cliente (solo el correlativo) y es más bajo y de letra menor; el tamaño de la ventana no cambia.

## Ajuste posterior: atrasados vigentes

- **Problema:** el filtro de fecha del Buzón (Hoy, día, mes, rango) y el período de Reportes usan la fecha de entrega, así que un vale atrasado que sigue abierto desaparecía al elegir «Hoy» (y el contador «Atrasados» solo contaba los de hoy).
- **Buzón:** con cualquier filtro de fecha distinto de «Todo», un bloque plegable **«Atrasados vigentes»** sobre la tabla lista todos los vales atrasados y abiertos de tu alcance cuya entrega queda fuera del filtro (los más atrasados primero, hasta 100), con las mismas columnas y acciones. El contador «Atrasados» cuenta siempre todos los vigentes. No aplica a «Todo» ni a «Trabajo realizado». El servidor devuelve `atrasadosVigentes` en la respuesta del Buzón (`valeBuzonService.obtenerBuzon`).
- **Reportes:** un panel plegable **«Atrasados vigentes»** al inicio (hasta 200, con el responsable según la agrupación) con los atrasados abiertos fuera del período y con los mismos filtros de tienda, taller y personas; la tabla de abajo sigue siendo solo del período. El PDF lo incluye como sección «ATRASADOS VIGENTES» antes del resto. El Asesor y el Diseñador ven el panel con sus propios vales.
- **Diseño del bloque (Buzón y Reportes):** tarjeta sobria con un encabezado de una línea («Atrasados vigentes», contador y «El más atrasado lleva 28 días · con entrega anterior al período elegido») y una lista compacta de los **5 más atrasados**; el resto se abre con «Ver los N restantes» (lista con desplazamiento). Cada fila muestra el vale y su contexto (cliente y responsable), el estado con su paso, la fecha de entrega, los días de atraso con un punto de color según la gravedad (1–3, 4–7 y 8 o más días; el texto siempre dice los días) y las acciones. En celular cada fila pasa a dos líneas. Componente `components/atrasadosVigentes.js`.
- Se recuerda si el usuario plegó el bloque o el panel (preferencia local del navegador). Sin migración.

- **Selector de calendario:** el día (y el mes) seleccionado pasa del azul brillante al azul oscuro de la marca (el de los botones), con texto blanco; «hoy» se marca con un anillo fino del mismo tono y la intensidad de vales por día del calendario del Buzón usa grises azulados en lugar de azul. Solo CSS (styles.css, calendario-info.css).

- **Calendario del Supervisor:** en la vista con cupo, el día elegido se rellena con el tono sólido de su estado (verde, ámbar, naranja o rojo) con número y barras en blanco, en vez del azul oscuro, que desentonaba sobre el fondo verde.

## Ajuste posterior: gráficas de desempeño, secciones del reporte y pipeline

- **Orden del reporte (pantalla y PDF):** 1) contadores (los de la vista Taller, sin cambios), 2) atrasados antes del período (bloque plegable ya existente), 3) gráfica (solo Encargado/Asistente y Supervisor), 4) **Atrasados en el período**, 5) **No entregados**, 6) **Entregados**. Cada sección es plegable, con contador, y se omite si está vacía; «Entregados» arranca plegada si tiene más de 10. Dentro de cada una las filas siguen agrupadas por lo elegido en «Agrupar por».
- **«Entregado» según la vista:** Encargado/Asistente y Diseñador, el Encargado de su taller ya aprobó la propuesta (en revisión aún no cuenta); Asesor, Supervisor, Gerente y Administrador, el vale ya llegó al asesor (pendiente de confirmar, recibido o confirmado). Precedencia: atrasado abierto > entregado > no entregado. Servidor: `seccion` de cada ficha en `valeReporteGruposService.armar` (devuelve `secciones` en lugar de `grupos`) y de cada fila en `_listado` (Asesor/Diseñador).
- **Gráficas de barras dobles** (`components/graficaBarrasDobles.js`, barras horizontales, sin librería): Encargado/Asistente, asignados vs entregados por diseñador y por él mismo; Supervisor, creados vs autorizados por asesor y por él mismo. Sobre los vales con entrega en el período y con los filtros aplicados; quienes no tienen vales aparecen con 0. Valores al final de cada barra, % a la derecha, leyenda con ayuda, tabla equivalente para lectores de pantalla y colores validados contra daltonismo (azul y verde). El PDF dibuja la misma gráfica.
- **Asesor y Diseñador:** su tabla de vales muestra el pipeline de estados y se parte en las mismas tres secciones.

## Ajuste posterior: dos reportes (Actividad y Rendimiento)

- **Dos reportes** para el Encargado/Asistente y el Supervisor, en pestañas «Actividad | Rendimiento» (la pestaña Actividad muestra cuántos vales piden atención). Comparten período y filtros; «Agrupar por» solo aparece en Actividad. Se recuerda la última pestaña. Asesor, Diseñador, Gerente y Administrador solo tienen Actividad, sin pestañas.
- **Rendimiento:** contadores (los del Encargado), gráfica de barras dobles y tabla comparativa por persona (Asignados/Creados, Entregados/Autorizados, %, Atrasados), con fila de totales y el texto «% más bajo» en la persona con menor porcentaje. Server: `grupos.rendimiento` (antes `grafica`) con `atrasados` por persona y `totales`.
- **Actividad:** atrasados antes del período y las tres secciones. Rediseño más simple: secciones planas con título, contador y ayuda; filas por persona con «N vales» y solo el chip de «sin propuesta» cuando aplica; sin cabecera repetida ni columna «Autorizados» (pasó a Rendimiento); columnas por sección (Atraso solo en atrasados, Propuesta no en entregados); «Entregados» arranca plegada.
- **Descarga:** botón «Exportar PDF ▾» con menú accesible (teclado, Esc, clic fuera) para elegir «Reporte de actividad» o «Reporte de rendimiento» (marca la pestaña actual); roles sin Rendimiento tienen el botón simple. API: `GET /api/vales/reportes/pdf?tipo=actividad|rendimiento` (rendimiento fuera de su alcance responde 400); archivos `reporte-actividad-…` y `reporte-rendimiento-…`.

- **Nombre:** el bloque «Atrasados vigentes» pasa a llamarse **«Atrasados antes del período»** (Buzón, Reportes y PDF), para que se entienda que son los vencidos con entrega anterior al período elegido.

## Ajuste posterior: el Buzón arrastra lo pendiente

- **Cambio:** el bloque plegable «Atrasados antes del período» del **Buzón** se reemplazó por una sola lista: con cualquier filtro de fecha el usuario ve, junto a lo del período, lo que **viene arrastrando**, sin títulos de sección. Aplica a todos los roles (asistentes como su encargado); «Trabajo realizado» no muestra arrastrados. Reportes conserva su panel.
- **Arrastrado:** vale que sigue pendiente en el buzón del usuario con entrega anterior al inicio del período (rango con `desde`, o antes del primer día del mes), aunque su atraso esté congelado (p. ej. un «Por confirmar» del asesor, como MTC-RR-138: entrega 26/09, atraso congelado el 02/10 con 6 días). No exige estar atrasado.
- **Orden:** una sola lista, sin agrupar por estado (los filtros de estado son las tarjetas): por días de atraso de mayor a menor, y los que no tienen atraso después, por fecha de entrega. Con orden por columna manda el orden elegido. Se probó antes con los arrastrados primero y debajo la jerarquía del rol, y se descartó porque la agrupación por estado volvía a romper la secuencia.
- **Cómo:** `ventana.incluirArrastrados` en `dentroDeVentana` (solo vista Buzón) deja pasar lo anterior al período; `obtenerBuzon` ordena por atraso. La respuesta ya no trae `atrasadosVigentes`. Sin migración.
- **Administrador y Gerente:** la vista general se separa en **Buzón** (lo que sigue en curso) y **Trabajo realizado** (vales `RECIBIDO`/`CONFIRMADO` de todos, con los contadores «Recibidos hoy» y «Total recibidos»), como las vistas de los demás roles.
