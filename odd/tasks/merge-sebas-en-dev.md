# Merge de `cambios-sebas` en `dev` (resolución de conflictos y verificación)

Rama: `merge/sebas-en-dev` (desde `origin/dev` 5adc04c, que ya incluye `merge/reportes-gerencia-en-dev`). La rama `cambios-sebas` (1 commit, 6a1c512, AndrewUMG) NO se toca. Sin upstream a propósito; no se sube a `main` hasta que el dueño lo indique.

## Contexto
`cambios-sebas` salió de `dev` ANTES de la reestructura de reportes y de las notas/enlaces. Contra el `dev` actual: 4 archivos en conflicto (`valeBuzonService`, `valeCreacionService`, `valeReporteService`, `flujo_vale_de_arte.md`).

## Qué trae Sebas
Cantidad mínima 1; adjuntos obligatorios al crear/corregir/modificar; urgente manual (sin urgente, entrega mínima hoy+3 días); asesor visible en la vista del Encargado; fin del atraso del taller al entregar la propuesta (`vale_talleres.atraso_congelado_en`, script `atraso_taller`).

## Resolución
- `valeCreacionService`: se conserva la cola por idempotency key (nuestro `crearVale` -> `_crearVale`) y la validación de adjuntos de Sebas pasa al inicio de `_crearVale`.
- `valeBuzonService`: `enriquecerParaFila` de Sebas + `propuesta_taller_extra` / `propuesta_disenador_id` de dev (2 zonas).
- `valeReporteService`: se conserva la estructura nueva de reportes de dev y se injerta la regla de atraso del taller en `_listado` (Diseñador); import unido. La vista Encargado/Asistente de la tabla unificada ya oculta el atraso cuando el taller terminó (`terminadoTaller`), coherente con la regla.
- `flujo_vale_de_arte.md`: se conservan ambos textos.

## Pruebas (BD local con `06_atraso_taller.sql` aplicado dos veces sin error)
- Flujo real con Storage de pruebas, ahora con adjunto obligatorio al crear: 29/29 (un taller y dos talleres con fusión con PDF por asistente).
- Cambios de Sebas (`e2e_sebas`): 20/20 — cantidad 1 válida y 0 rechazada; crear sin adjuntos rechazado; sin urgente mínima >= hoy+3; con urgente se aceptan fechas cercanas; el diseñador y el encargado ven el atraso detenido al entregar (2 días) y el asesor sigue viendo el del vale (5); al devolver la propuesta el atraso se reanuda; el encargado ve al asesor bajo el correlativo.
- Concurrencia (`e2e_concurrencia`) 6/6: la cola por idempotency key sobrevive al merge (8 envíos simultáneos -> 1 vale).
- Navegador: modal de crear vale (tarjeta «Pedido urgente», fecha deshabilitada hasta elegir taller, calendario con urgente) y buzón del Encargado con asesor y diseñador; sin errores de consola.

## Corrección posterior (2026-10-15, pedido del dueño)
- El atraso del taller se pausa cuando el ENCARGADO aprueba la propuesta (`_revisarPropuestaInterno`, también en la autoaprobación), no cuando el Diseñador la entrega. En revisión sigue corriendo. Desaprobar y reasignar lo reanuda (`atraso_congelado_en` = NULL).
- Reportes: Encargado/Asistente (`valeReporteGruposService`) y Diseñador (`valeReporteService._listado` y `_atrasadosVigentesSimple`) cuentan el vale como atrasado hasta que su taller aprueba; el atraso de Asesor/Supervisor/Gerente/Admin sigue siendo el del vale.
- `06_atraso_taller.sql` ahora rellena solo las filas APROBADAS (con la fecha de su aprobación en `vale_historial`). Aún no se importó en PROD, así que no hay datos a corregir.
- Pruebas: `e2e_sebas` 24/24 (en revisión 5 días corriendo; al desaprobar sigue NULL; al aprobar se congela y baja a 2 días en Trabajo realizado; el Asesor sigue en 5). Reporte del Encargado: en revisión -> atrasados (5 días); aprobado -> entregados sin atraso.
- Fila "Por fusionar" del Encargado: solo muestra al asesor (ya no "Sin asignar").

