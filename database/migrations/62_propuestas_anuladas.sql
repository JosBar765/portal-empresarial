-- propuestas_anuladas.sql
-- Vales: una propuesta puede quedar anulada.
--
-- Qué hace:
--   Agrega `vale_propuestas.anulada_en`. Cuando un diseñador cancela su proceso, lo que había entregado en ese vale se
--   marca aquí: ya no se muestra ni se puede aprobar. La fila y el archivo se conservan (numeración y retención).
--
-- Cómo se aplica (idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (primero volver al código anterior):
--   ALTER TABLE `vale_propuestas` DROP COLUMN `anulada_en`;

-- Compatible con MariaDB y MySQL 8: sin ADD COLUMN IF NOT EXISTS.
SET NAMES utf8mb4;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `vale_propuestas` ADD COLUMN `anulada_en` DATETIME NULL DEFAULT NULL',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vale_propuestas' AND COLUMN_NAME = 'anulada_en');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
