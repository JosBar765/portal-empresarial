-- vencidos_a_borrador.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Un vale que vence por vigencia o por adjuntos (y no es una solicitud de modificación) pasa a un borrador del asesor
--   en vez de perderse. Además `vale_bajas` guarda lo que se quería (fecha de entrega, motivo de rechazo) y registra
--   cuando se quita UN taller de un vale con 2 o más talleres.
--
-- Qué agrega (todo opcional, sin tocar filas existentes):
--   1. `vale_bajas`: fecha_entrega, motivo_rechazo, taller_id, taller_nombre y borrador_id (sin clave foránea: los
--      borradores se purgan y el registro es permanente).
--   2. `vale_borradores`: correlativo_origen, origen_motivo y visto_en (para la insignia de borradores nuevos).
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (solo si hiciera falta; pierde esos datos):
--   ALTER TABLE `vale_bajas` DROP COLUMN `fecha_entrega`, DROP COLUMN `motivo_rechazo`, DROP COLUMN `taller_id`,
--     DROP COLUMN `taller_nombre`, DROP COLUMN `borrador_id`;
--   ALTER TABLE `vale_borradores` DROP COLUMN `correlativo_origen`, DROP COLUMN `origen_motivo`, DROP COLUMN `visto_en`;

SET NAMES utf8mb4;

-- vale_bajas.fecha_entrega (solo si falta)
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `vale_bajas` ADD COLUMN `fecha_entrega` DATE NULL DEFAULT NULL COMMENT ''Fecha de entrega que quería el asesor''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vale_bajas' AND COLUMN_NAME = 'fecha_entrega');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- vale_bajas.motivo_rechazo (solo si falta)
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `vale_bajas` ADD COLUMN `motivo_rechazo` TEXT NULL COMMENT ''Motivo con que se rechazó el vale, si estaba rechazado''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vale_bajas' AND COLUMN_NAME = 'motivo_rechazo');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- vale_bajas.taller_id (solo si falta)
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `vale_bajas` ADD COLUMN `taller_id` INT NULL DEFAULT NULL COMMENT ''Solo en TALLER_QUITADO: taller que se quitó''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vale_bajas' AND COLUMN_NAME = 'taller_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- vale_bajas.taller_nombre (solo si falta)
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `vale_bajas` ADD COLUMN `taller_nombre` VARCHAR(100) NULL DEFAULT NULL COMMENT ''Solo en TALLER_QUITADO: nombre del taller al quitarlo''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vale_bajas' AND COLUMN_NAME = 'taller_nombre');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- vale_bajas.borrador_id (solo si falta)
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `vale_bajas` ADD COLUMN `borrador_id` INT NULL DEFAULT NULL COMMENT ''Borrador creado con el vale vencido; sin clave foránea porque los borradores se purgan''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vale_bajas' AND COLUMN_NAME = 'borrador_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- vale_borradores.correlativo_origen (solo si falta)
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `vale_borradores` ADD COLUMN `correlativo_origen` VARCHAR(60) NULL DEFAULT NULL COMMENT ''Correlativo del vale vencido del que nace el borrador''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vale_borradores' AND COLUMN_NAME = 'correlativo_origen');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- vale_borradores.origen_motivo (solo si falta)
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `vale_borradores` ADD COLUMN `origen_motivo` VARCHAR(30) NULL DEFAULT NULL COMMENT ''VENCIMIENTO_VIGENCIA o VENCIMIENTO_ADJUNTOS; NULL en un borrador escrito a mano''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vale_borradores' AND COLUMN_NAME = 'origen_motivo');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- vale_borradores.visto_en (solo si falta)
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `vale_borradores` ADD COLUMN `visto_en` DATETIME NULL DEFAULT NULL COMMENT ''Cuándo el asesor abrió la lista con este borrador por vencimiento''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vale_borradores' AND COLUMN_NAME = 'visto_en');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