## Ajustes de Reportes (2026-10-15, pedido del dueño)
- Actividad (Encargado/Asistente y Diseñador): en «Entregados» la columna Atraso (Encargado) / la insignia de Entrega (Diseñador) remarca en amarillo fluorescente al 60 % (`.badge-tarde`) lo entregado con atraso acumulado en su taller (`diasTarde` en la ficha). Lo en revisión ya atrasado sigue en «Atrasados».
- Rendimiento: contador «Atrasados sin entregar» (`atrasadosSinEntregar`: atrasado y no entregado, incluye vales sin diseñador); comparativo del taller con Asignados, Entregados, % efectividad, % a tiempo, Entregas tarde y Sin entregar (Supervisor sin cambios). «% a tiempo» = entregados sin atraso en su taller ÷ entregados (mismo criterio en el contador y en la tabla).
- Se quitó la lectura de aprobaciones del historial (`_aprobacionesDeTaller`): el atraso del taller sale de `vale_talleres.atraso_congelado_en`.
- `06_atraso_taller.sql`: relleno por estado del historial (EN_REVISION -> APROBADO) y zona horaria -06:00 (antes copiaba la hora en la zona del servidor y solo reconocía un texto de historial).
- PDF de Rendimiento con las mismas columnas. El PDF de Actividad no marca en amarillo.
- Definición de las métricas del taller (dueño): entrantes = vales con entrega en la ventana; entregados = de ellos, los que el Encargado YA APROBÓ (en revisión aún no cuenta; con atraso o sin él), en Actividad y en Rendimiento; sin entregar = entrantes - entregados; atrasados sin entregar = los que se arrastran (entrega ANTERIOR a la ventana, abiertos y atrasados) que el taller no ha entregado; % efectividad = entregados / entrantes; % a tiempo = entregados sin atraso en su taller / entregados. Por diseñador: sin entregar = asignados - entregados (antes solo contaba los ya atrasados). Sin «% más bajo» en ningún comparativo (pantalla ni PDF).

## Atraso unificado y datos (2026-10-15, pedido del dueño)
- El atraso del VALE (Asesor, Supervisor, Gerente, Administrador) ahora también termina cuando aprueba el último taller (`_recalcularEstadoVale` -> `congelarAtraso`), ya no cuando el asesor confirma; el del taller (Encargado/Diseñador) termina cuando aprueba su taller. En un vale de un solo taller coinciden; en uno de varios talleres cada Encargado ve el suyo y los demás roles ven el del último. `06_atraso_taller.sql` paso 3 lo aplica a los vales ya aprobados (sin alargar atrasos ya congelados) — cambia el «atraso final» de vales históricos.
- Comparativo del taller: fila «Sin asignar» al inicio (vales de la ventana sin diseñador; no entra en la gráfica) y fila para quien tenga vales aunque no figure entre los diseñadores del taller (p. ej. un asistente). Los totales cuadran con las tarjetas (entrantes, entregados, sin entregar).
- BD LOCAL: reparadas las cronologías incoherentes de vales de prueba de sep–nov (creados después de su entrega, aprobados antes de asignarse, vale confirmado con un taller sin aprobar, atraso del vale anterior a la aprobación); auditoría sin hallazgos. Scripts en el scratchpad de la sesión (no van al repo).

## Rendimiento «hasta hoy» (2026-10-15, pedido del dueño)
- Los contadores y el comparativo del taller solo cuentan vales cuya fecha de entrega ya llegó (entrega <= hoy): un vale que vence después no es «sin entregar» todavía ni entra en el % de efectividad hasta su fecha. Ventanas ya pasadas no cambian; ventanas futuras dan 0 / «—».
- «Atrasados sin entregar» = vencidos de la ventana sin aprobar + los que se arrastran de antes de la ventana. En octubre (hoy 15/10): entrantes 30 -> 22, atrasados sin entregar 2 -> 10, % a tiempo 73,3 % -> 63,6 %.
- Los vales entregados por adelantado (entrega posterior a hoy) no cuentan hasta que llega su fecha.

