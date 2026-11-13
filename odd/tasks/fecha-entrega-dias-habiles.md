# Fecha de entrega con días hábiles (sin entrega de hoy para hoy)

Estado: mergeado a dev (PR #175). Rama: `feature/fecha-entrega-dias-habiles` (sobre `feature/diseno-local-entre-paises`, que aporta la base del Diseño Local por país). Engram: `odd/fecha-entrega-dias-habiles/tasks`.

## Regla del dueño (2026-11-13)
- Se acabó la entrega de hoy para hoy.
- Se cuentan días de TRABAJO del taller. El día de ingreso cuenta como el primero solo si el vale entra ANTES de la hora máxima de recibimiento del taller; si entra después (o en día no hábil), arranca el siguiente día hábil.
- Fecha de entrega mínima = el día hábil siguiente al último día de trabajo contado. Vale normal: 3 días de trabajo. Urgente: mínimo 1 día de trabajo (menos de 3, pero siempre 1), con la misma regla de la hora. Las modificaciones: urgente = 1 día con esta regla; las demás conservan sus mínimos propios (básica 1, media 2, avanzada 3).
- Día hábil = lunes a viernes que no sea feriado. Sábado, domingo y feriados nacionales NO cuentan. Los feriados y horarios son los del país del taller (revisado el 2026-11-13: ya no los de la tienda del asesor).
- Ejemplos (hora límite 12:00): lunes 9:00 normal → entrega jueves; urgente → martes. Lunes 15:00 normal → viernes; urgente → miércoles.

## Supuestos (revisados con el dueño el 2026-11-13)
- Al autorizar o reenviar se re-verifica la regla COMPLETA con el reloj de ese momento (vale normal 3, urgente 1, MOD su mínimo); si ya no se cumple, se rechaza el vale como hasta ahora.
- Ingreso en día no hábil (sábado/domingo/feriado): cuenta desde el siguiente día hábil, como un viernes por la tarde, para todos (MOD incluidas).
- El plazo de 4 horas laborales (vigencia/adjuntos) no cambia.

## Tareas
- [x] F1 Regla pura en `calendarioLaboral.js` (normal 3, urgente 1, MOD sin cambios), feriados del país del taller. Revisión 2026-11-13: ingreso en día no hábil unificado también para MOD (sáb 10:00 con 3 días → jueves; `fe_prueba2.js`, MOD en día hábil idéntica a 27997a2 en 9.450 combinaciones salvo ingresos en día no hábil), feriados por país del taller (revertido el país de la tienda). Evidencia: script de caja negra (scratchpad `fe_prueba.js`) con 13 casos de ingreso/feriado/país/varios talleres OK, 2.646 combinaciones sin devolver hoy, y 5.670 combinaciones de MOD (n=1,2,3, minima y noDisponibles) idénticas a la función de `HEAD`.
- [x] F2 Validación al crear/corregir/reenviar/autorizar/borrador y `fechasEntregaService`/API (motivos) coherentes. Revisión 2026-11-13: autorizar y reenviar re-verifican la regla completa (martes 17:30/lunes: acepta el miércoles 10:00, rechaza el miércoles 14:00; urgente y MOD también). Evidencia: `validarFechaEntrega` rechaza hoy, fecha pasada, antes de la mínima, sábado y feriado con mensaje explicativo y acepta la mínima exacta; reenvío y autorización usan las mismas opciones que al crear; el borrador no cambia. `node --check` de todos los servicios.
- [x] F3 Frontend: textos del formulario y mínima/nota del calendario (los días salen de `diasHabiles` de la respuesta de la API). Evidencia: `node --check` de `valeForm.js`; sin prueba en navegador (la hace el dueño).
- [x] F4 Pruebas mínimas (caja negra) y documentación (`flujo_vale_de_arte.md` §5.1, `horarios_feriados.md`, `documentacion/fecha_entrega_dias_habiles.md`).
