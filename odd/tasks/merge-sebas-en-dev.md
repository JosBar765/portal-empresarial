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

## Para desplegar
Importar en PROD ANTES, además de los 4 scripts de la rama anterior: `atraso_taller` (`06_atraso_taller.sql`, idempotente, agrega `vale_talleres.atraso_congelado_en` y rellena las filas ya entregadas). El número 06 choca con `06_quitar_rendimiento`; se cita por nombre.

## No probado
- Reportes del Encargado/Diseñador con la regla de atraso congelado por la interfaz (solo por API y lectura del código; el Diseñador no tiene permiso de reportes).
- `e2e_merge` y `e2e_reportes_roles` (de la ronda anterior) dan fallos por expectativas desactualizadas: fusión sin archivo (ahora debe dar 400), permisos de reportes que mi BD local tiene concedidos a roles 2-5, y agrupaciones por rol. No son regresiones del merge.
