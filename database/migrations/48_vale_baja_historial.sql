-- vale_baja_historial.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Al eliminar un vale completo (baja del asesor, vencimiento, solicitud de modificación rechazada) el cascade se lleva su
--   `vale_historial`. `vale_bajas` guarda la foto final y el motivo, pero no lo que pasó antes. Esta tabla copia el
--   historial del vale en la misma transacción que el borrado, para poder auditar siempre qué le ocurrió.
--
-- Qué agrega:
--   1. La tabla `vale_baja_historial`: una fila por cada fila del historial del vale, ligada a `vale_bajas`. Sin claves
--      foráneas hacia `vales`, `usuarios` ni `talleres`: debe sobrevivir al borrado y a cambios posteriores (el correo
--      del usuario y el nombre del taller se guardan como foto). Nadie la purga: es un registro permanente.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (solo si hiciera falta; borra el registro):
--   DROP TABLE IF EXISTS `vale_baja_historial`;

SET NAMES utf8mb4;

-- `baja_id` es el id de `vale_bajas`. El resto copia las columnas de `vale_historial` (`creado_en` es la fecha original).
CREATE TABLE IF NOT EXISTS `vale_baja_historial` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `baja_id`         INT NOT NULL,
  `usuario_id`      INT DEFAULT NULL,
  `usuario_correo`  VARCHAR(150) DEFAULT NULL,
  `taller_id`       INT DEFAULT NULL,
  `taller_nombre`   VARCHAR(150) DEFAULT NULL,
  `disenador_id`    INT DEFAULT NULL,
  `estado_anterior` VARCHAR(50)  DEFAULT NULL,
  `estado_nuevo`    VARCHAR(50)  NOT NULL,
  `accion`          VARCHAR(500) NOT NULL,
  `creado_en`       DATETIME NOT NULL,
  INDEX `idx_vale_baja_historial_baja` (`baja_id`, `creado_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
