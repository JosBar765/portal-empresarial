-- reportes_actividad_equipos.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Los reportes «Reporte de actividad de talleres», «de diseñadores» y «de asesores» de la pestaña «Reportes 2» de
--   Vales de Arte muestran, agrupados por taller, diseñador o asesor, los vales autorizados atrasados, no entregados
--   y entregados de la ventana de tiempo, y se pueden descargar en PDF. Cada uno lo ve solo quien tenga su permiso;
--   quien además tenga `vales.gestionar_taller` o `vales.supervisar` ve únicamente lo que tiene a su cargo.
--
-- Qué agrega:
--   Permisos `vales.reporte_actividad_taller`, `vales.reporte_actividad_disenador` y `vales.reporte_actividad_asesor`
--   (tabla `permisos`), asignados solo al Administrador; el resto de roles los reciben desde «Roles y Permisos».
--   No crea tablas ni toca otros datos.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (solo si hiciera falta; los reportes dejarían de listarse hasta quitar también sus códigos):
--   DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id` WHERE p.`codigo` IN ('vales.reporte_actividad_taller', 'vales.reporte_actividad_disenador', 'vales.reporte_actividad_asesor');
--   DELETE FROM `permisos` WHERE `codigo` IN ('vales.reporte_actividad_taller', 'vales.reporte_actividad_disenador', 'vales.reporte_actividad_asesor');

SET NAMES utf8mb4;

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT n.`codigo`, n.`nombre`, 'vales', n.`descripcion`
FROM (
  SELECT 'vales.reporte_actividad_taller' AS `codigo`, 'Ver reporte de actividad de talleres' AS `nombre`, 'Permite ver y descargar en PDF el reporte de actividad de talleres (con vales.gestionar_taller, solo de sus talleres)' AS `descripcion`
  UNION ALL
  SELECT 'vales.reporte_actividad_disenador', 'Ver reporte de actividad de diseñadores', 'Permite ver y descargar en PDF el reporte de actividad de diseñadores (con vales.gestionar_taller, solo de los diseñadores de sus talleres)'
  UNION ALL
  SELECT 'vales.reporte_actividad_asesor', 'Ver reporte de actividad de asesores', 'Permite ver y descargar en PDF el reporte de actividad de asesores (con vales.supervisar, solo de sus asesores)'
) n
WHERE NOT EXISTS (SELECT 1 FROM `permisos` p WHERE p.`codigo` = n.`codigo`);

INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT r.`id`, p.`id` FROM `roles` r
JOIN `permisos` p ON p.`codigo` IN ('vales.reporte_actividad_taller', 'vales.reporte_actividad_disenador', 'vales.reporte_actividad_asesor')
WHERE r.`nombre` = 'Administrador'
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` rp WHERE rp.`rol_id` = r.`id` AND rp.`permiso_id` = p.`id`);
