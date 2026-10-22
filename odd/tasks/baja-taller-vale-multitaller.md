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
- Frontend: el botón «Dar de baja a este taller» (con confirmación que explica las consecuencias) vive ahora en el modal «Dar de baja» del vale multitaller (ver T5), no en la ventana de adjuntos.

## Tareas
- [x] T1 Backend: servicio, repositorio, controlador y ruta de baja de un taller (permiso `vales.dar_de_baja`, dueño). Commit d5a956a.
- [x] T2 Frontend: botón y confirmación en la ventana de adjuntos del asesor + función de API. Commit dedbcb8.
- [x] T3 Documentación (flujo §2.1 y documento propio). Commit: ver git log.
- [x] T5 Frontend: botón «Dar de baja» unificado (modal con talleres + vale completo); se retira el botón de la ventana de adjuntos; campo `talleres_estado` en el buzón del asesor. Commit: ver git log (feat botón dar de baja).
- [x] T4 Baja automática del taller cuyo plazo de adjuntos vence (watcher) en vale multitaller; último taller o `MOD-` borra el vale como antes. Aviso del 25 % siempre en multitaller; se quita `protegido`. Commit: ver git log (feat baja automática).

## Decisiones de T4 (del usuario)
- Vence el plazo de un taller en «adjuntos rechazados» con 2+ talleres activos: se da de baja solo ese taller (núcleo `quitarTallerDeVale`, actor sistema), uno por uno; el último taller borra el vale.
- Aviso del 25 % siempre en multitaller; el modal del asesor anuncia la baja del taller con fecha.
- Historial: `usuario_id` es NOT NULL y el único precedente usa el asesor del vale; se registra el asesor con «(automático)». Sin migración.

## Decisiones de T5 (del usuario)
- El icono «Dar de baja» del buzón se unifica: en un vale multitaller (2+ talleres activos, no `MOD-`) con algún taller en adjuntos rechazados/respondidos abre un modal que lista todos los talleres con su estado y ofrece «Dar de baja a este taller» (solo en los rechazados/respondidos) y «Dar de baja el vale completo». En los demás casos abre directo la confirmación del vale completo.
- Se quita el botón por tarjeta de la ventana de adjuntos. El buzón del asesor trae `talleres_estado` [{taller_id, taller, estado}].

## Checks
Sin suite de tests (excepción a RED/GREEN). `node --check`; un script desechable contra una BD temporal para la lógica (dueño, estados, último taller, recálculo del estado). Verificación en navegador la decide el usuario.

## Progreso
b3ef5d2, T1 (d5a956a), T2 (dedbcb8) y T3 hechos. Verificación: node --check y script contra BD temporal (dueño, estados, único taller, MOD-, recálculo a fusión/confirmación, historial); endpoints y UI sin probar. T4 hecho (commit ver git log (feat baja automática)): node --check y script contra BD temporal (baja de A con B en proceso y con B verificando, A y B vencidos, un taller, aviso del 25 % multitaller y de un taller); HTTP y UI sin probar. T5 hecho: node --check del backend y sintaxis de los módulos del navegador; imports/exports revisados a mano; UI sin probar en navegador. Pregunta abierta: MOD- se rechaza (no se quita taller de una solicitud de modificación).
