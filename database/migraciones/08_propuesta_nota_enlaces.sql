-- propuesta_nota_enlaces.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Permite que, al entregar una propuesta (Diseñador) o al adjuntar la fusión de un vale de varios talleres
--   (Encargado/Asistente), se pueda agregar además una NOTA con observaciones y hasta 5 ENLACES a documentos
--   alojados en otras plataformas. Al entregar una propuesta el PDF sigue siendo obligatorio (una propuesta solo con
--   enlaces no es válida; la nota y los enlaces son complementos); la fusión también exige el PDF.
--   Nada de esto cambia los datos que ya existen.
--
-- Qué agrega (solo columnas y una tabla nuevas; no modifica ni borra ningún dato, índice ni permiso existente):
--   1. Columna `vale_propuestas.nota`: observaciones del diseñador al entregar (máx. 500 caracteres).
--   2. Columna `vales.propuesta_general_nota`: observaciones de quien fusionó (máx. 500 caracteres).
--   3. Tabla `vale_propuesta_enlaces`: un enlace de una propuesta. Con `propuesta_id` NULL es un enlace de la
--      fusión del vale.
--
-- Cómo se relaciona (solo por llaves foráneas, sin triggers):
--   - `vale_id` -> `vales` y `propuesta_id` -> `vale_propuestas`, ambas con ON DELETE CASCADE: si el vale se elimina
--     (rechazo, baja o plazo vencido), sus enlaces caen con él.
--
-- Permisos: no hay permisos nuevos. Escribe quien ya puede entregar la propuesta (`vales.trabajar`) o fusionar
-- (`vales.aprobar_general`).
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_propuesta_nota_enlaces.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Importar ANTES de desplegar el código nuevo. No hace falta que los usuarios vuelvan a iniciar sesión.
--
-- Cómo se revierte (solo si hiciera falta; borra las notas y los enlaces):
--   DROP TABLE IF EXISTS `vale_propuesta_enlaces`;
--   ALTER TABLE `vale_propuestas` DROP COLUMN `nota`;
--   ALTER TABLE `vales` DROP COLUMN `propuesta_general_nota`;

SET NAMES utf8mb4;

-- 1. vale_propuestas.nota (solo si todavía no existe)
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vale_propuestas' AND COLUMN_NAME = 'nota');
SET @sql := IF(@existe = 0,
  'ALTER TABLE `vale_propuestas` ADD COLUMN `nota` VARCHAR(500) DEFAULT NULL',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;

-- 2. vales.propuesta_general_nota (solo si todavía no existe)
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vales' AND COLUMN_NAME = 'propuesta_general_nota');
SET @sql := IF(@existe = 0,
  'ALTER TABLE `vales` ADD COLUMN `propuesta_general_nota` VARCHAR(500) DEFAULT NULL',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;

-- 3. Enlaces de la propuesta o de la fusión
CREATE TABLE IF NOT EXISTS `vale_propuesta_enlaces` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`      INT NOT NULL,
  -- NULL = enlace de la fusión del vale (no de una propuesta de taller).
  `propuesta_id` INT DEFAULT NULL,
  -- Nombre opcional que el usuario le da al enlace (máx. 80 caracteres).
  `nombre`       VARCHAR(80) DEFAULT NULL,
  -- Siempre https (también se valida en el servidor).
  `url`          VARCHAR(500) NOT NULL,
  `orden`        TINYINT NOT NULL DEFAULT 0,
  `creado_en`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`) REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`propuesta_id`) REFERENCES `vale_propuestas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_propuesta_enlaces_propuesta` (`propuesta_id`),
  INDEX `idx_propuesta_enlaces_vale` (`vale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
