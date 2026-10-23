-- borradores_enviados.sql
-- Migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué hace:
--   Agrega `vale_borradores.enviado_en`: momento en que el borrador se convirtió en vale. Un borrador con
--   `enviado_en` ya no existe para el usuario (no se lista, abre, edita, envía ni cuenta en el tope) y solo
--   espera a que se borren sus archivos del bucket de borradores; el vigilante reintenta hasta lograrlo y
--   entonces borra la fila. Así un fallo de Storage no deja archivos huérfanos sin fila que los apunte.
--
-- Cómo se importa (idempotente, se puede repetir):
--   Se aplica sola al arrancar en staging y producción, o con `npm run migrate` en desarrollo.
--
-- Reversa (solo si hace falta; los enviados pendientes de limpieza volverían a verse como borradores):
--   ALTER TABLE `vale_borradores` DROP COLUMN `enviado_en`;

SET NAMES utf8mb4;

-- Columna (solo si falta)
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `vale_borradores` ADD COLUMN `enviado_en` DATETIME NULL DEFAULT NULL COMMENT ''Cuándo se envió como vale; pendiente de limpiar sus archivos''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vale_borradores' AND COLUMN_NAME = 'enviado_en');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
