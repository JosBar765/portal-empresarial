-- horarios_laborales.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Habilita la pestaña «Horarios y feriados» de Administración: el horario laboral semanal
--   (global para todas las tiendas) y los feriados por país. Por ahora solo se administran
--   (CRUD); ninguna regla de vales, vencimientos ni fechas de entrega los consulta todavía.
--
-- Qué agrega:
--   1. Tabla `horarios_laborales`: una fila por día de la semana (1 = lunes ... 7 = domingo).
--   2. Los 7 días iniciales, como no laborales y sin horas (no pisa lo que el admin ya cargó).
--   3. Tabla `feriados`: feriados por país (sin datos iniciales: los carga el administrador).
--   4. Permiso `admin.horarios.gestionar` (tabla `permisos`), asignado SOLO al rol Administrador.
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
--   DROP TABLE IF EXISTS `feriados`;
--   DROP TABLE IF EXISTS `horarios_laborales`;

SET NAMES utf8mb4;

-- Un día no laboral no lleva horas; uno laboral lleva inicio y fin con inicio < fin.
-- MySQL 8.0.16+ aplica los CHECK; en motores que los ignoran (MySQL anterior, MariaDB antigua)
-- la misma validación la hace el servicio de Administración.
CREATE TABLE IF NOT EXISTS `horarios_laborales` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `dia_semana`    TINYINT      NOT NULL COMMENT '1 = lunes ... 7 = domingo',
  `laboral`       TINYINT(1)   NOT NULL DEFAULT 0,
  `hora_inicio`   TIME         DEFAULT NULL,
  `hora_fin`      TIME         DEFAULT NULL,
  `creado_en`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_horarios_laborales_dia` (`dia_semana`),
  CONSTRAINT `chk_horarios_laborales_dia` CHECK (`dia_semana` BETWEEN 1 AND 7),
  CONSTRAINT `chk_horarios_laborales_horas` CHECK (
    (`laboral` = 0 AND `hora_inicio` IS NULL AND `hora_fin` IS NULL)
    OR (`laboral` = 1 AND `hora_inicio` IS NOT NULL AND `hora_fin` IS NOT NULL AND `hora_inicio` < `hora_fin`)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Los 7 días arrancan como no laborales; el administrador los configura desde la pestaña.
INSERT INTO `horarios_laborales` (`dia_semana`, `laboral`, `hora_inicio`, `hora_fin`)
SELECT d.`dia`, 0, NULL, NULL
FROM (SELECT 1 AS `dia` UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7) d
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
