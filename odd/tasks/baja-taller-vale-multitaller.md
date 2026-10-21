# Baja de un taller en un vale multitaller

Rama: `fix/adjuntos-aviso-y-texto-vencido` (desde dev 38c1870; ya trae b3ef5d2: aviso del 25 % no se marca si otro taller protege y texto aclaratorio al asesor). Sin push.

## Objetivo
Cuando un taller rechaza los adjuntos de un vale multitaller, el asesor dueño puede dar de baja SOLO a ese taller: el vale sigue para los demás y, si todos los que quedan terminan, llega a fusión. Dar de baja el vale completo sigue existiendo.

## Decisiones (del usuario)
- Solo el asesor dueño del vale puede dar de baja a un taller.
- Mismos estados que la baja de un vale normal: el taller debe estar en «adjuntos rechazados» o «adjuntos respondidos».
- No se resetea el plazo de 4 horas laborales; el segundo rechazo con plazo vencido queda como está (problema aceptado).
- El caso «otro taller no sabe que el vale corre riesgo» no se atiende (no es crítico).
- Ya hechos en b3ef5d2: el aviso del 25 % no se marca si otro taller protege, y el asesor lee «sigue esperando tu respuesta» en vez de una fecha de borrado cuando otro taller protege.

## Reglas de diseño
- Solo vales con 2 o más talleres activos; si es el último taller activo, el error indica usar la baja del vale completo.
- Se desactiva la fila del taller (`vale_talleres.activo = 0`), como el runbook manual «quitar un taller de un vale» (en Engram y en la memoria del proyecto); no se borra el vale ni a los demás talleres.
- Se recalcula el estado general del vale con la misma lógica que usa el flujo normal (si los que quedan ya están aprobados, pasa a fusión con 2 o más talleres, o al paso siguiente si queda uno).
- Bajo `valeMutex.conLockDeVale`, con historial y notificación al taller dado de baja, al supervisor y al asesor.
- Frontend: en la ventana de adjuntos rechazados del asesor, cada taller en esos estados, en un vale con 2 o más talleres, ofrece «Dar de baja a este taller» con confirmación que explica las consecuencias.

## Tareas
- [x] T1 Backend: servicio, repositorio, controlador y ruta de baja de un taller (permiso `vales.dar_de_baja`, dueño). Commit d5a956a.
- [x] T2 Frontend: botón y confirmación en la ventana de adjuntos del asesor + función de API. Commit dedbcb8.
- [x] T3 Documentación (flujo §2.1 y documento propio). Commit: ver git log.

## Checks
Sin suite de tests (excepción a RED/GREEN). `node --check`; un script desechable contra una BD temporal para la lógica (dueño, estados, último taller, recálculo del estado). Verificación en navegador la decide el usuario.

## Progreso
b3ef5d2, T1 (d5a956a), T2 (dedbcb8) y T3 hechos. Verificación: node --check y script contra BD temporal (dueño, estados, único taller, MOD-, recálculo a fusión/confirmación, historial); endpoints y UI sin probar. Pregunta abierta: MOD- se rechaza (no se quita taller de una solicitud de modificación).
