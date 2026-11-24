-- 58_viaticos_licencias_por_pais.sql
-- Módulo Calculadora de Viáticos: los tipos de licencia pertenecen a un país, igual que los tipos de placa y las reglas.
--
-- Antes el código era único global y la migración `viaticos_reglas_licencia` lo prefijó con el país
-- (`GT-B`) y repitió el país en el nombre (`Guatemala · Tipo B`). Ahora cada tipo lleva `pais_id`,
-- el código no lleva prefijo (`B`, `C1`, `4A`) y es único dentro del país.
--
-- Qué hace (transforma en el lugar, no borra y recrea: `viaticos_licencias`, `viaticos_pilotos` y
-- `viaticos_reglas_licencia` apuntan a los tipos por id y staging puede tener datos reales):
--   1. Agrega `viaticos_tipos_licencia.pais_id` (NULL al inicio).
--   2. Quita el índice único global por código (hace falta antes de renombrar: `GT-B` y `HN-B` pasarían a `B`).
--   3. Las filas con código `XX-...` (GT, SV, HN, NI, CR, PA, BZ) toman el país del prefijo, pierden el prefijo
--      del código y el texto «País · » del nombre.
--   4. Borra los tipos que siguen sin país y nadie referencia (personas, pilotos ni reglas).
--   5. Crea el índice único (país, código) y la llave foránea a `paises`.
--   6. Pone `pais_id` NOT NULL solo si ninguna fila quedó sin país; si alguna quedó (un tipo propio sin prefijo
--      que alguien usa), la columna sigue NULL y hay que asignarle el país a mano en la base.
--
-- Cómo se aplica (idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (el código nuevo dejaría de funcionar hasta quitarlo; los códigos ya sin prefijo no se restauran):
--   ALTER TABLE `viaticos_tipos_licencia` DROP FOREIGN KEY `fk_viaticos_tipos_licencia_pais`;
--   ALTER TABLE `viaticos_tipos_licencia` DROP INDEX `uq_viaticos_tipos_licencia_pais_codigo`;
--   ALTER TABLE `viaticos_tipos_licencia` DROP COLUMN `pais_id`;
--   (y, antes de recrear el índice único global por código, volver a prefijar los códigos repetidos).

-- Nota: compatible con MariaDB 11.8 y MySQL 8: sin ADD COLUMN IF NOT EXISTS ni DROP INDEX IF EXISTS,
-- y sin CHECK junto a COMMENT; cada ALTER condicional pregunta primero a information_schema.
SET NAMES utf8mb4;

-- 1. Columna del país
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `viaticos_tipos_licencia` ADD COLUMN `pais_id` INT NULL DEFAULT NULL',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_tipos_licencia' AND COLUMN_NAME = 'pais_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Fuera el único global por código
SET @sql = (SELECT IF(COUNT(*) > 0,
  'ALTER TABLE `viaticos_tipos_licencia` DROP INDEX `uq_viaticos_tipos_licencia_codigo`',
  'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_tipos_licencia' AND INDEX_NAME = 'uq_viaticos_tipos_licencia_codigo');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. País desde el prefijo; el código y el nombre quedan limpios (el WHERE excluye lo ya migrado)
UPDATE `viaticos_tipos_licencia` t
JOIN `paises` p ON p.`codigo` = LEFT(t.`codigo`, 2)
SET t.`pais_id` = p.`id`,
    t.`nombre` = IF(LOCATE(' · ', t.`nombre`) > 0, SUBSTRING(t.`nombre`, LOCATE(' · ', t.`nombre`) + 3), t.`nombre`),
    t.`codigo` = SUBSTRING(t.`codigo`, 4)
WHERE t.`pais_id` IS NULL AND t.`codigo` REGEXP '^(GT|SV|HN|NI|CR|PA|BZ)-';

-- 4. Tipos sin país que nadie usa
DELETE FROM `viaticos_tipos_licencia`
WHERE `pais_id` IS NULL
  AND `id` NOT IN (SELECT `tipo_licencia_id` FROM `viaticos_licencias`)
  AND `id` NOT IN (SELECT `tipo_licencia_id` FROM `viaticos_pilotos`)
  AND `id` NOT IN (SELECT `tipo_licencia_id` FROM `viaticos_reglas_licencia`);

-- 5. Único (país, código) y llave foránea
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `viaticos_tipos_licencia` ADD UNIQUE KEY `uq_viaticos_tipos_licencia_pais_codigo` (`pais_id`, `codigo`)',
  'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_tipos_licencia' AND INDEX_NAME = 'uq_viaticos_tipos_licencia_pais_codigo');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `viaticos_tipos_licencia` ADD CONSTRAINT `fk_viaticos_tipos_licencia_pais` FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1')
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_tipos_licencia' AND COLUMN_NAME = 'pais_id' AND REFERENCED_TABLE_NAME = 'paises');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. NOT NULL solo si ninguna fila quedó sin país
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM `viaticos_tipos_licencia` WHERE `pais_id` IS NULL) = 0
  AND (SELECT COUNT(*) FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_tipos_licencia' AND COLUMN_NAME = 'pais_id' AND IS_NULLABLE = 'YES') = 1,
  'ALTER TABLE `viaticos_tipos_licencia` MODIFY COLUMN `pais_id` INT NOT NULL',
  'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
