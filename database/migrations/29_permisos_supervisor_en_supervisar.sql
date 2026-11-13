-- permisos_supervisor_en_supervisar.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Fusiona en `vales.supervisar` los permisos del supervisor: `vales.autorizar_creacion` y `vales.aprobar_modificacion`.
--   Quien tiene `vales.supervisar` marca vales como vistos, autoriza creaciones y aprueba modificaciones de los asesores
--   de sus tiendas (la cobertura sigue siendo dato de `supervisor_tiendas`). En producción solo el rol 3 (Supervisor de
--   Ventas) tenía estos permisos.
--
-- Qué hace (solo datos; no cambia el esquema):
--   1. Renombra `vales.supervisar` para que describa todo lo que cubre.
--   2. Da `vales.supervisar` a todo rol que tenga alguno de los dos permisos y aún no lo tenga.
--   3. Borra los dos permisos de `rol_permisos` y de `permisos`.
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/migrations/<correlativo>_permisos_supervisor_en_supervisar.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Importar justo antes de desplegar el código nuevo. Los usuarios deben cerrar sesión e iniciar de nuevo para que su
--   token refleje los permisos.
--
-- Cómo se revierte (solo si hiciera falta; recrea los dos permisos y se los da a los roles que tienen `vales.supervisar`):
--   INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
--   SELECT v.`codigo`, v.`nombre`, 'vales', v.`descripcion` FROM (
--     SELECT 'vales.autorizar_creacion' AS `codigo`, 'Autorizar Creación' AS `nombre`, 'Autorizar o rechazar la creación de un vale de arte' AS `descripcion`
--     UNION ALL SELECT 'vales.aprobar_modificacion', 'Aprobar Modificación', 'Aprobar o rechazar la modificación de un vale de arte'
--   ) v WHERE NOT EXISTS (SELECT 1 FROM `permisos` x WHERE x.`codigo` = v.`codigo`);
--   INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
--   SELECT rp.`rol_id`, pn.`id` FROM `rol_permisos` rp
--   JOIN `permisos` pc ON pc.`id` = rp.`permiso_id` AND pc.`codigo` = 'vales.supervisar'
--   JOIN `permisos` pn ON pn.`codigo` IN ('vales.autorizar_creacion', 'vales.aprobar_modificacion')
--   WHERE NOT EXISTS (SELECT 1 FROM `rol_permisos` x WHERE x.`rol_id` = rp.`rol_id` AND x.`permiso_id` = pn.`id`);

SET NAMES utf8mb4;

-- 1. `vales.supervisar` pasa a describir el permiso completo del supervisor.
UPDATE `permisos`
SET `nombre` = 'Supervisar Vales de Arte',
    `descripcion` = 'Permite al supervisor marcar vales como vistos, autorizar creaciones y aprobar modificaciones de los asesores de sus tiendas'
WHERE `codigo` = 'vales.supervisar';

-- 2. Todo rol con alguno de los dos recibe `vales.supervisar`.
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT DISTINCT rp.`rol_id`, pc.`id`
FROM `rol_permisos` rp
JOIN `permisos` pv ON pv.`id` = rp.`permiso_id`
  AND pv.`codigo` IN ('vales.autorizar_creacion', 'vales.aprobar_modificacion')
JOIN `permisos` pc ON pc.`codigo` = 'vales.supervisar'
WHERE NOT EXISTS (SELECT 1 FROM `rol_permisos` x WHERE x.`rol_id` = rp.`rol_id` AND x.`permiso_id` = pc.`id`);

-- 3. Se retiran los dos permisos.
DELETE rp FROM `rol_permisos` rp
JOIN `permisos` p ON p.`id` = rp.`permiso_id`
WHERE p.`codigo` IN ('vales.autorizar_creacion', 'vales.aprobar_modificacion');

DELETE FROM `permisos`
WHERE `codigo` IN ('vales.autorizar_creacion', 'vales.aprobar_modificacion');
