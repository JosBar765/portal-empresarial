-- proyectos_clientes_eventos.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué agrega (módulo «Proyectos», fase 2: empresas):
--   1. `proy_motivos_no_contactar`: catálogo editable de los motivos al marcar una empresa como «No contactar» o
--      «inactiva». Semillas: «El cliente lo pidió», «Cerró o ya no existe», «Datos incorrectos» y «Otro».
--   2. `proy_cliente_eventos`: historial de los cambios de estado de una empresa (no contactar, inactiva, reactivar):
--      quién, cuándo, de qué estado a cuál y por qué. Nunca se edita ni se borra una fila.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (solo si hiciera falta; borra el historial):
--   DROP TABLE IF EXISTS `proy_cliente_eventos`;
--   DROP TABLE IF EXISTS `proy_motivos_no_contactar`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `proy_motivos_no_contactar` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL UNIQUE,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `orden`  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `accion`: no_contactar | inactivar | reactivar. `motivo` guarda el nombre del motivo tal como estaba al elegirlo
-- (o nada al reactivar); `nota` es el texto libre (obligatorio al reactivar).
CREATE TABLE IF NOT EXISTS `proy_cliente_eventos` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `cliente_id`      INT NOT NULL,
  `usuario_id`      INT NOT NULL,
  `accion`          VARCHAR(20) NOT NULL,
  `estado_anterior` VARCHAR(20) NOT NULL,
  `estado_nuevo`    VARCHAR(20) NOT NULL,
  `motivo`          VARCHAR(100) DEFAULT NULL,
  `nota`            VARCHAR(500) DEFAULT NULL,
  `creado_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`cliente_id`) REFERENCES `proy_clientes` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  INDEX `idx_proy_cliente_eventos_cliente` (`cliente_id`, `creado_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `proy_motivos_no_contactar` (`nombre`, `orden`)
SELECT n.`nombre`, n.`orden`
FROM (
  SELECT 'El cliente lo pidió' AS `nombre`, 1 AS `orden`
  UNION ALL SELECT 'Cerró o ya no existe', 2
  UNION ALL SELECT 'Datos incorrectos', 3
  UNION ALL SELECT 'Otro', 4
) n
WHERE NOT EXISTS (SELECT 1 FROM `proy_motivos_no_contactar` x WHERE x.`nombre` = n.`nombre`);
