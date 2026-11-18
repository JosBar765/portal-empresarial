-- vale_bajas.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Cuando un vale se elimina completo (baja del asesor, vencimiento de la vigencia, vencimiento de adjuntos o
--   solicitud de modificación rechazada) el `DELETE` borra la fila y el cascade se lleva sus talleres, documentos e
--   historial: no queda rastro. Esta tabla guarda un registro permanente de cada baja, en la misma transacción que el
--   borrado, para saber qué vale era, de quién, por qué se eliminó y cuándo.
--
-- Qué agrega:
--   1. La tabla `vale_bajas`, sin claves foráneas hacia `vales` ni `usuarios`: el registro debe sobrevivir al borrado
--      del vale y a cambios en los usuarios (el nombre y el correo del dueño y de quien eliminó se guardan como foto).
--      Nadie la purga: es un historial permanente.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (solo si hiciera falta; borra el registro):
--   DROP TABLE IF EXISTS `vale_bajas`;

SET NAMES utf8mb4;

-- `motivo` es el código (BAJA_ASESOR, VENCIMIENTO_VIGENCIA, VENCIMIENTO_ADJUNTOS, MODIFICACION_RECHAZADA) y `razon`,
-- el texto legible: «vencimiento», «eliminado por: <correo>» o «rechazado por: <correo>».
-- `correlativo` no es único: una solicitud de modificación (MOD-) comparte número con su vale original.
CREATE TABLE IF NOT EXISTS `vale_bajas` (
  `id`                        INT AUTO_INCREMENT PRIMARY KEY,
  `correlativo`               VARCHAR(60)  NOT NULL,
  `cliente_empresa`           VARCHAR(150) DEFAULT NULL,
  `cliente_nombre`            VARCHAR(150) NOT NULL,
  `asesor_id`                 INT DEFAULT NULL,
  `asesor_nombre`             VARCHAR(150) DEFAULT NULL,
  `asesor_correo`             VARCHAR(150) DEFAULT NULL,
  `vale_original_correlativo` VARCHAR(60)  DEFAULT NULL,
  `estado`                    VARCHAR(50)  NOT NULL,
  `motivo`                    VARCHAR(30)  NOT NULL,
  `razon`                     VARCHAR(255) NOT NULL,
  `eliminado_por_id`          INT DEFAULT NULL,
  `eliminado_por_correo`      VARCHAR(150) DEFAULT NULL,
  `creado_en_vale`            DATETIME NOT NULL,
  `eliminado_en`              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_vale_bajas_correlativo` (`correlativo`),
  INDEX `idx_vale_bajas_eliminado_en` (`eliminado_en`),
  INDEX `idx_vale_bajas_asesor` (`asesor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
