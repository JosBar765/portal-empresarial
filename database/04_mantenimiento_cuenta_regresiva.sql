-- mantenimiento_cuenta_regresiva.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   El Modo Mantenimiento ya no bloquea de inmediato: al activarlo empieza una cuenta regresiva
--   de 10 minutos (los usuarios siguen trabajando y ven un aviso). Al terminar, se bloquea el
--   sistema y se cierran las sesiones de todos los usuarios que no son Administrador.
--
-- Qué agrega (tabla `mantenimiento_config`, columnas nuevas y nulas):
--   1. `inicia_en`            Momento en que termina la cuenta regresiva y empieza el bloqueo.
--                             NULL = sin cuenta (si el mantenimiento ya estaba activo al importar,
--                             se trata como un bloqueo ya en curso, igual que antes).
--   2. `sesiones_cerradas_en` Marca de que ya se cerraron las sesiones de esa activación; evita
--                             cerrarlas dos veces y permite completar el cierre tras un reinicio.
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_mantenimiento_cuenta_regresiva.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   IMPORTAR ANTES de desplegar el código nuevo; después desplegar y reiniciar la aplicación.
--
-- Reversa (solo si hace falta deshacerlo):
--   ALTER TABLE `mantenimiento_config` DROP COLUMN `sesiones_cerradas_en`, DROP COLUMN `inicia_en`;

SET NAMES utf8mb4;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `mantenimiento_config` ADD COLUMN `inicia_en` DATETIME DEFAULT NULL COMMENT ''Fin de la cuenta regresiva: desde aquí el sistema bloquea a quien no es Administrador''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mantenimiento_config' AND COLUMN_NAME = 'inicia_en');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `mantenimiento_config` ADD COLUMN `sesiones_cerradas_en` DATETIME DEFAULT NULL COMMENT ''Cuándo se cerraron las sesiones de esta activación (NULL = aún no)''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mantenimiento_config' AND COLUMN_NAME = 'sesiones_cerradas_en');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
