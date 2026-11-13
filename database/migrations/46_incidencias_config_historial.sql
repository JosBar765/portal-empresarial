-- incidencias_config_historial.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué agrega (módulo «Incidencias», fase 3): el historial de cambios de la configuración del módulo (quién cambió qué,
-- con el valor de antes y el de después), para poder responder «¿quién apagó ese país?» o «¿quién cambió la prioridad?».
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Reversa (solo si hace falta deshacerlo; borra los datos cargados): DROP TABLE IF EXISTS `incidencia_config_historial`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `incidencia_config_historial` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT DEFAULT NULL,
  `entidad`    VARCHAR(40) NOT NULL,
  `clave`      VARCHAR(80) NOT NULL,
  `accion`     VARCHAR(20) NOT NULL,
  `antes`      JSON DEFAULT NULL,
  `despues`    JSON DEFAULT NULL,
  `creado_en`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_incidencia_config_historial_fecha` (`creado_en`),
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
