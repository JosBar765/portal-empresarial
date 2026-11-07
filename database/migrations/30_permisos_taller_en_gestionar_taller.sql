-- permisos_taller_en_gestionar_taller.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Fusiona en `vales.gestionar_taller` los permisos del encargado de taller y de su asistente: `vales.asignar`,
--   `vales.revisar`, `vales.verificar_adjuntos` y `vales.responder_rechazo_propuesta`. Quien tiene `vales.gestionar_taller`
--   asigna vales a diseñadores, revisa propuestas, verifica adjuntos y responde los rechazos de propuesta de su taller
--   (qué taller es el suyo sigue siendo dato: `talleres.encargado_id` y `taller_disenadores`). En producción los cuatro
--   permisos los tenían solo los roles 4, 5, 7, 9, 10, 11, 12 y 13, siempre juntos. `vales.trabajar` (lo tienen también
--   los diseñadores) y `vales.aprobar_general` no se tocan.
--
-- Qué hace (solo datos; no cambia el esquema):
--   1. Crea `vales.gestionar_taller` si no existe.
--   2. Lo da a todo rol que tenga `vales.asignar` o `vales.revisar` (los que definen al encargado y a su asistente) y aún no lo tenga. Un rol que tenga suelto `vales.verificar_adjuntos` o `vales.responder_rechazo_propuesta` (p. ej. un asesor) NO lo recibe: esos dos se retiran sin sustituirlos.
--   3. Borra los cuatro permisos de `rol_permisos` y de `permisos`.
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/migrations/<correlativo>_permisos_taller_en_gestionar_taller.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Importar justo antes de desplegar el código nuevo. Los usuarios deben cerrar sesión e iniciar de nuevo para que su
--   token refleje los permisos.
--
-- Cómo se revierte (solo si hiciera falta; recrea los cuatro permisos y se los da a los roles que tienen `vales.gestionar_taller`;
--   el nombre y la descripción de `vales.responder_rechazo_propuesta` son aproximados porque ningún script versionado los define):
--   INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
--   SELECT v.`codigo`, v.`nombre`, 'vales', v.`descripcion` FROM (
--     SELECT 'vales.asignar' AS `codigo`, 'Asignar Vales de Arte' AS `nombre`, 'Permite asignar/reasignar un vale de arte a un diseñador' AS `descripcion`
--     UNION ALL SELECT 'vales.revisar', 'Revisar Propuestas', 'Permite aprobar o desaprobar la propuesta de un diseñador'
--     UNION ALL SELECT 'vales.verificar_adjuntos', 'Verificar Adjuntos', 'Permite al encargado de taller confirmar que recibió los adjuntos de un vale de arte o rechazarlo por no haberlos recibido'
--     UNION ALL SELECT 'vales.responder_rechazo_propuesta', 'Responder Rechazo de Propuesta', 'Permite al taller responder, aceptar o rechazar el rechazo de una propuesta'
--   ) v WHERE NOT EXISTS (SELECT 1 FROM `permisos` x WHERE x.`codigo` = v.`codigo`);
--   INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
--   SELECT rp.`rol_id`, pn.`id` FROM `rol_permisos` rp
--   JOIN `permisos` pc ON pc.`id` = rp.`permiso_id` AND pc.`codigo` = 'vales.gestionar_taller'
--   JOIN `permisos` pn ON pn.`codigo` IN ('vales.asignar', 'vales.revisar', 'vales.verificar_adjuntos', 'vales.responder_rechazo_propuesta')
--   WHERE NOT EXISTS (SELECT 1 FROM `rol_permisos` x WHERE x.`rol_id` = rp.`rol_id` AND x.`permiso_id` = pn.`id`);

SET NAMES utf8mb4;

-- 1. El permiso que agrupa los cuatro.
INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'vales.gestionar_taller', 'Gestionar Taller', 'vales',
       'Permite al encargado de taller y a su asistente asignar vales a diseñadores, revisar propuestas, verificar adjuntos y responder los rechazos de propuesta de su taller'
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'vales.gestionar_taller');

-- 2. Todo rol que asigna o revisa (encargado y asistente) recibe `vales.gestionar_taller`; los permisos sueltos de otros roles no cuentan.
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT DISTINCT rp.`rol_id`, pc.`id`
FROM `rol_permisos` rp
JOIN `permisos` pv ON pv.`id` = rp.`permiso_id`
  AND pv.`codigo` IN ('vales.asignar', 'vales.revisar')
JOIN `permisos` pc ON pc.`codigo` = 'vales.gestionar_taller'
WHERE NOT EXISTS (SELECT 1 FROM `rol_permisos` x WHERE x.`rol_id` = rp.`rol_id` AND x.`permiso_id` = pc.`id`);

-- 3. Se retiran los cuatro permisos.
DELETE rp FROM `rol_permisos` rp
JOIN `permisos` p ON p.`id` = rp.`permiso_id`
WHERE p.`codigo` IN ('vales.asignar', 'vales.revisar', 'vales.verificar_adjuntos', 'vales.responder_rechazo_propuesta');

DELETE FROM `permisos`
WHERE `codigo` IN ('vales.asignar', 'vales.revisar', 'vales.verificar_adjuntos', 'vales.responder_rechazo_propuesta');
