-- pais_comparte_diseno_local.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Los asesores de un país solo podían enviar vales al Diseño Local que atiende su tienda. Con este dato, los países que lo
--   tengan activo comparten sus Diseño Local entre sí: un asesor de uno puede elegir los Diseño Local de los otros.
--
-- Qué agrega:
--   La columna `paises.comparte_diseno_local` (1 = los asesores del país pueden enviar vales a los Diseño Local de otros países
--   que también la tengan en 1, y sus Diseño Local se ofrecen a ellos). Se edita desde Administración Central.
--   Al crearla queda en 1 para El Salvador, Honduras, Nicaragua y Costa Rica (identificados por nombre, sin ids fijos) y en 0 en los
--   demás países (Guatemala, Belice...). Si la columna ya existía no se toca ningún valor: respeta lo que el administrador eligió.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (solo si hiciera falta; cada Diseño Local vuelve a atender únicamente a sus tiendas):
--   ALTER TABLE `paises` DROP COLUMN `comparte_diseno_local`;

SET NAMES utf8mb4;

-- 1. paises.comparte_diseno_local (solo si todavía no existe)
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'paises' AND COLUMN_NAME = 'comparte_diseno_local');
SET @sql := IF(@existe = 0,
  'ALTER TABLE `paises` ADD COLUMN `comparte_diseno_local` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1 = sus asesores usan los Diseño Local de otros países que también comparten, y sus Diseño Local se les ofrecen''',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;

-- 2. Valor inicial, solo cuando la columna acaba de crearse (así repetir el script no pisa lo que el administrador cambió).
SET @sql := IF(@existe = 0,
  'UPDATE `paises` SET `comparte_diseno_local` = 1 WHERE `nombre` IN (''El Salvador'', ''Honduras'', ''Nicaragua'', ''Costa Rica'')',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;
