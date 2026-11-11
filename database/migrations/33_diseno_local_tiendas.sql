-- diseno_local_tiendas.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Hasta ahora un taller de Diseño Local atendía exactamente una tienda (`talleres.tienda_id`). Esta tabla permite que
--   un Local atienda varias tiendas (p. ej. las de El Salvador usan el Local de San Salvador) y que una tienda pueda
--   usar más de un Local.
--
-- Qué agrega:
--   1. La tabla `taller_local_tiendas(taller_id, tienda_id)`, con clave primaria compuesta: las tiendas que atiende cada
--      Local. Solo contiene Locales; los talleres generales siguen en `taller_tiendas`.
--   2. Copia desde `talleres.tienda_id` una fila por cada Local existente, así el comportamiento actual no cambia.
--   `talleres.tienda_id` no se toca: sigue siendo la tienda sede del Local (marca «es Local», país y feriados).
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (solo si hiciera falta; borra las asignaciones extra de tiendas):
--   DROP TABLE IF EXISTS `taller_local_tiendas`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `taller_local_tiendas` (
  `taller_id` INT NOT NULL,
  `tienda_id` INT NOT NULL,
  PRIMARY KEY (`taller_id`, `tienda_id`),
  INDEX `idx_taller_local_tiendas_tienda` (`tienda_id`),
  FOREIGN KEY (`taller_id`) REFERENCES `talleres` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`) REFERENCES `tiendas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada Local atiende, como mínimo, su tienda sede.
INSERT IGNORE INTO `taller_local_tiendas` (`taller_id`, `tienda_id`)
SELECT `id`, `tienda_id` FROM `talleres` WHERE `tienda_id` IS NOT NULL;
