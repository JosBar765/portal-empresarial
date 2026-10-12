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
