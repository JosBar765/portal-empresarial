-- incidencias_fotos_purga.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué agrega: `incidencia_fotos.purgada_en`, la marca de que la foto ya se borró de Storage por la regla de conservación
-- de Incidencias (parámetro `incidencias.meses_retencion_fotos`). La URL se conserva en la fila como rastro, pero la
-- pantalla ya no la usa: muestra «Foto eliminada por antigüedad». Es aditivo: lo existente no cambia.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Reversa: ALTER TABLE `incidencia_fotos` DROP INDEX `idx_incidencia_fotos_purga`, DROP COLUMN `purgada_en`;

SET NAMES utf8mb4;

SET @agregar_columna = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `incidencia_fotos` ADD COLUMN `purgada_en` DATETIME DEFAULT NULL',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'incidencia_fotos' AND COLUMN_NAME = 'purgada_en'
);
PREPARE `paso_columna` FROM @agregar_columna;
EXECUTE `paso_columna`;
DEALLOCATE PREPARE `paso_columna`;

SET @agregar_indice = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `incidencia_fotos` ADD INDEX `idx_incidencia_fotos_purga` (`etapa`, `purgada_en`)',
    'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'incidencia_fotos' AND INDEX_NAME = 'idx_incidencia_fotos_purga'
);
PREPARE `paso_indice` FROM @agregar_indice;
EXECUTE `paso_indice`;
DEALLOCATE PREPARE `paso_indice`;
