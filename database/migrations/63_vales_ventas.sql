-- vales_ventas.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Registrar la venta de un vale recibido con su número de orden de venta (OV), confirmada por el supervisor.
--   La venta no es un estado del vale: vive en tablas propias.
--
-- Qué agrega:
--   1. `vale_ventas`: cada OV registrada. `numero_activo` y `vale_activo` solo tienen valor mientras la venta está
--      por confirmar o confirmada; sus índices únicos impiden repetir una OV en la empresa y dos ventas en un vale.
--   2. `vale_venta_eventos`: bitácora de cada intento y cambio, sin clave foránea para que sobreviva al vale.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (primero volver al código anterior; borra el registro de ventas):
--   DROP TABLE IF EXISTS `vale_venta_eventos`; DROP TABLE IF EXISTS `vale_ventas`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `vale_ventas` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`        INT NOT NULL,
  `vale_activo`    INT NULL COMMENT 'vale_id mientras la venta está activa; NULL si se rechazó o borró',
  `numero_ov`      BIGINT UNSIGNED NOT NULL,
  `numero_activo`  BIGINT UNSIGNED NULL COMMENT 'numero_ov mientras la venta está activa; NULL si se rechazó o borró',
  `estado`         VARCHAR(20) NOT NULL COMMENT 'POR_CONFIRMAR, CONFIRMADA, RECHAZADA o BORRADA',
  `registrada_por` INT NOT NULL,
  `registrada_en`  DATETIME NOT NULL,
  `resuelta_por`   INT NULL,
  `resuelta_en`    DATETIME NULL,
  UNIQUE KEY `uq_vale_ventas_numero_activo` (`numero_activo`),
  UNIQUE KEY `uq_vale_ventas_vale_activo` (`vale_activo`),
  INDEX `idx_vale_ventas_vale` (`vale_id`),
  INDEX `idx_vale_ventas_estado` (`estado`),
  FOREIGN KEY (`vale_id`) REFERENCES `vales`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vale_venta_eventos` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`         INT NOT NULL,
  `evento`          VARCHAR(30) NOT NULL COMMENT 'REGISTRADA, CORREGIDA, BORRADA, CONFIRMADA, RECHAZADA o DUPLICADO_BLOQUEADO',
  `numero_ov`       BIGINT UNSIGNED NOT NULL,
  `numero_anterior` BIGINT UNSIGNED NULL,
  `usuario_id`      INT NOT NULL,
  `creado_en`       DATETIME NOT NULL,
  INDEX `idx_vale_venta_eventos_vale` (`vale_id`),
  INDEX `idx_vale_venta_eventos_numero` (`numero_ov`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
