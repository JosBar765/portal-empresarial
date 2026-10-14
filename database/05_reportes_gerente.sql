-- reportes_gerente.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Otorga al rol Gerente (rol_id 8) el permiso `vales.ver_reportes`, para que vea la pestaña «Reportes» de Vales de
--   Arte con el alcance global y de solo lectura. Desde entonces la pestaña aparece o desaparece solo según ese
--   permiso (se puede quitar o volver a poner desde «Roles y Permisos»).
--
-- Qué agrega (solo datos; no cambia el esquema ni ningún otro permiso):
--   1. Una fila en `rol_permisos` (Gerente + `vales.ver_reportes`), buscando el permiso por su código porque su
--      id cambia de una base a otra. Si el permiso no existe, no hace nada.
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_reportes_gerente.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Los Gerentes con sesión abierta deben cerrar sesión e iniciar de nuevo para recibir el permiso.
--
-- Cómo se revierte: quitar el permiso desde «Roles y Permisos», o
--   DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id`
--   WHERE rp.`rol_id` = 8 AND p.`codigo` = 'vales.ver_reportes';

SET NAMES utf8mb4;

INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT 8, p.`id` FROM `permisos` p
WHERE p.`codigo` = 'vales.ver_reportes'
  AND EXISTS (SELECT 1 FROM `roles` r WHERE r.`id` = 8)
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` rp WHERE rp.`rol_id` = 8 AND rp.`permiso_id` = p.`id`);
