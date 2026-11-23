-- reporte_actividad_tienda.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   El reporte «Reporte de actividad de tienda» de la pestaña «Reportes 2» de Vales de Arte muestra, por tienda, los
--   vales autorizados atrasados, no entregados y entregados de la ventana de tiempo, y se puede descargar en PDF.
--   Solo lo ven quienes tengan este permiso; quien además tenga `vales.supervisar` ve únicamente sus tiendas.
--
-- Qué agrega:
--   Permiso `vales.reporte_actividad_tienda` (tabla `permisos`), asignado solo al Administrador; el resto de roles lo
--   reciben desde «Roles y Permisos». No crea tablas ni toca otros datos.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (solo si hiciera falta; el reporte dejaría de listarse hasta quitar también su código):
--   DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id` WHERE p.`codigo` = 'vales.reporte_actividad_tienda';
--   DELETE FROM `permisos` WHERE `codigo` = 'vales.reporte_actividad_tienda';

SET NAMES utf8mb4;

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'vales.reporte_actividad_tienda', 'Ver reporte de actividad de tienda', 'vales', 'Permite ver y descargar en PDF el reporte de actividad de tienda (con vales.supervisar, solo de las tiendas que supervisa)' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'vales.reporte_actividad_tienda');

INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT r.`id`, p.`id` FROM `roles` r
JOIN `permisos` p ON p.`codigo` = 'vales.reporte_actividad_tienda'
WHERE r.`nombre` = 'Administrador'
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` rp WHERE rp.`rol_id` = r.`id` AND rp.`permiso_id` = p.`id`);
