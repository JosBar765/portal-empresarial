# Vales vencidos pasan a borrador

Rama: `feature/vencidos-a-borrador` (desde `dev`). Estado: mergeado a dev (PR #176). Engram: `odd/vencidos-a-borrador/tasks`.

## Problema
Los asesores no ven la notificación cuando un vale vence y pierden lo que escribieron.

## Decisiones del dueño (2026-11-13)
- Los vales que vencen por vigencia (esperando autorización o rechazado) y por adjuntos (cuando se borra el vale entero) pasan a un borrador del asesor. Las modificaciones (MOD-) se borran de una, sin borrador, pero siempre con su registro en `vale_bajas`.
- El borrador por vencimiento cuenta para el tope de borradores pero NO se rechaza por tope (opción b: se guarda aunque el asesor ya tenga el máximo) y caduca a los 30 días como cualquier borrador.
- Se copian las imágenes y PDF adjuntos; si la copia falla, no bloquea: el borrador queda solo con los datos y el vale se borra igual.
- El borrador conserva el correlativo de origen; el vale que se reenvíe tendrá un correlativo nuevo y revalida todas las reglas (incluida la fecha de entrega).
- Multitaller: el borrador lleva todos los talleres solicitados originalmente. Si un vale con 2+ talleres solo pierde un taller por adjuntos, el vale sigue vivo y no hay borrador.
- `vale_bajas` guarda además la fecha de entrega que se quería y el motivo de rechazo (solo en la base, el asesor no lo ve en el borrador). También se registra cuando se quita UN taller de un vale multitaller (manual o automático). Los vales cuya creación falla NO se registran.
- Aviso al asesor: texto nuevo («Venció, pero lo guardamos en tus Borradores») con enlace que abre la lista de borradores, y una insignia (globito) sobre el botón «Borradores» con los borradores nuevos por vencimiento hasta que los abre.

## Tareas
- [x] B1 Migración `36_vencidos_a_borrador.sql`. Evidencia: aplicada dos veces en `retencion_test`, columnas presentes, sin error.
- [x] B2 Registro (probado en `retencion_test`): `vale_bajas` con fecha de entrega, motivo de rechazo, taller y borrador; registro al quitar un taller.
- [x] B3 Borrador desde un vale vencido (datos + archivos en mejor esfuerzo), sin bloquear el vencimiento. Probado con tope lleno, MOD- y falla de copia de archivos.
- [x] B4 Aviso: notificación nueva con enlace, insignia en el botón y borradores marcados «nuevos». Backend probado; el frontend se verifica en B6 (sin navegador aún).
- [x] B5 Pruebas mínimas (caja negra) y documentación.
- [x] B6 Demostración visual en el navegador para el dueño (aprobada el 2026-11-13).
