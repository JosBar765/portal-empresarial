-- horarios_laborales.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Habilita la pestaña «Horarios y feriados» de Administración: el horario laboral semanal
--   (global para todas las tiendas), los días que reciben vales de arte, los feriados por país
--   y las horas de vencimiento de un vale. También agrega la hora máxima de recibimiento por taller.
--   Se puede importar sobre una base que ya corrió la versión anterior de este script.
--
-- Qué agrega:
--   1. Tabla `horarios_laborales`: una fila por día (1 = lunes ... 7 = domingo), con la casilla
--      `recibe_vales` (solo un día laboral puede recibir vales).
--   2. Los 7 días iniciales si no existen (no pisa lo que el admin ya cargó): lunes a viernes
--      08:00-18:00 y reciben vales; sábado 08:00-12:00 sin recibir vales; domingo no laboral.
--   3. Tabla `feriados` y el feriado inicial de Guatemala (20/10, anual) si no existe.
--   4. Columna `talleres`.`hora_maxima_recepcion` (por defecto 12:00:00 en todos los talleres).
--   5. Tabla `parametros_sistema` con `horas_vencimiento_vale` = 4 (no pisa un valor ya cambiado).
--   6. Permiso `admin.horarios.gestionar` (tabla `permisos`), asignado SOLO al rol Administrador.
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_horarios_laborales.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Después, los usuarios Administrador deben cerrar sesión e iniciar de nuevo
--   para que su token incluya el permiso nuevo.
--
-- Reversa (solo si hace falta deshacerlo; borra los datos cargados):
--   DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id` WHERE p.`codigo` = 'admin.horarios.gestionar';
--   DELETE FROM `permisos` WHERE `codigo` = 'admin.horarios.gestionar';
--   DROP TABLE IF EXISTS `parametros_sistema`;
--   ALTER TABLE `talleres` DROP COLUMN `hora_maxima_recepcion`;
--   DROP TABLE IF EXISTS `feriados`;
--   DROP TABLE IF EXISTS `horarios_laborales`;

SET NAMES utf8mb4;

-- Un día no laboral no lleva horas ni recibe vales; uno laboral lleva inicio y fin con inicio < fin.
-- MySQL 8.0.16+ aplica los CHECK; en motores que los ignoran (MySQL anterior, MariaDB antigua)
-- la misma validación la hace el servicio de Administración.
CREATE TABLE IF NOT EXISTS `horarios_laborales` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `dia_semana`    TINYINT      NOT NULL COMMENT '1 = lunes ... 7 = domingo',
  `laboral`       TINYINT(1)   NOT NULL DEFAULT 0,
  `recibe_vales`  TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Si el día recibe vales de arte; solo un día laboral puede',
  `hora_inicio`   TIME         DEFAULT NULL,
  `hora_fin`      TIME         DEFAULT NULL,
  `creado_en`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_horarios_laborales_dia` (`dia_semana`),
  CONSTRAINT `chk_horarios_laborales_dia` CHECK (`dia_semana` BETWEEN 1 AND 7),
  CONSTRAINT `chk_horarios_laborales_horas` CHECK (
    (`laboral` = 0 AND `hora_inicio` IS NULL AND `hora_fin` IS NULL)
    OR (`laboral` = 1 AND `hora_inicio` IS NOT NULL AND `hora_fin` IS NOT NULL AND `hora_inicio` < `hora_fin`)
  ),
  CONSTRAINT `chk_horarios_laborales_recibe` CHECK (`laboral` = 1 OR `recibe_vales` = 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bases que ya tenían la tabla: la columna y el CHECK se agregan solo si faltan.
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `horarios_laborales` ADD COLUMN `recibe_vales` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''Si el día recibe vales de arte; solo un día laboral puede'' AFTER `laboral`',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'horarios_laborales' AND COLUMN_NAME = 'recibe_vales');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `horarios_laborales` ADD CONSTRAINT `chk_horarios_laborales_recibe` CHECK (`laboral` = 1 OR `recibe_vales` = 0)',
  'SELECT 1')
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'horarios_laborales'
    AND CONSTRAINT_NAME = 'chk_horarios_laborales_recibe' AND CONSTRAINT_TYPE = 'CHECK');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Horario inicial; el administrador lo ajusta desde la pestaña.
