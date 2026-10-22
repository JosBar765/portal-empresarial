-- cupo_talleres.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Crea el permiso `vales.ver_cupo` y se lo da al rol Supervisor (rol_id 3). Con él, el calendario desplegable del
--   Buzón de Vales de Arte muestra, día por día, el cupo disponible de los talleres que tienen límite diario (solo de
--   las tiendas que cubre el Supervisor). El cupo aparece o desaparece solo según ese permiso (se puede dar o quitar a
--   cualquier rol desde «Roles y Permisos»).
--
-- Qué agrega (solo datos; no cambia el esquema ni ningún otro permiso):
--   1. Una fila en `permisos` (`vales.ver_cupo`), si no existe; si ya existe, solo actualiza su nombre y descripción.
--   2. Una fila en `rol_permisos` (Supervisor + `vales.ver_cupo`), buscando el permiso por su código porque su id
--      cambia de una base a otra.
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_cupo_talleres.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Los Supervisores con sesión abierta deben cerrar sesión e iniciar de nuevo para recibir el permiso.
--
-- Cómo se revierte: quitar el permiso desde «Roles y Permisos», o
--   DELETE FROM `permisos` WHERE `codigo` = 'vales.ver_cupo';

SET NAMES utf8mb4;

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'vales.ver_cupo', 'Ver Cupo de Talleres', 'vales',
       'Permite ver el cupo diario de los talleres con límite en el calendario del Buzón (de las tiendas que cubre, si es Supervisor)'
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'vales.ver_cupo');

UPDATE `permisos`
SET `nombre` = 'Ver Cupo de Talleres',
    `descripcion` = 'Permite ver el cupo diario de los talleres con límite en el calendario del Buzón (de las tiendas que cubre, si es Supervisor)'
WHERE `codigo` = 'vales.ver_cupo';

INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT 3, p.`id` FROM `permisos` p
WHERE p.`codigo` = 'vales.ver_cupo'
  AND EXISTS (SELECT 1 FROM `roles` r WHERE r.`id` = 3)
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` rp WHERE rp.`rol_id` = 3 AND rp.`permiso_id` = p.`id`);
