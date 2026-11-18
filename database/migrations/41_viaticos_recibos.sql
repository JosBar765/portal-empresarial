-- viaticos_recibos.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   La liquidación de un viaje de más de 1 día respalda las comidas y la depreciación con un recibo que genera y
--   firma el propio solicitante (PDF con la firma dibujada), y admite recibos de cualquier otro dinero recibido.
--
-- Qué agrega:
--   1. Tabla `viaticos_recibos`: un renglón por recibo (rubro, fecha, monto y su texto en letras, datos del pago y
--      la URL del PDF en Storage). Se borra sola al eliminar la solicitud (CASCADE).
--   2. `viaticos_monedas.nombre_plural`: el plural que el recibo escribe tras el monto en letras («quetzales»);
--      se rellena para las monedas de la semilla sin pisar un valor ya cambiado.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--   Se aplica después de `viaticos_rechazo_vencimiento` (el ejecutor ordena por nombre).
--
-- Cómo se revierte (solo si hiciera falta; la liquidación dejaría de funcionar hasta quitar también el código de recibos):
--   DROP TABLE IF EXISTS `viaticos_recibos`;
--   ALTER TABLE `viaticos_monedas` DROP COLUMN `nombre_plural`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `viaticos_recibos` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `solicitud_id`  INT NOT NULL,
  `contador`      INT NOT NULL COMMENT 'X de <correlativo>-RX, por solicitud',
  `numero`        VARCHAR(40) NOT NULL COMMENT '<correlativo>-R<contador>',
  `rubro`         ENUM('alimentacion','depreciacion','otro') NOT NULL,
  `fecha`         DATE NOT NULL,
  `monto`         DECIMAL(10,2) NOT NULL CHECK (`monto` > 0),
  `monto_letras`  VARCHAR(255) NOT NULL,
  `recibi_de`     VARCHAR(100) NOT NULL,
  `concepto`      VARCHAR(200) NOT NULL,
  `forma_pago`    ENUM('efectivo','cheque','transferencia') NOT NULL,
  `numero_cheque` VARCHAR(30) DEFAULT NULL COMMENT 'Solo con forma de pago cheque',
  `numero_cuenta` VARCHAR(40) DEFAULT NULL COMMENT 'Opcional, solo con transferencia',
  `ruta`          VARCHAR(500) NOT NULL,
  `tamano`        INT UNSIGNED NOT NULL,
  `creado_en`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_viaticos_recibos_solicitud_contador` (`solicitud_id`, `contador`),
  FOREIGN KEY (`solicitud_id`) REFERENCES `viaticos_solicitudes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `viaticos_monedas` ADD COLUMN `nombre_plural` VARCHAR(50) NULL COMMENT ''Plural para el monto en letras del recibo''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'viaticos_monedas' AND COLUMN_NAME = 'nombre_plural');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `viaticos_monedas` m
JOIN (
  SELECT 'GTQ' AS `codigo`, 'Quetzales' AS `plural`
  UNION ALL SELECT 'USD', 'Dólares'
  UNION ALL SELECT 'HNL', 'Lempiras'
  UNION ALL SELECT 'NIO', 'Córdobas'
  UNION ALL SELECT 'CRC', 'Colones'
  UNION ALL SELECT 'PAB', 'Balboas'
  UNION ALL SELECT 'BZD', 'Dólares beliceños'
) d ON d.`codigo` = m.`codigo`
SET m.`nombre_plural` = d.`plural`
WHERE m.`nombre_plural` IS NULL;
