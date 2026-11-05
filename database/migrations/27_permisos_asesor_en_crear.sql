-- permisos_asesor_en_crear.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Fusiona en `vales.crear` los permisos del asesor dueño: `vales.corregir`, `vales.confirmar`,
--   `vales.solicitar_modificacion` y `vales.rechazar_propuesta`. Quien tiene `vales.crear` administra sus propios vales.
--   `vales.dar_de_baja` no se toca.
--
-- Qué hace (solo datos; no cambia el esquema):
--   1. Da `vales.crear` a todo rol que tenga alguno de los cuatro y aún no lo tenga.
--   2. Borra los cuatro permisos de `rol_permisos` y de `permisos`.
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/migrations/<correlativo>_permisos_asesor_en_crear.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Importar justo antes de desplegar el código nuevo. Los usuarios deben cerrar sesión e iniciar de nuevo para que su
--   token refleje los permisos.
--
-- Cómo se revierte (solo si hiciera falta; recrea los cuatro permisos y se los da a los roles que tienen `vales.crear`):
--   INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
--   SELECT v.`codigo`, v.`nombre`, 'vales', v.`descripcion` FROM (
--     SELECT 'vales.corregir' AS `codigo`, 'Corregir Vales de Arte' AS `nombre`, 'Corregir los datos de un vale propio antes de que sea autorizado' AS `descripcion`
--     UNION ALL SELECT 'vales.confirmar', 'Confirmar de Recibido', 'Confirmar de recibido un vale de arte'
--     UNION ALL SELECT 'vales.solicitar_modificacion', 'Solicitar Modificación', 'Solicitar la modificación de un vale de arte'
--     UNION ALL SELECT 'vales.rechazar_propuesta', 'Rechazar Propuesta', 'Rechazar la propuesta de uno o varios talleres'
--   ) v WHERE NOT EXISTS (SELECT 1 FROM `permisos` x WHERE x.`codigo` = v.`codigo`);
--   INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
--   SELECT rp.`rol_id`, pn.`id` FROM `rol_permisos` rp
--   JOIN `permisos` pc ON pc.`id` = rp.`permiso_id` AND pc.`codigo` = 'vales.crear'
--   JOIN `permisos` pn ON pn.`codigo` IN ('vales.corregir', 'vales.confirmar', 'vales.solicitar_modificacion', 'vales.rechazar_propuesta')
--   WHERE NOT EXISTS (SELECT 1 FROM `rol_permisos` x WHERE x.`rol_id` = rp.`rol_id` AND x.`permiso_id` = pn.`id`);

SET NAMES utf8mb4;

-- 1. Todo rol con alguno de los cuatro recibe `vales.crear`.
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT DISTINCT rp.`rol_id`, pc.`id`
FROM `rol_permisos` rp
JOIN `permisos` pv ON pv.`id` = rp.`permiso_id`
  AND pv.`codigo` IN ('vales.corregir', 'vales.confirmar', 'vales.solicitar_modificacion', 'vales.rechazar_propuesta')
JOIN `permisos` pc ON pc.`codigo` = 'vales.crear'
WHERE NOT EXISTS (SELECT 1 FROM `rol_permisos` x WHERE x.`rol_id` = rp.`rol_id` AND x.`permiso_id` = pc.`id`);

-- 2. Se retiran los cuatro permisos.
DELETE rp FROM `rol_permisos` rp
JOIN `permisos` p ON p.`id` = rp.`permiso_id`
WHERE p.`codigo` IN ('vales.corregir', 'vales.confirmar', 'vales.solicitar_modificacion', 'vales.rechazar_propuesta');

DELETE FROM `permisos`
WHERE `codigo` IN ('vales.corregir', 'vales.confirmar', 'vales.solicitar_modificacion', 'vales.rechazar_propuesta');
