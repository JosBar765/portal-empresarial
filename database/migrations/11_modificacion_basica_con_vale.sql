-- modificacion_basica_con_vale.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   La modificación básica deja de ser un chat sin vale y pasa a crear un vale MOD, igual que la media y la
--   avanzada. Por eso `vales`.`modificacion_tipo` debe admitir también el valor BASICA.
--
-- Qué hace (no toca datos, permisos ni otras columnas):
--   1. Amplía el ENUM de `vales`.`modificacion_tipo` a (BASICA, MEDIA, AVANZADA), solo si todavía no admite BASICA.
--      Los valores que ya existen (MEDIA, AVANZADA, NULL) se conservan tal cual.
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_modificacion_basica_con_vale.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Importar ANTES de desplegar el código nuevo.
--
-- Cómo se revierte (solo si ningún vale MOD tiene tipo BASICA):
--   ALTER TABLE `vales` MODIFY COLUMN `modificacion_tipo` ENUM('MEDIA', 'AVANZADA') DEFAULT NULL;

SET NAMES utf8mb4;

SET @falta := (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vales' AND COLUMN_NAME = 'modificacion_tipo'
                 AND COLUMN_TYPE NOT LIKE '%''BASICA''%');
SET @sql := IF(@falta = 1,
  'ALTER TABLE `vales` MODIFY COLUMN `modificacion_tipo` ENUM(''BASICA'', ''MEDIA'', ''AVANZADA'') DEFAULT NULL',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;
