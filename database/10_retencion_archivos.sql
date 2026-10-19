-- retencion_archivos.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Prepara la limpieza automática de archivos de Supabase Storage de los vales confirmados:
--     - A los 30 días de `vales`.`confirmado_en` se borran el PDF del vale y sus adjuntos.
--     - A los 60 días se borran las propuestas (las de cada taller y la general/fusionada).
--   En la base solo queda la información; las URLs de lo borrado pasan a NULL.
--
-- Qué agrega (no modifica ningún dato existente):
--   1. Columna `vales`.`archivos_purgados_en`: cuándo se borraron el PDF y los adjuntos (NULL = aún no).
--   2. Columna `vales`.`propuestas_purgadas_en`: cuándo se borraron las propuestas (NULL = aún no).
--   3. `vale_documentos`.`ruta` pasa a aceptar NULL (NULL = archivo ya purgado; el registro y su nombre se conservan).
--   4. Parámetros editables en `parametros_sistema` (los edita el Administrador en «Horarios y feriados»; no pisa un valor ya cambiado):
--        - `dias_retencion_pdf_adjuntos` = 30 (días tras la confirmación para borrar el PDF y los adjuntos)
--        - `dias_retencion_propuestas`    = 60 (días tras la confirmación para borrar las propuestas; >= el anterior)
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_retencion_archivos.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Importar ANTES de desplegar el código nuevo.
--
-- Cómo se revierte (solo si hiciera falta; los archivos ya borrados de Storage no se recuperan):
--   ALTER TABLE `vale_documentos` MODIFY COLUMN `ruta` VARCHAR(500) NOT NULL;  -- falla si hay rutas NULL
--   ALTER TABLE `vales` DROP COLUMN `propuestas_purgadas_en`, DROP COLUMN `archivos_purgados_en`;
--   DELETE FROM `parametros_sistema` WHERE `clave` IN ('dias_retencion_pdf_adjuntos', 'dias_retencion_propuestas');

SET NAMES utf8mb4;

-- 1. vales.archivos_purgados_en (solo si todavía no existe)
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vales' AND COLUMN_NAME = 'archivos_purgados_en');
SET @sql := IF(@existe = 0,
  'ALTER TABLE `vales` ADD COLUMN `archivos_purgados_en` DATETIME DEFAULT NULL',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;

-- 2. vales.propuestas_purgadas_en (solo si todavía no existe)
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vales' AND COLUMN_NAME = 'propuestas_purgadas_en');
SET @sql := IF(@existe = 0,
  'ALTER TABLE `vales` ADD COLUMN `propuestas_purgadas_en` DATETIME DEFAULT NULL',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;

-- 3. vale_documentos.ruta acepta NULL (solo si todavía es NOT NULL)
SET @no_nula := (SELECT COUNT(*) FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vale_documentos' AND COLUMN_NAME = 'ruta'
                   AND IS_NULLABLE = 'NO');
SET @sql := IF(@no_nula = 1,
  'ALTER TABLE `vale_documentos` MODIFY COLUMN `ruta` VARCHAR(500) DEFAULT NULL',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;

-- 4. Parámetros de retención (la tabla la crea horarios_laborales.sql; se asegura por si faltara)
CREATE TABLE IF NOT EXISTS `parametros_sistema` (
  `clave`          VARCHAR(60)  NOT NULL PRIMARY KEY,
  `valor`          VARCHAR(100) NOT NULL,
  `descripcion`    VARCHAR(255) DEFAULT NULL,
  `actualizado_en` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `parametros_sistema` (`clave`, `valor`, `descripcion`)
SELECT 'dias_retencion_pdf_adjuntos', '30', 'Días desde la confirmación del vale tras los cuales se borran su PDF y sus adjuntos (entero positivo)' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `parametros_sistema` WHERE `clave` = 'dias_retencion_pdf_adjuntos');

INSERT INTO `parametros_sistema` (`clave`, `valor`, `descripcion`)
SELECT 'dias_retencion_propuestas', '60', 'Días desde la confirmación del vale tras los cuales se borran sus propuestas (entero positivo, no menor que el de PDF y adjuntos)' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `parametros_sistema` WHERE `clave` = 'dias_retencion_propuestas');
