-- tiempos_datos_administrables.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Que el administrador de la Calculadora de Tiempos maneje todos los datos desde el módulo: extras de tres tipos con
--   dónde se ofrecen, categorías, líneas y etapas ocultables, y reglas editables (margen, máximo de piezas, aviso de urgente).
--
-- Qué agrega:
--   1. `activo` en `tiempos_lineas` y `tiempos_etapas`; tabla `tiempos_categorias`; `categoria_clave` en `tiempos_productos`.
--   2. En `tiempos_extras`: tipo (si_no | por_cantidad | por_unidades), textos, días fijos, regla de unidades, `todos`, `activo`.
--      Tablas `tiempos_extra_opciones` (las opciones de un extra por cantidad) y `tiempos_extra_alcance` (líneas, categorías o
--      productos donde se ofrece). `tiempos_extra_rangos` pasa a colgar de la opción (`opcion_id`).
--   3. `texto` en `tiempos_parametros` (y `valor` admite NULL) para reglas de texto.
--
-- Conversión de los datos que ya existen (en TODAS las versiones: publicada, reemplazadas y borrador):
--   - Cada `grupo` de producto pasa a una categoría de su línea y el producto apunta a ella.
--   - Los tipos de UV pasan a ser las opciones del extra «Impresión UV» (sus rangos y días no cambian).
--   - Colores (reglas colores_*), Moldes (moldes_dias y `permite_moldes`) y Costura del lanyard (columna Costura del producto
--     Lanyard y `permite_lanyard`) pasan a ser extras con los mismos valores; se ofrecen en las mismas piezas que antes
--     (por categoría si toda la categoría los tenía, si no por producto).
--   - Se agregan las reglas max_piezas (20) y aviso_urgente, y se quitan las reglas colores_* y moldes_dias (ya viven en sus extras).
--   Los cálculos dan los mismos días que antes. Las columnas `grupo`, `permite_moldes`, `permite_lanyard` y `extra_id` quedan
--   sin uso (no se borran).
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Reversa: no automática (la conversión reemplaza extras y reglas). Volver a una copia de la base de antes de aplicarla.

SET NAMES utf8mb4;

-- Agrega una columna solo si falta.
SET @t = 'tiempos_lineas'; SET @c = 'activo';
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `tiempos_lineas` ADD COLUMN `activo` TINYINT(1) NOT NULL DEFAULT 1 AFTER `orden`', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @t = 'tiempos_etapas'; SET @c = 'activo';
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `tiempos_etapas` ADD COLUMN `activo` TINYINT(1) NOT NULL DEFAULT 1 AFTER `orden`', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @t = 'tiempos_productos'; SET @c = 'categoria_clave';
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `tiempos_productos` ADD COLUMN `categoria_clave` VARCHAR(80) DEFAULT NULL AFTER `linea_clave`', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `tiempos_categorias` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `version_id`  INT UNSIGNED NOT NULL,
  `clave`       VARCHAR(80) NOT NULL,
  `linea_clave` VARCHAR(40) NOT NULL,
  `nombre`      VARCHAR(80) NOT NULL,
  `orden`       INT NOT NULL DEFAULT 0,
  `activo`      TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tiempos_categoria` (`version_id`, `clave`),
  CONSTRAINT `fk_tiempos_categoria_version` FOREIGN KEY (`version_id`) REFERENCES `tiempos_versiones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Extras: columnas nuevas (una por sentencia, cada una solo si falta).
