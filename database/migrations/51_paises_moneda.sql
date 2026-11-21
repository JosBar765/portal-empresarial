-- paises_moneda.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   La cotización de los vales mostraba siempre «Q» (quetzal). Ahora cada país declara su moneda y el vale usa la del país de su tienda.
--
-- Qué agrega:
--   Las columnas `paises.moneda_simbolo` (p. ej. Q) y `paises.moneda_codigo` (código ISO 4217, p. ej. GTQ), ambas opcionales.
--   Un país sin moneda configurada muestra la cotización sin símbolo. Valores iniciales, identificando el país por nombre (sin ids
--   fijos) y solo donde la columna sigue vacía: Guatemala Q/GTQ, El Salvador $/USD, Honduras L/HNL, Nicaragua C$/NIO, Costa Rica ₡/CRC.
--   Belice no se siembra: queda sin moneda hasta que el dueño la confirme.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (solo si hiciera falta; la cotización vuelve a mostrarse sin símbolo):
--   ALTER TABLE `paises` DROP COLUMN `moneda_simbolo`, DROP COLUMN `moneda_codigo`;

SET NAMES utf8mb4;

-- 1. paises.moneda_simbolo (solo si todavía no existe)
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'paises' AND COLUMN_NAME = 'moneda_simbolo');
SET @sql := IF(@existe = 0,
  'ALTER TABLE `paises` ADD COLUMN `moneda_simbolo` VARCHAR(5) NULL COMMENT ''Símbolo de la moneda del país (Q, $, L...); NULL = sin símbolo''',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;

-- 2. paises.moneda_codigo (solo si todavía no existe)
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'paises' AND COLUMN_NAME = 'moneda_codigo');
SET @sql := IF(@existe = 0,
  'ALTER TABLE `paises` ADD COLUMN `moneda_codigo` VARCHAR(3) NULL COMMENT ''Código ISO 4217 de la moneda del país (GTQ, USD...)''',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;

-- 3. Valores iniciales: solo donde siguen vacíos (repetir el script no pisa lo que se haya cambiado).
UPDATE `paises` SET `moneda_simbolo` = 'Q',  `moneda_codigo` = 'GTQ' WHERE `nombre` = 'Guatemala'   AND `moneda_simbolo` IS NULL AND `moneda_codigo` IS NULL;
UPDATE `paises` SET `moneda_simbolo` = '$',  `moneda_codigo` = 'USD' WHERE `nombre` = 'El Salvador' AND `moneda_simbolo` IS NULL AND `moneda_codigo` IS NULL;
UPDATE `paises` SET `moneda_simbolo` = 'L',  `moneda_codigo` = 'HNL' WHERE `nombre` = 'Honduras'    AND `moneda_simbolo` IS NULL AND `moneda_codigo` IS NULL;
UPDATE `paises` SET `moneda_simbolo` = 'C$', `moneda_codigo` = 'NIO' WHERE `nombre` = 'Nicaragua'    AND `moneda_simbolo` IS NULL AND `moneda_codigo` IS NULL;
UPDATE `paises` SET `moneda_simbolo` = '₡',  `moneda_codigo` = 'CRC' WHERE `nombre` = 'Costa Rica'   AND `moneda_simbolo` IS NULL AND `moneda_codigo` IS NULL;
