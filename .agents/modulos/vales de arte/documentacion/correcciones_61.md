# Correcciones 61 — Propuestas de otros talleres: cierre de fuga en el API

Rama: `fix/propuesta-otros-talleres`.

## Qué cambia

- **Fuga cerrada:** `GET /api/vales/:id/propuesta` solo comprobaba que el taller del usuario participara en el vale; un encargado, asistente o diseñador podía leer la propuesta de otro taller (`tipo=taller&disenadorId=…` o `tipo=ultima`) aunque estuviera `EN_REVISION` o el taller no compartiera. Ahora ve su propio taller y, de los otros, solo la última aprobada de los hermanos que comparten (`propuestasCompartidasService.alcanceDePropuestas`); lo demás responde 403, y `ultima` devuelve la última permitida o `ninguna`.
- **Sin cambios** para asesor, supervisor, Administrador, Gerente, la fusión (`tipo=general`) ni quien tiene `vales.aprobar_general` mientras el vale está en `APROBADO_DEPARTAMENTO` (necesita todas las propuestas para fusionar); en cualquier otro estado ese usuario rige por la regla de taller.
- **Baja de taller y adjuntos, errores de permiso en 403:** `valeAdjuntosService` respondía 400 cuando alguien que no era el asesor dueño (o no tenía el rol) intentaba dar de baja un taller, responder sobre adjuntos o escribir en la conversación; ahora responde 403. Los conflictos de estado siguen en 400. Probado la baja manual y la automática por plazo vencido (con otros talleres en «Adjuntos respondidos» o ya aceptados, y con el último taller activo, que borra el vale).
- **Documentación:** el flujo describe «Propuestas de otros talleres» como visor con pestañas (no modal) y cita el script `database/migrations/comparte_propuestas.sql` (sin correlativo, carpeta nueva).
