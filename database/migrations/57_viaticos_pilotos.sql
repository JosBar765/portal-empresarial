-- 57_viaticos_pilotos.sql
-- Módulo Calculadora de Viáticos: pilotos (repartidores de la empresa) que manejan en los viajes que tramita un solicitante.
--
-- Qué hace:
--   1. `viaticos_pilotos`: registro compartido de pilotos (nombre, tipo de licencia, número, vencimiento, activo).
--      No son usuarios del portal; se desactivan, nunca se borran.
--   2. `viaticos_solicitudes.piloto_id`: piloto que maneja el viaje (NULL = maneja el solicitante, como hasta ahora).
--
-- Cómo se aplica (idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (el código nuevo dejaría de funcionar hasta quitarlo):
--   ALTER TABLE `viaticos_solicitudes` DROP FOREIGN KEY `fk_viaticos_solicitudes_piloto`;
--   ALTER TABLE `viaticos_solicitudes` DROP COLUMN `piloto_id`;
--   DROP TABLE `viaticos_pilotos`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `viaticos_pilotos` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`           VARCHAR(100) NOT NULL,
  `tipo_licencia_id` INT NOT NULL,
  `numero`           VARCHAR(50) NOT NULL,
  `vence_el`         DATE NOT NULL,
  `activo`           TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_viaticos_pilotos_tipo_licencia` (`tipo_licencia_id`),
  FOREIGN KEY (`tipo_licencia_id`) REFERENCES `viaticos_tipos_licencia` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `viaticos_solicitudes` ADD COLUMN `piloto_id` INT NULL DEFAULT NULL COMMENT ''Piloto que maneja el viaje; NULL = maneja el solicitante'', ADD INDEX `idx_viaticos_solicitudes_piloto` (`piloto_id`), ADD CONSTRAINT `fk_viaticos_solicitudes_piloto` FOREIGN KEY (`piloto_id`) REFERENCES `viaticos_pilotos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_solicitudes' AND COLUMN_NAME = 'piloto_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