INSERT INTO `horarios_laborales` (`dia_semana`, `laboral`, `recibe_vales`, `hora_inicio`, `hora_fin`)
SELECT d.`dia`, d.`laboral`, d.`recibe`, d.`inicio`, d.`fin`
FROM (SELECT 1 AS `dia`, 1 AS `laboral`, 1 AS `recibe`, '08:00:00' AS `inicio`, '18:00:00' AS `fin`
      UNION ALL SELECT 2, 1, 1, '08:00:00', '18:00:00'
      UNION ALL SELECT 3, 1, 1, '08:00:00', '18:00:00'
      UNION ALL SELECT 4, 1, 1, '08:00:00', '18:00:00'
      UNION ALL SELECT 5, 1, 1, '08:00:00', '18:00:00'
      UNION ALL SELECT 6, 1, 0, '08:00:00', '12:00:00'
      UNION ALL SELECT 7, 0, 0, NULL, NULL) d
WHERE NOT EXISTS (SELECT 1 FROM `horarios_laborales` h WHERE h.`dia_semana` = d.`dia`);

-- Feriados por país. Con `se_repite_cada_anio` = 1 vale cada año en el mismo día y mes de `fecha`.
CREATE TABLE IF NOT EXISTS `feriados` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `pais_id`             INT          NOT NULL,
  `fecha`               DATE         NOT NULL,
  `nombre`              VARCHAR(100) NOT NULL,
  `se_repite_cada_anio` TINYINT(1)   NOT NULL DEFAULT 0,
  `creado_en`           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY `uq_feriados_pais_fecha` (`pais_id`, `fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Feriado inicial de Guatemala (el país se busca por nombre).
INSERT INTO `feriados` (`pais_id`, `fecha`, `nombre`, `se_repite_cada_anio`)
SELECT p.`id`, '2026-10-20', 'Día de la Revolución', 1 FROM `paises` p
WHERE p.`nombre` = 'Guatemala'
  AND NOT EXISTS (SELECT 1 FROM `feriados` f WHERE f.`pais_id` = p.`id` AND f.`fecha` = '2026-10-20');

-- Hora máxima (Guatemala) hasta la que un taller recibe vales con entrega el mismo día.
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `talleres` ADD COLUMN `hora_maxima_recepcion` TIME NOT NULL DEFAULT ''12:00:00'' COMMENT ''Hora máxima (Guatemala) para recibir vales con entrega el mismo día''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'talleres' AND COLUMN_NAME = 'hora_maxima_recepcion');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Parámetros globales editables por el administrador.
CREATE TABLE IF NOT EXISTS `parametros_sistema` (
  `clave`          VARCHAR(60)  NOT NULL PRIMARY KEY,
  `valor`          VARCHAR(100) NOT NULL,
  `descripcion`    VARCHAR(255) DEFAULT NULL,
  `actualizado_en` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `parametros_sistema` (`clave`, `valor`, `descripcion`)
SELECT 'horas_vencimiento_vale', '4', 'Horas laborales de vigencia de un vale de arte (entero de 1 a 48)' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `parametros_sistema` WHERE `clave` = 'horas_vencimiento_vale');

-- Permiso nuevo, sin id fijo (se usa el siguiente libre de esta base).
INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'admin.horarios.gestionar', 'Gestionar Horarios y Feriados', 'admin',
       'Permite administrar el horario laboral semanal y los feriados por país'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'admin.horarios.gestionar');

-- Solo el rol Administrador (buscado por nombre) recibe el permiso.
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT r.`id`, p.`id` FROM `roles` r
JOIN `permisos` p ON p.`codigo` = 'admin.horarios.gestionar'
WHERE r.`nombre` = 'Administrador'
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` rp WHERE rp.`rol_id` = r.`id` AND rp.`permiso_id` = p.`id`);
