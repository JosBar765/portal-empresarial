# fix/permisos: unificar los permisos del asesor dueño bajo `vales.crear`

Rama: `fix/permisos` (publicada como `fix/permisos2`). Estado: **MERGEADO a dev (PR #164)**, junto con la agrupación del supervisor, del encargado de taller y del cupo (migraciones 27 a 31). Probado el 2026-11-05. Los 11 commits de este plan ya están en `dev`: b3ef7d4, c2f285c, 2ab48bc, 0f297a7, 1e21d3b, f20d17c, 0145511, 0da8d17, 398805d, 8b575b0, 632ddf9 (migraciones 27 y 28). Verificado contra dev y con encargado, diseñador y gerente con `vales.crear`. El PR #164 lo mergeó el dueño.

## Objetivo
Quien tenga `vales.crear` administra sus vales de arte sin permisos extra. Se fusionan en `vales.crear`:
`vales.corregir`, `vales.confirmar`, `vales.solicitar_modificacion`, `vales.rechazar_propuesta`.
`vales.dar_de_baja` queda atómico (decisión del dueño).

## Alcance
- Solo el grupo del asesor. Los grupos del encargado de taller y del supervisor, y el borrado de permisos sin uso
  (`vales.editar`, `vales.responder_modificacion_basica`), quedan para otra pasada.
- Fuente de verdad del estado de la BD: las migraciones, no `schema.sql`/`seed.sql` (estado inicial del host).
- Un solo commit (Conventional Commits en español, sin atribución de IA).

## Tareas
- [x] T1. Verificar la matriz rol↔permiso real (migraciones + BD local, solo SELECT): ningún rol debe ganar ni perder acciones.
- [x] T2. Migración `database/migrations/NN_permisos_asesor_en_crear.sql` (aditiva, idempotente): dar `vales.crear` a todo rol que tenga alguno de los cuatro; borrar los cuatro permisos y sus `rol_permisos`.
- [x] T3. Backend: `routes.js` y servicios que citan los permisos viejos pasan a `vales.crear` (chats incluidos). El chequeo de dueño (`asesor_id`) se mantiene.
- [x] T4. Frontend: `permisos.js` decide por permiso `vales.crear` (crear, confirmar, solicitarModificacion, corregir, rechazarPropuesta).
- [x] T5. Docs: `flujo_vale_de_arte.md` actualizado con el permiso unificado.
- [x] T6. Un commit en `fix/permisos`.
- [x] T7. Prueba con UN vale (`ventas1@`, supervisor con fila en `asesores`): crear, autorizar, flujo completo y acciones del asesor.

## Fase 2 (2026-11-05): acciones derivadas de crear sin exigir rol 2 o 3
Commit `c2f285c` (hecho): `listarAsesoresPorSupervisor` ya no filtra `rol_id = 2`; el supervisor ve vales de cualquier usuario con fila en `asesores` y `vales.crear`. Confirmado por el dueño con el gerente general.
- [x] T8. `puedeActuarComoAsesor` y gates por rol de corregir/reenviar/adjuntos/modificación pasan a permiso `vales.crear` + chequeo de dueño (`asesor_id`); visibilidad del detalle para el dueño; revisar salas de sockets (el dueño confirmó que al gerente sí le llegó la notificación del rechazo).
- [x] T9. Prueba con el gerente general (rol distinto de 2 y 3, con `vales.crear` y fila en `asesores`) usando UN vale: crear, corregir, reenviar, adjuntos, rechazo de propuesta, confirmar, solicitar modificación y baja; control negativo con un rol sin `vales.crear`.

## Fase 3 (2026-11-05): vales.crear aplicable a cualquier rol
Commits previos: `2ab48bc` (acciones del dueño por permiso), `0f297a7` (el dueño ve sus acciones en el buzón). Objetivo del dueño: `vales.crear` se puede asignar a CUALQUIER rol; quien lo tenga crea vales y administra toda acción que gire alrededor de crear. Su tienda sale de su fila en `asesores` (talleres generales + el Diseño Local de esa tienda si lo hay). El supervisor y el asesor (roles 2 y 3) no cambian.
- [x] T10. Catálogo de talleres y cupo/fechas de entrega para el creador de cualquier rol: la tienda sale de `asesores`, no del rol (`valeCatalogoService.js:45`, `capacidadEntregaService.js:72-126`).
- [x] T11. Vista «Mis vales» (buzón activo) para roles con `vales.crear` que no son asesor ni supervisor: carga aparte `asesorIds: [yo]`, reutiliza `_buzonAsesor`; contadores y pipeline con etiquetas del asesor (no las del taller).
- [x] T12. «Trabajo realizado» mezclado para esos roles: vales trabajados por/para él y vales propios terminados (segundo commit, tras probar T11).
- [x] T13. Comparar contra `dev`: mismas pruebas con el código de `dev` (permisos viejos restaurados en la BD local) y con `fix/permisos`.

## Rutas
Inline: T-doc. Delegado (un escritor): T1-T6, por tocar 2+ archivos no triviales y leer para preparar la escritura.

## Evidencia (2026-11-05)
- T1-T6 hechas: commit `b3ef7d4` en `fix/permisos` (6 archivos, +72/-22), migración 27. Matriz derivada de migraciones y confirmada en la BD local: solo roles 2 y 3 tenían los cinco permisos.
- T7 hecha: migración aplicada a la BD local con `npm run migrate` (aplicó también 24, 25 y 26 que estaban pendientes). Servidor reiniciado en el puerto 3000.
- Prueba con UN vale (id 9206, GT-MTC-1126-9206, RECIBIDO) creado por `ventas1@` (supervisor con fila en `asesores`): crear, autorizar, rechazar/cancelar propuesta, confirmar y solicitar modificación sin ningún 403 de permiso. Controles negativos: encargado 403 por permiso; `ventas2@` 403 sobre vale ajeno.
- No probado: segundo ciclo de la modificación (500 por nombre de archivo ya ocupado en Storage de pruebas, no por permisos), escribir en el chat de un rechazo con la ronda abierta, botones en navegador.
- Resuelto después en el mismo PR: `scripts/security/pruebas-fase1.js` ya no cita `vales.confirmar`.