## Períodos cerrados en Rendimiento (2026-10-15)
- Rendimiento: Semana y Mes solo cuando el período ya cerró (la API responde 400 si no; la barra de período apaga la flecha siguiente, deshabilita semanas/meses en curso y, al pasar a Rendimiento, lleva el período en curso al último cerrado). Día, Hoy y Desde–Hasta siguen abiertos.
- Cifras AL CIERRE (corte = último día del período; hoy si aún no cierra): entregado = aprobado por el Encargado a más tardar en el corte (`vale_talleres.atraso_congelado_en`); atrasado = entrega anterior al corte y sin aprobar al corte. Septiembre medido en la BD local: al cierre 14 de 17 (82,4 %), con el estado de hoy 15 de 17 (88,2 %).
- El reporte avisa «Cifras al cierre del período (dd/mm/aaaa)» o «Cifras al dd/mm/aaaa (período en curso)». Actividad no cambia. El Supervisor: misma restricción de períodos, cifras de hoy (limitación).
- Limitación: el diseñador asignado al cierre se toma del asignado actual.

## Actividad sin «propuesta» (2026-10-15)
- Fuera de Actividad: la etiqueta amarilla «N sin propuesta» de las filas de personas, la columna «Propuesta» de la tabla de vales (pantalla y PDF), el «· N sin propuesta» del encabezado del PDF y el criterio de orden «sin propuesta» (era solo el último desempate: sin asignar > atraso > paso del pipeline). Se conserva `tienePropuesta` porque el botón «Ver vale» abre el visor en la pestaña Propuesta cuando existe. El KPI «Sin propuesta» de los reportes de Asesor/Supervisor (`sinPropuestaAhora`) no se tocó.

## PDF de Actividad reestructurado (2026-10-15)
- «Atrasados antes del período» agrupado como las demás secciones (adiós columna Responsable; la API devuelve `atrasadosVigentes.grupos`, la lista plana sigue para la pantalla). Atraso solo en las secciones de atrasados; entregados con columna «Con atraso» («Sí · 2d» / «No») y fila completa amarilla (rgb 1,1,0 al 60 %) si se entregó con atraso. `diasTarde` ahora también para roles que no son Taller (atraso del vale congelado al aprobar el último taller).
- Orden por sección (servidor, también en pantalla): atrasados por días desc; no entregados por fecha de ingreso asc; entregados con atraso primero (días desc) y luego a tiempo. Las filas (personas/talleres/tiendas) por su primer vale. Se quitó la regla «sin asignar primero».
- Verificado con el Encargado: 4 secciones con 2, 8, 7 y 15 vales; 4 celdas «Sí · Nd» y 4 rectángulos amarillos; sin «Responsable».

## PDF de Actividad: estado simple y «Con atraso» en rojo (2026-10-15)
- La celda Estado del PDF dice «Paso N de 5 · Nombre del paso» (p. ej. «Paso 3 de 5 · Producción»; «Completado» si terminó), sin estado actual ni quién tiene el turno; se retiró el código que dibujaba esos segmentos. En «Con atraso» el «Sí · Nd» va en rojo y negrita, igual que el conteo de los atrasados. Verificado en los PDF de Encargado, Supervisor y Asesor.

## PDF de Rendimiento con colores (2026-10-15)
- Gráfica (solo diseñadores): el % de efectividad de cada persona lleva el criterio de los contadores (rojo < 50 %, ámbar < 90 %, normal si no). Comparativo por diseñador: lo mismo en % efectividad y % a tiempo; Entregas tarde en ámbar y Sin entregar en rojo cuando son mayores que 0 (también en el total). El color se decide con el % redondeado que se ve. La pantalla ya tenía tarde/sin entregar con color; los % individuales de la pantalla no.

