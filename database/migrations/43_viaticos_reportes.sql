-- viaticos_reportes.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   La pestaña «Reportes» del módulo de viáticos muestra cuánto se invierte (lo autorizado) por solicitante y cómo se
--   reparte por categoría, y permite imprimirlo en PDF. Solo la ven quienes tengan este permiso.
--
-- Qué agrega:
--   Permiso `viaticos.reportes` (tabla `permisos`), asignado solo al Administrador; el resto de roles lo reciben
--   desde Administración. No crea tablas ni toca datos.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (solo si hiciera falta; la pestaña dejaría de verse hasta quitar también su código):
--   DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id` WHERE p.`codigo` = 'viaticos.reportes';
--   DELETE FROM `permisos` WHERE `codigo` = 'viaticos.reportes';

SET NAMES utf8mb4;

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'viaticos.reportes', 'Ver reportes de viáticos', 'viaticos', 'Permite ver y descargar en PDF los reportes de inversión y reparto de viáticos' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'viaticos.reportes');

INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT r.`id`, p.`id` FROM `roles` r
JOIN `permisos` p ON p.`codigo` = 'viaticos.reportes'
WHERE r.`nombre` = 'Administrador'
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` rp WHERE rp.`rol_id` = r.`id` AND rp.`permiso_id` = p.`id`);
