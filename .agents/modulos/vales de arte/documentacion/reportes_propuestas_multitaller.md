# Reportes: propuestas por taller en los vales multitaller

## Qué cambió
El ojo de Reportes abría el visor con una sola pestaña «Propuesta» (la última de cualquier taller). En un vale con 2 o más talleres activos ahora abre el mismo visor que el modal de fusión del encargado.

## Comportamiento
- Pestañas: «Vale de arte», «Propuesta <Taller>» y «Propuesta fusionada».
- Por taller se muestra la última propuesta con archivo de su diseñador (nota y enlaces incluidos). Un taller sin propuesta entregada no tiene pestaña; uno dado de baja no cuenta.
- «Propuesta fusionada» aparece si el vale tiene documento, nota o enlaces de fusión.
- Vale `MOD-`: solo sus propias propuestas, sin mezclar las del original.
- Vale de un solo taller: sin cambios.

## Implementación
- `valeReporteGruposService.js`: la ficha lleva `multitaller` (2+ talleres activos distintos; sin filas aún, usa los solicitados).
- `reportes.js`: los ojos llevan `data-multitaller` y usan `abrirVisorMultitaller`.
- `actions/propuestasMultitaller.js`: el visor y `propuestaDe`, compartido con el modal de fusión (`encargado.js`) sin cambiar su comportamiento.
- Acceso: lo resuelve `GET /api/vales/:id` (`_puedeVerVale`); los reportes por rol siguen listando solo sus vales.
