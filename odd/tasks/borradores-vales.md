# Borradores de vales de arte

Rama: `feat/vales-borrador` (desde dev ab9cef0). Sin push.

## Objetivo
Quien tenga `vales.crear` (asesores y supervisores) puede «Guardar como borrador» desde el modal «Crear vale de arte», sin fecha ni campos obligatorios. El borrador vive 30 días desde su creación (no se renueva al editarlo) y se borra solo con sus archivos. Antes de mandarse a autorizar pasa por exactamente las mismas validaciones de un vale real (`crearVale`), incluida la fecha de entrega.

## Decisiones (todas del usuario)
- Los borradores NO son vales: tabla aparte (`vale_borradores` + `vale_borrador_documentos`), sin correlativo. El correlativo real nace al enviarlo a autorizar.
- Adjuntos del borrador en un bucket distinto (`SUPABASE_STORAGE_BUCKET_BORRADORES`), nombrados con un id genérico del borrador (`BORRADOR-<id>_...`). Al enviarlo se pasan al bucket normal con el nombre definitivo `{CORR}_...` y se borran del bucket de borradores.
- Nada obligatorio para guardar un borrador, pero no se guarda uno completamente vacío (al menos un campo o un adjunto).
- Privado: solo su dueño lo ve y lo edita (ni otros asesores ni supervisores). Reutiliza el permiso `vales.crear`; sin permisos nuevos.
- UI: botón «Guardar como borrador» en el modal y botón «Borradores (n)» junto a «Crear vale de arte» que abre una lista en modal (título, creado, «Vence en N días», en rojo con 3 o menos; abrir y eliminar). Sin pestaña en el buzón, sin sockets, sin notificaciones.
- Tope de borradores por usuario: 15, editable por el Administrador desde Horarios y feriados (`parametros_sistema`). Los 30 días son una constante.
- Sin aviso previo al vencimiento; solo se ve en la lista.
- Límites de archivos: los mismos de crear un vale (5 MB c/u, imágenes y PDF).

## Tareas
- [ ] T1 Migración idempotente `database/borradores_vales.sql` (tablas, parámetro `max_borradores_por_usuario`=15) + `schema.sql`.
- [ ] T2 Storage con segundo bucket (env `SUPABASE_STORAGE_BUCKET_BORRADORES`, subir/eliminar/descargar por bucket).
- [ ] T3 Backend: repositorio, servicio, controlador y rutas `/api/vales/borradores` (listar, obtener, crear, editar, eliminar) y envío (`crearVale` con `borradorId`).
- [ ] T4 Watcher de expiración de borradores.
- [ ] T5 Tope editable en el panel admin.
- [ ] T6 Front: botón en el modal, lista de borradores, precarga y envío.
- [ ] T7 Documentación.

## Checks
Sin suite de tests (excepción a RED/GREEN). `node --check`, script desechable contra una BD temporal con Storage simulado (tope, dueño, expiración, envío), verificación visual la hace el usuario.

## Progreso
T1-T7 implementadas y commiteadas. Verificado: node --check, script contra BD temporal con Storage simulado (vacío, tope, dueño, expiración, envío ok/fallo, doble envío). Pendiente: prueba manual de HTTP/UI por el usuario.