SET @t = 'tiempos_extras';
SET @c = 'tipo';  SET @def = 'ADD COLUMN `tipo` ENUM(''si_no'', ''por_cantidad'', ''por_unidades'') DEFAULT NULL AFTER `clave`';
SET @sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `tiempos_extras` ', @def), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c = 'etiqueta'; SET @def = 'ADD COLUMN `etiqueta` VARCHAR(120) DEFAULT NULL AFTER `nombre`';
SET @sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `tiempos_extras` ', @def), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c = 'ayuda'; SET @def = 'ADD COLUMN `ayuda` VARCHAR(255) DEFAULT NULL AFTER `etiqueta`';
SET @sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `tiempos_extras` ', @def), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c = 'dias_fijos'; SET @def = 'ADD COLUMN `dias_fijos` INT DEFAULT NULL AFTER `aviso`';
SET @sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `tiempos_extras` ', @def), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c = 'unidades_incluidas'; SET @def = 'ADD COLUMN `unidades_incluidas` INT DEFAULT NULL AFTER `dias_fijos`';
SET @sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `tiempos_extras` ', @def), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c = 'unidades_cada'; SET @def = 'ADD COLUMN `unidades_cada` INT DEFAULT NULL AFTER `unidades_incluidas`';
SET @sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `tiempos_extras` ', @def), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c = 'unidades_dias'; SET @def = 'ADD COLUMN `unidades_dias` INT DEFAULT NULL AFTER `unidades_cada`';
SET @sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `tiempos_extras` ', @def), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c = 'unidades_max'; SET @def = 'ADD COLUMN `unidades_max` INT DEFAULT NULL AFTER `unidades_dias`';
SET @sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `tiempos_extras` ', @def), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c = 'todos'; SET @def = 'ADD COLUMN `todos` TINYINT(1) NOT NULL DEFAULT 1 AFTER `unidades_max`';
SET @sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `tiempos_extras` ', @def), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c = 'activo'; SET @def = 'ADD COLUMN `activo` TINYINT(1) NOT NULL DEFAULT 1 AFTER `todos`';
SET @sql = (SELECT IF(COUNT(*) = 0, CONCAT('ALTER TABLE `tiempos_extras` ', @def), 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `tiempos_extra_opciones` (
  `id`       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `extra_id` INT UNSIGNED NOT NULL,
  `clave`    VARCHAR(80) NOT NULL,
  `nombre`   VARCHAR(80) NOT NULL,
  `aviso`    VARCHAR(255) DEFAULT NULL,
  `orden`    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tiempos_extra_opcion` (`extra_id`, `clave`),
  CONSTRAINT `fk_tiempos_extra_opcion` FOREIGN KEY (`extra_id`) REFERENCES `tiempos_extras` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiempos_extra_alcance` (
  `extra_id` INT UNSIGNED NOT NULL,
  `tipo`     ENUM('linea', 'categoria', 'producto') NOT NULL,
  `clave`    VARCHAR(80) NOT NULL,
  PRIMARY KEY (`extra_id`, `tipo`, `clave`),
  CONSTRAINT `fk_tiempos_extra_alcance` FOREIGN KEY (`extra_id`) REFERENCES `tiempos_extras` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rangos de extras: ahora cuelgan de la opción. `extra_id` queda opcional (sin uso al terminar).
SET @t = 'tiempos_extra_rangos'; SET @c = 'opcion_id';
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `tiempos_extra_rangos` ADD COLUMN `opcion_id` INT UNSIGNED DEFAULT NULL AFTER `extra_id`, ADD KEY `idx_tiempos_extra_rango_opcion` (`opcion_id`, `desde`), ADD CONSTRAINT `fk_tiempos_extra_rango_opcion` FOREIGN KEY (`opcion_id`) REFERENCES `tiempos_extra_opciones` (`id`) ON DELETE CASCADE', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c = 'extra_id';
SET @sql = (SELECT IF(COUNT(*) = 1, 'ALTER TABLE `tiempos_extra_rangos` MODIFY `extra_id` INT UNSIGNED DEFAULT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c AND IS_NULLABLE = 'NO');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Reglas de texto.
SET @t = 'tiempos_parametros'; SET @c = 'texto';
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `tiempos_parametros` ADD COLUMN `texto` VARCHAR(255) DEFAULT NULL AFTER `valor`', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c = 'valor';
SET @sql = (SELECT IF(COUNT(*) = 1, 'ALTER TABLE `tiempos_parametros` MODIFY `valor` INT DEFAULT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND COLUMN_NAME = @c AND IS_NULLABLE = 'NO');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ================================================================ conversión de datos

-- 1. Categorías desde el `grupo` de cada producto (clave = línea + nombre, como las crea el módulo).
INSERT INTO `tiempos_categorias` (`version_id`, `clave`, `linea_clave`, `nombre`, `orden`)
SELECT g.`version_id`, g.`clave`, g.`linea_clave`, g.`grupo`, g.`orden`
FROM (
  SELECT p.`version_id`, p.`linea_clave`, p.`grupo`, MIN(p.`orden`) AS `orden`,
    CONCAT(p.`linea_clave`, '-', CASE p.`grupo`
      WHEN 'Piezas fundidas' THEN 'piezas-fundidas' WHEN 'Fotograbado' THEN 'fotograbado' WHEN 'Metal' THEN 'metal'
      WHEN 'Carpintería' THEN 'carpinteria' WHEN 'Vidrio / Mármol' THEN 'vidrio-marmol' WHEN 'Resina (molde nuevo)' THEN 'resina-molde-nuevo'
      WHEN '3D' THEN '3d' ELSE LEFT(MD5(p.`grupo`), 12) END) AS `clave`
  FROM `tiempos_productos` p
  WHERE p.`grupo` IS NOT NULL AND p.`grupo` <> ''
  GROUP BY p.`version_id`, p.`linea_clave`, p.`grupo`
) g
WHERE NOT EXISTS (SELECT 1 FROM `tiempos_categorias` c WHERE c.`version_id` = g.`version_id` AND c.`clave` = g.`clave`);

UPDATE `tiempos_productos` p
JOIN `tiempos_categorias` c ON c.`version_id` = p.`version_id` AND c.`linea_clave` = p.`linea_clave` AND c.`nombre` = p.`grupo`
SET p.`categoria_clave` = c.`clave`
WHERE p.`categoria_clave` IS NULL;

-- 2. Impresión UV: los extras de antes (sin tipo) pasan a ser opciones de un solo extra «uv».
INSERT INTO `tiempos_extras` (`version_id`, `clave`, `tipo`, `nombre`, `etiqueta`, `ayuda`, `todos`, `activo`, `orden`)
SELECT DISTINCT e.`version_id`, 'uv', 'por_cantidad', 'Impresión UV', 'Impresión UV', 'Suma días según el tipo de impresión y la cantidad.', 1, 1, 4
FROM `tiempos_extras` e
WHERE e.`tipo` IS NULL
  AND NOT EXISTS (SELECT 1 FROM `tiempos_extras` x WHERE x.`version_id` = e.`version_id` AND x.`clave` = 'uv');

INSERT INTO `tiempos_extra_opciones` (`extra_id`, `clave`, `nombre`, `aviso`, `orden`)
SELECT uv.`id`, e.`clave`, e.`nombre`, e.`aviso`, e.`orden`
FROM `tiempos_extras` e
JOIN `tiempos_extras` uv ON uv.`version_id` = e.`version_id` AND uv.`clave` = 'uv'
WHERE e.`tipo` IS NULL
  AND NOT EXISTS (SELECT 1 FROM `tiempos_extra_opciones` o WHERE o.`extra_id` = uv.`id` AND o.`clave` = e.`clave`);

UPDATE `tiempos_extra_rangos` er
JOIN `tiempos_extras` e ON e.`id` = er.`extra_id` AND e.`tipo` IS NULL
JOIN `tiempos_extras` uv ON uv.`version_id` = e.`version_id` AND uv.`clave` = 'uv'
JOIN `tiempos_extra_opciones` o ON o.`extra_id` = uv.`id` AND o.`clave` = e.`clave`
SET er.`opcion_id` = o.`id`, er.`extra_id` = NULL
WHERE er.`opcion_id` IS NULL;

DELETE FROM `tiempos_extras` WHERE `tipo` IS NULL;

-- 3. Colores: la regla de antes (colores_incluidos, colores_cada, colores_dias) en un extra por unidades.
INSERT INTO `tiempos_extras` (`version_id`, `clave`, `tipo`, `nombre`, `etiqueta`, `ayuda`, `unidades_incluidas`, `unidades_cada`, `unidades_dias`, `unidades_max`, `todos`, `activo`, `orden`)
SELECT v.`id`, 'colores', 'por_unidades', 'Colores', '¿Cuántos colores lleva?',
  CONCAT('Los tiempos de la tabla incluyen ', COALESCE(pi.`valor`, 2), ' colores.'),
  COALESCE(pi.`valor`, 2), COALESCE(pc.`valor`, 2), COALESCE(pd.`valor`, 1), 12, 1, 1, 1
FROM `tiempos_versiones` v
LEFT JOIN `tiempos_parametros` pi ON pi.`version_id` = v.`id` AND pi.`clave` = 'colores_incluidos'
LEFT JOIN `tiempos_parametros` pc ON pc.`version_id` = v.`id` AND pc.`clave` = 'colores_cada'
LEFT JOIN `tiempos_parametros` pd ON pd.`version_id` = v.`id` AND pd.`clave` = 'colores_dias'
WHERE pi.`clave` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `tiempos_extras` x WHERE x.`version_id` = v.`id` AND x.`clave` = 'colores');

-- 4. Moldes: los días de la regla moldes_dias, ofrecido en las piezas que tenían `permite_moldes`.
INSERT INTO `tiempos_extras` (`version_id`, `clave`, `tipo`, `nombre`, `etiqueta`, `ayuda`, `dias_fijos`, `todos`, `activo`, `orden`)
SELECT v.`id`, 'moldes', 'si_no', 'Moldes', 'Pieza fundida de más de 3.5 pulgadas', 'La fundición cubre hasta 3.5 pulgadas; más grande requiere moldes.', COALESCE(pm.`valor`, 2), 0, 1, 2
FROM `tiempos_versiones` v
LEFT JOIN `tiempos_parametros` pm ON pm.`version_id` = v.`id` AND pm.`clave` = 'moldes_dias'
WHERE pm.`clave` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `tiempos_extras` x WHERE x.`version_id` = v.`id` AND x.`clave` = 'moldes');

-- 5. Costura del lanyard: la columna Costura del producto Lanyard de cada versión, ofrecida donde había `permite_lanyard`.
INSERT INTO `tiempos_extras` (`version_id`, `clave`, `tipo`, `nombre`, `etiqueta`, `ayuda`, `todos`, `activo`, `orden`)
SELECT p.`version_id`, 'costura', 'por_cantidad', 'Costura del lanyard', 'Lleva listón o lanyard cosido', 'Suma la costura de Protextil según la cantidad.', 0, 1, 3
FROM `tiempos_productos` p
WHERE p.`clave` = 'protextil-lanyard'
  AND NOT EXISTS (SELECT 1 FROM `tiempos_extras` x WHERE x.`version_id` = p.`version_id` AND x.`clave` = 'costura');

INSERT INTO `tiempos_extra_opciones` (`extra_id`, `clave`, `nombre`, `orden`)
SELECT e.`id`, 'costura', 'Costura del lanyard', 1
FROM `tiempos_extras` e
WHERE e.`clave` = 'costura'
  AND NOT EXISTS (SELECT 1 FROM `tiempos_extra_opciones` o WHERE o.`extra_id` = e.`id`);

INSERT INTO `tiempos_extra_rangos` (`opcion_id`, `desde`, `hasta`, `dias`, `a_convenir`)
SELECT o.`id`, r.`desde`, r.`hasta`, IF(r.`a_convenir` = 1, NULL, re.`dias`), r.`a_convenir`
FROM `tiempos_extra_opciones` o
JOIN `tiempos_extras` e ON e.`id` = o.`extra_id` AND e.`clave` = 'costura'
JOIN `tiempos_productos` p ON p.`version_id` = e.`version_id` AND p.`clave` = 'protextil-lanyard'
JOIN `tiempos_rangos` r ON r.`producto_id` = p.`id`
LEFT JOIN `tiempos_rango_etapas` re ON re.`rango_id` = r.`id` AND re.`etapa_clave` = 'costura'
WHERE NOT EXISTS (SELECT 1 FROM `tiempos_extra_rangos` x WHERE x.`opcion_id` = o.`id`);

-- 6. Dónde se ofrecen Moldes y Costura: la categoría completa si todos sus productos lo tenían; si no, producto por producto.
INSERT IGNORE INTO `tiempos_extra_alcance` (`extra_id`, `tipo`, `clave`)
SELECT e.`id`, 'categoria', p.`categoria_clave`
FROM `tiempos_extras` e
JOIN `tiempos_productos` p ON p.`version_id` = e.`version_id` AND p.`categoria_clave` IS NOT NULL
WHERE e.`clave` IN ('moldes', 'costura')
  AND NOT EXISTS (SELECT 1 FROM `tiempos_extra_alcance` a WHERE a.`extra_id` = e.`id`)
GROUP BY e.`id`, e.`clave`, p.`categoria_clave`
HAVING MIN(IF(e.`clave` = 'moldes', p.`permite_moldes`, p.`permite_lanyard`)) = 1;

INSERT IGNORE INTO `tiempos_extra_alcance` (`extra_id`, `tipo`, `clave`)
SELECT e.`id`, 'producto', p.`clave`
FROM `tiempos_extras` e
JOIN `tiempos_productos` p ON p.`version_id` = e.`version_id`
WHERE e.`clave` IN ('moldes', 'costura')
  AND IF(e.`clave` = 'moldes', p.`permite_moldes`, p.`permite_lanyard`) = 1
  AND NOT EXISTS (SELECT 1 FROM `tiempos_extra_alcance` a WHERE a.`extra_id` = e.`id` AND a.`tipo` = 'categoria' AND a.`clave` = p.`categoria_clave`);

-- 7. Reglas: las nuevas y fuera las que ya viven en sus extras.
INSERT INTO `tiempos_parametros` (`version_id`, `clave`, `valor`, `texto`, `ayuda`)
SELECT v.`id`, 'max_piezas', 20, NULL, 'Cuántas piezas admite un pedido en la calculadora'
FROM `tiempos_versiones` v
WHERE NOT EXISTS (SELECT 1 FROM `tiempos_parametros` x WHERE x.`version_id` = v.`id` AND x.`clave` = 'max_piezas');

INSERT INTO `tiempos_parametros` (`version_id`, `clave`, `valor`, `texto`, `ayuda`)
SELECT v.`id`, 'aviso_urgente', NULL, 'Pedido urgente: necesita autorización del gerente. Aquí ves los tiempos normales.', 'Se muestra cuando se marca «Urgente»; no cambia los días'
FROM `tiempos_versiones` v
WHERE NOT EXISTS (SELECT 1 FROM `tiempos_parametros` x WHERE x.`version_id` = v.`id` AND x.`clave` = 'aviso_urgente');

DELETE FROM `tiempos_parametros` WHERE `clave` IN ('colores_incluidos', 'colores_cada', 'colores_dias', 'moldes_dias');
