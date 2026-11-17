-- viaticos_rechazo_vencimiento.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Una solicitud de viáticos rechazada vence a las horas del ajuste `rechazo_vigencia_horas` (corridas, 4 por omisión):
--   al vencer pasa a un borrador del solicitante y la solicitud se elimina. Los borradores creados así se muestran como
--   «nuevos» hasta que el solicitante abre la lista de Borradores.
--
-- Qué agrega:
--   1. `viaticos_solicitudes.rechazada_en`: instante del rechazo (reloj del vencimiento); NULL si no está rechazada.
--   2. `viaticos_solicitudes.vencimiento_aviso_en`: cuándo se avisó que le queda el 25 % del plazo (una sola vez).
--   3. `viaticos_borradores.visto_en`, `origen_correlativo` y `origen_motivo`: un borrador es «nuevo» si
--      `visto_en` es NULL y `origen_correlativo` no lo es (los borradores hechos a mano nunca lo son).
--   4. Ajuste `rechazo_vigencia_horas` = 4 en `viaticos_ajustes` (no pisa un valor ya cambiado).
--   5. Las solicitudes que ya estaban rechazadas empiezan su plazo al migrar, para no vencer de golpe.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--   Se aplica después de `viaticos_vistos` (el ejecutor ordena por nombre).
--
-- Cómo se revierte (solo si hiciera falta; el código nuevo dejaría de funcionar hasta quitarlo):
--   ALTER TABLE `viaticos_solicitudes` DROP COLUMN `rechazada_en`, DROP COLUMN `vencimiento_aviso_en`;
--   ALTER TABLE `viaticos_borradores` DROP COLUMN `visto_en`, DROP COLUMN `origen_correlativo`, DROP COLUMN `origen_motivo`;
--   DELETE FROM `viaticos_ajustes` WHERE `clave` = 'rechazo_vigencia_horas';

SET NAMES utf8mb4;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `viaticos_solicitudes` ADD COLUMN `rechazada_en` DATETIME NULL COMMENT ''Instante del rechazo; inicia el plazo de vencimiento''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_solicitudes' AND COLUMN_NAME = 'rechazada_en');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `viaticos_solicitudes` ADD COLUMN `vencimiento_aviso_en` DATETIME NULL COMMENT ''Cuándo se avisó que el plazo está por terminar''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_solicitudes' AND COLUMN_NAME = 'vencimiento_aviso_en');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `viaticos_borradores` ADD COLUMN `visto_en` DATETIME NULL COMMENT ''Cuándo su dueño abrió la lista siendo nuevo''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_borradores' AND COLUMN_NAME = 'visto_en');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `viaticos_borradores` ADD COLUMN `origen_correlativo` VARCHAR(30) NULL COMMENT ''Correlativo de la solicitud vencida de la que viene; NULL si se creó a mano''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_borradores' AND COLUMN_NAME = 'origen_correlativo');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `viaticos_borradores` ADD COLUMN `origen_motivo` VARCHAR(500) NULL COMMENT ''Motivo con el que se rechazó la solicitud de origen''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_borradores' AND COLUMN_NAME = 'origen_motivo');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO `viaticos_ajustes` (`clave`, `valor`, `descripcion`)
SELECT 'rechazo_vigencia_horas', '4', 'Horas corridas que una solicitud rechazada espera antes de pasar a borrador' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_ajustes` WHERE `clave` = 'rechazo_vigencia_horas');

UPDATE `viaticos_solicitudes`
SET `rechazada_en` = NOW()
WHERE `rechazada_en` IS NULL
  AND `estado_id` = (SELECT `id` FROM `viaticos_estados` WHERE `nombre` = 'rechazada');
