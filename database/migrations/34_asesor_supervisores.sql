-- asesor_supervisores.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Hasta ahora los supervisores que autorizan los vales de un asesor salen de las tiendas que cubren
--   (`supervisor_tiendas`). Esta tabla permite asignar a un asesor supervisores concretos (p. ej. un asesor de El Salvador
--   que ve licitaciones y solo deben autorizar los supervisores generales de Centroamérica).
--
-- Qué agrega:
--   La tabla `asesor_supervisores(asesor_id, supervisor_id)`, con clave primaria compuesta. Si un asesor tiene filas, ESOS
--   supervisores autorizan EN LUGAR DE los de su tienda; sin filas, todo sigue igual. Nace vacía: nada cambia al aplicarla.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (solo si hiciera falta; los asesores vuelven a depender de los supervisores de su tienda):
--   DROP TABLE IF EXISTS `asesor_supervisores`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `asesor_supervisores` (
  `asesor_id`     INT NOT NULL,
  `supervisor_id` INT NOT NULL,
  PRIMARY KEY (`asesor_id`, `supervisor_id`),
  INDEX `idx_asesor_supervisores_supervisor` (`supervisor_id`),
  FOREIGN KEY (`asesor_id`)     REFERENCES `asesores`  (`usuario_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`supervisor_id`) REFERENCES `usuarios`  (`id`)         ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
