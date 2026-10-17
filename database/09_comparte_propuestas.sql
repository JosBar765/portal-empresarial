-- comparte_propuestas.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   En un vale de varios talleres, permite que los talleres que "comparten propuestas" vean la propuesta aprobada
--   de los otros talleres del mismo vale (solo lectura), reciban un aviso cuando otro taller aprueba la suya y vean
--   una marca en el buzón hasta abrirla. No bloquea a nadie: cada taller avanza por su cuenta.
--
-- Qué agrega (no modifica ni borra ningún dato existente):
--   1. Columna `talleres.comparte_propuestas`: 1 = el taller comparte y puede ver las de otros talleres que también
--      comparten (la regla es simétrica: se ve a otro taller solo si AMBOS tienen 1). Se evalúa al leer, así que
--      cambiarla afecta de inmediato incluso a los vales en curso.
--   2. Tabla `vale_propuestas_otros_vistos`: qué propuesta aprobada de otro taller ya abrió cada usuario.
--
-- Valores iniciales: 1 para 'Diseño', 'Diseño UV/3D' y 'Protextil' (por nombre exacto); 0 para los demás
--   (Diseño Local). Los talleres nuevos nacen en 0 y se activan a mano:
--   UPDATE `talleres` SET `comparte_propuestas` = 1 WHERE `nombre` = '<taller>';
--   El UPDATE solo corre al crear la columna: reimportar el script no pisa lo que se haya cambiado después.
--
-- Cómo se relaciona (solo por llaves foráneas, sin triggers):
--   - `usuario_id` -> `usuarios` y `vale_id` -> `vales`, ambas con ON DELETE CASCADE: borrar un vale o un usuario
--     nunca queda bloqueado por esta tabla.
--   - `taller_origen_id` -> `talleres` (taller cuya propuesta se vio), CASCADE.
--   - `propuesta_id` guarda el id de `vale_propuestas` que se vio (sin FK: es solo una marca de comparación). Si el
--     taller vuelve a entregar y se aprueba otra propuesta, su id es distinto y la marca vuelve a aparecer.
--
-- Permisos: no hay permisos nuevos (usa `vales.ver`).
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_comparte_propuestas.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Importar ANTES de desplegar el código nuevo. No hace falta que los usuarios vuelvan a iniciar sesión.
--
-- Cómo se revierte (solo si hiciera falta):
--   DROP TABLE IF EXISTS `vale_propuestas_otros_vistos`;
--   ALTER TABLE `talleres` DROP COLUMN `comparte_propuestas`;

SET NAMES utf8mb4;

-- 1. talleres.comparte_propuestas (solo si todavía no existe) y valores iniciales
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'talleres' AND COLUMN_NAME = 'comparte_propuestas');
SET @sql := IF(@existe = 0,
  'ALTER TABLE `talleres` ADD COLUMN `comparte_propuestas` TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;

SET @sql := IF(@existe = 0,
  'UPDATE `talleres` SET `comparte_propuestas` = 1 WHERE `nombre` IN (''Diseño'', ''Diseño UV/3D'', ''Protextil'')',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;

-- 2. Propuestas de otros talleres ya vistas por cada usuario
CREATE TABLE IF NOT EXISTS `vale_propuestas_otros_vistos` (
  `usuario_id`       INT NOT NULL,
  `vale_id`          INT NOT NULL,
  `taller_origen_id` INT NOT NULL,
  -- Id de `vale_propuestas` que se abrió; si cambia, vuelve a contar como no vista.
  `propuesta_id`     INT NOT NULL,
  `visto_en`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`usuario_id`, `vale_id`, `taller_origen_id`),
  FOREIGN KEY (`usuario_id`)       REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`vale_id`)          REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`taller_origen_id`) REFERENCES `talleres` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_propuestas_otros_vistos_vale` (`vale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verificación: talleres que comparten tras importar
SELECT `id`, `nombre`, `comparte_propuestas` FROM `talleres` ORDER BY `id`;