## Un solo atraso (2026-10-15, decisión del dueño)
- El atraso es el del VALE, para todos los roles, y termina cuando la propuesta se envía al asesor (estado PENDIENTE_CONFIRMACION): con un taller, al aprobar su Encargado; con varios, en la fusión final (`aprobarGeneral`). Ya no termina al confirmar el asesor ni al aprobar cada taller. Se retiró el atraso «por taller» (`enriquecerParaFila`, `atrasoEnTaller`); `vale_talleres.atraso_congelado_en` queda solo como la hora en que el Encargado aprobó (sirve para saber cuándo se entregó el taller y para las cifras al cierre).
- Rendimiento: «entregas tarde» / «% a tiempo» usan ese atraso del vale (con corte al cierre en períodos cerrados). En septiembre (BD local) el % a tiempo pasó de 100 % a 78,6 %: 3 vales entregados con atraso (MTC-RR-138 4 d, MTS-NM-104 2 d, MTC-KO-121 1 d) por contar hasta la fusión.
- `06_atraso_taller.sql` paso 3: el atraso del vale se fija en la primera vez que pasó a PENDIENTE_CONFIRMACION (historial), sin alargar uno ya congelado. Cambia el «atraso final» de vales históricos.
- Pruebas: flujo real 31/31 (con varios talleres NO se congela al aprobar los talleres; sí en la fusión), Sebas 24/24 (el asesor ve el mismo atraso que el Encargado), concurrencia 6/6.

## Supervisor y Asesor alineados con el taller (2026-10-15)
- Rendimiento del Supervisor al cierre del período (todos los roles usan el mismo corte): creados / autorizados (`autorizado_en` <= corte) / atrasados al cierre. Verificado contra la BD en 4 asesores de septiembre: coinciden.
- Lista del Asesor y del Diseñador (`_listado`): mismo orden por sección que el taller (atrasados por días; no entregados por fecha de ingreso; entregados con atraso primero) y PDF con Atraso solo en atrasados y «Con atraso» (rojo) con la fila amarilla en entregados.
- Decidido: una vez enviada la propuesta al asesor (PENDIENTE_CONFIRMACION o más) el vale está ENTREGADO y no acumula atraso: va a «Entregados» (con «Con atraso» si llegó tarde) para Supervisor, Gerente, Administrador y Asesor, con las mismas 4 secciones que el taller. En la BD local, los 11 vales así pasaron a Entregados (6 con atraso); «Atrasados en el período» del Supervisor bajó de 22 a 17. Quedan pendientes los contadores del Buzón (`Atrasados`), que aún cuentan esos vales.

## Columna Atraso en Entregados para todos los roles (2026-10-15)
- La pantalla de Actividad del Supervisor/Gerente/Administrador ahora tiene la columna Atraso en «Entregados» (días en rojo o «Al día»), como el taller. El Asesor ya lo mostraba junto a la fecha de entrega. Corregido de paso: la restricción de períodos cerrados solo aplica a quien tiene Rendimiento (antes el Asesor heredaba la vista recordada de otro usuario del navegador).

## Para desplegar
Importar en PROD ANTES, además de los 4 scripts de la rama anterior: `atraso_taller` (`06_atraso_taller.sql`, idempotente, agrega `vale_talleres.atraso_congelado_en` y rellena las filas ya aprobadas). El número 06 choca con `06_quitar_rendimiento`; se cita por nombre.

## No probado
- Reportes del Encargado/Diseñador con la regla de atraso del taller por la interfaz (el del Encargado se probó por API; el del Diseñador solo por lectura del código, porque ese rol no tiene permiso de reportes). Un vale ya aprobado por su taller no muestra su atraso congelado en los reportes (queda en «entregados» sin atraso).
- `e2e_merge` y `e2e_reportes_roles` (de la ronda anterior) dan fallos por expectativas desactualizadas: fusión sin archivo (ahora debe dar 400), permisos de reportes que mi BD local tiene concedidos a roles 2-5, y agrupaciones por rol. No son regresiones del merge.

## Rendimiento del Supervisor: comparativo por asesor
- [x] Columnas Creados, Autorizados, % autorización, Recibidos sin atraso, Recibidos con atraso y Sin recibir (pantalla, PDF y API); TOTAL sin % . Verificado en septiembre al cierre contra la BD: 20 creados, 18 autorizados, 12+2 recibidos, 6 sin recibir; PDF con los encabezados nuevos.
