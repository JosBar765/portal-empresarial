-- quitar_permisos_sin_uso.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Retira dos permisos que el código ya no consulta: `vales.editar` y `vales.responder_modificacion_basica`.
--   Las tablas `vale_modificaciones_basicas` y `vale_modificacion_mensajes` no se tocan.
--
-- Qué hace (solo datos; no cambia el esquema):
--   Borra los dos permisos de `rol_permisos` y después de `permisos`.
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/migrations/<correlativo>_quitar_permisos_sin_uso.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Los usuarios deben cerrar sesión e iniciar de nuevo para que su token refleje los permisos.
--
-- Cómo se revierte (solo si hiciera falta; recrea los dos permisos y los devuelve a los roles que los tenían):
--   Al escribir este script los tenían (según seed.sql y las migraciones modificaciones_por_tipo y rechazo_propuesta):
--     - `vales.editar`: el rol 2 (asesor) en seed.sql.
--     - `vales.responder_modificacion_basica`: los roles con `vales.verificar_adjuntos` (encargados y asistentes de taller).
--   INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
--   SELECT v.`codigo`, v.`nombre`, 'vales', v.`descripcion` FROM (
--     SELECT 'vales.editar' AS `codigo`, 'Editar Vales de Arte' AS `nombre`, 'Permite modificar el contenido de un vale de arte (formulario de modificación)' AS `descripcion`
--     UNION ALL SELECT 'vales.responder_modificacion_basica', 'Responder Modificación Básica', 'Permite al encargado de taller conversar, aceptar o rechazar una modificación básica solicitada por el asesor'
--   ) v WHERE NOT EXISTS (SELECT 1 FROM `permisos` x WHERE x.`codigo` = v.`codigo`);
--   INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
--   SELECT 2, p.`id` FROM `permisos` p
--   WHERE p.`codigo` = 'vales.editar' AND EXISTS (SELECT 1 FROM `roles` r WHERE r.`id` = 2)
--     AND NOT EXISTS (SELECT 1 FROM `rol_permisos` x WHERE x.`rol_id` = 2 AND x.`permiso_id` = p.`id`);
--   INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
--   SELECT rp.`rol_id`, pn.`id` FROM `rol_permisos` rp
--   JOIN `permisos` pv ON pv.`id` = rp.`permiso_id` AND pv.`codigo` = 'vales.verificar_adjuntos'
--   JOIN `permisos` pn ON pn.`codigo` = 'vales.responder_modificacion_basica'
--   WHERE NOT EXISTS (SELECT 1 FROM `rol_permisos` x WHERE x.`rol_id` = rp.`rol_id` AND x.`permiso_id` = pn.`id`);

SET NAMES utf8mb4;

DELETE rp FROM `rol_permisos` rp
JOIN `permisos` p ON p.`id` = rp.`permiso_id`
WHERE p.`codigo` IN ('vales.editar', 'vales.responder_modificacion_basica');

DELETE FROM `permisos`
WHERE `codigo` IN ('vales.editar', 'vales.responder_modificacion_basica');
