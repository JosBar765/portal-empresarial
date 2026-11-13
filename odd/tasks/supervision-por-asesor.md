# Supervisión asignada a un asesor

Rama: `feature/supervision-por-asesor` (desde `dev`). Estado: mergeado a dev (PR #173). Engram: `odd/supervision-por-asesor/tasks`.

## Problema
Un asesor de El Salvador (tienda SSV) ve licitaciones y SOLO las autorizan los supervisores generales de Centroamérica, no los de su tienda. Hoy la autorización se decide por la tienda del asesor (`supervisor_tiendas`).

## Decisión del dueño (2026-11-10)
- Tabla `asesor_supervisores(asesor_id, supervisor_id)`, administrable desde el admin. Si un asesor tiene supervisores asignados, ELLOS autorizan EN LUGAR DE los de su tienda; sin filas, todo igual que hoy. Nada hardcodeado.
- Cambiar la asignación con vales esperando: el vale sigue a la asignación vigente (la autorización se calcula al autorizar). Al cambiar: se notifica a los supervisores que quedan a cargo por cada vale pendiente y el admin ve una advertencia con el número de vales y los supervisores antes de confirmar.
- Asegurar el mutex al cambiar de unos supervisores a otros.
- Sin mockup en Figma: se reutiliza el estilo del admin.

## Tareas
- [x] S1 Migración `34_asesor_supervisores.sql` (aplicada dos veces en `retencion_test` sin error; tabla vacía).
- [x] S2 `usuarioValeRepository.obtenerSupervisoresDeAsesor` y `listarAsesoresPorSupervisor` coherentes con la tabla nueva (y demás puntos de alcance que la usen). Evidencia: 52 asesores y 13 supervisores idénticos a la consulta antigua sin asignaciones; con asignación, coherentes en ambos sentidos; `tallerRepository.listarIdsPorSupervisor` y `reporteRepository.listarTiendasPorSupervisor` suman las tiendas de los asesores asignados.
- [x] S3 Admin: endpoints y modal en la ficha del asesor, con advertencia y notificación a los supervisores nuevos; cambio bajo `valeMutex` (`conColaDeCreacion` + `conLocksDeVales`). Frontend sin probar en navegador (lo verifica el dueño).
- [x] S4 Pruebas mínimas en `retencion_test` (casos a-e, TODO OK, datos de prueba revertidos) y documentación (`documentacion/supervision_por_asesor.md`, README admin, flujo de vales).
