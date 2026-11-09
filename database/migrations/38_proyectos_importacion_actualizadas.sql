-- proyectos_importacion_actualizadas.sql
-- Migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué hace:
--   Agrega `proy_importaciones.actualizadas`: cuántas empresas ya existentes se completaron con datos del archivo
--   (la importación puede omitir las duplicadas o completarlas sin pisar con vacíos).
--
-- Cómo se importa (idempotente, se puede repetir):
--   Se aplica sola al arrancar en staging y producción, o con `npm run migrate` en desarrollo.
--
-- Cómo revertir:
--   ALTER TABLE `proy_importaciones` DROP COLUMN `actualizadas`;

SET NAMES utf8mb4;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `proy_importaciones` ADD COLUMN `actualizadas` INT NOT NULL DEFAULT 0 AFTER `creadas`',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'proy_importaciones' AND COLUMN_NAME = 'actualizadas');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
