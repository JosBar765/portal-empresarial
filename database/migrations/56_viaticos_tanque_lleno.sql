-- 56_viaticos_tanque_lleno.sql
-- Módulo Calculadora de Viáticos: viajes que salen con el tanque lleno solo pagan la diferencia de galones.
--
-- Qué hace:
--   1. `viaticos_vehiculos.capacidad_tanque_galones`: capacidad del tanque en galones (opcional; NULL = el vehículo
--      pide viáticos completos y no ofrece la casilla «Sale con el tanque lleno»).
--   2. `viaticos_solicitudes.tanque_lleno`: 1 si el viaje sale con el tanque lleno (0 en las solicitudes existentes).
--   3. `viaticos_solicitudes.capacidad_tanque_galones`: capacidad vigente al crear la solicitud (NULL si no es
--      tanque lleno); así editar el vehículo después no altera PDF, liquidación ni reportes.
--
-- Cómo se aplica (idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (el código nuevo dejaría de funcionar hasta quitarlo):
--   ALTER TABLE `viaticos_vehiculos` DROP COLUMN `capacidad_tanque_galones`;
--   ALTER TABLE `viaticos_solicitudes` DROP COLUMN `tanque_lleno`, DROP COLUMN `capacidad_tanque_galones`;

-- Nota: las dos columnas con CHECK no llevan COMMENT porque MariaDB no admite CHECK (...) seguido de COMMENT en la misma columna.
-- Capacidad del tanque: en galones; NULL = el vehículo no sale con tanque lleno. En la solicitud: la capacidad vigente al crearla.
SET NAMES utf8mb4;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `viaticos_vehiculos` ADD COLUMN `capacidad_tanque_galones` DECIMAL(10,2) NULL DEFAULT NULL CHECK (`capacidad_tanque_galones` IS NULL OR `capacidad_tanque_galones` > 0)',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_vehiculos' AND COLUMN_NAME = 'capacidad_tanque_galones');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `viaticos_solicitudes` ADD COLUMN `tanque_lleno` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1 = sale con el tanque lleno y solo paga la diferencia de galones''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_solicitudes' AND COLUMN_NAME = 'tanque_lleno');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `viaticos_solicitudes` ADD COLUMN `capacidad_tanque_galones` DECIMAL(10,2) NULL DEFAULT NULL CHECK (`capacidad_tanque_galones` IS NULL OR `capacidad_tanque_galones` > 0)',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_solicitudes' AND COLUMN_NAME = 'capacidad_tanque_galones');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
