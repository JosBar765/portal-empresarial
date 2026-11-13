-- incidencias_notificaciones_referencia.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué agrega: las columnas opcionales `referencia_tipo` y `referencia_id` en `notificaciones`, para que un aviso de
-- Incidencias lleve a su incidencia sin depender de `vale_id`. No afectan lo existente. Son las mismas columnas que
-- agrega el script de Proyectos (`proyectos_trabajo_asesor`): cada paso solo actúa si la columna falta, así que el
-- orden entre ambos scripts no importa.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Reversa (solo si Proyectos tampoco las usa): ALTER TABLE `notificaciones` DROP COLUMN `referencia_id`, DROP COLUMN `referencia_tipo`;

SET NAMES utf8mb4;

SET @agregar_tipo = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `notificaciones` ADD COLUMN `referencia_tipo` VARCHAR(30) DEFAULT NULL',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notificaciones' AND COLUMN_NAME = 'referencia_tipo'
);
PREPARE `paso_tipo` FROM @agregar_tipo;
EXECUTE `paso_tipo`;
DEALLOCATE PREPARE `paso_tipo`;

SET @agregar_id = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `notificaciones` ADD COLUMN `referencia_id` INT DEFAULT NULL',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notificaciones' AND COLUMN_NAME = 'referencia_id'
);
PREPARE `paso_id` FROM @agregar_id;
EXECUTE `paso_id`;
DEALLOCATE PREPARE `paso_id`;
