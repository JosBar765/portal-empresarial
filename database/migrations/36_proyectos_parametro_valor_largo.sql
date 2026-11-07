-- proyectos_parametro_valor_largo.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué hace:
--   Amplía `parametros_sistema.valor` de 100 a 255 caracteres. Los parámetros del módulo Proyectos
--   (texto del encabezado del informe, lista de secciones) pueden pasar de 100. Es un ensanchamiento:
--   los valores existentes no cambian.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Reversa (solo si hace falta deshacerlo; recorta valores de más de 100 caracteres):
--   ALTER TABLE `parametros_sistema` MODIFY `valor` VARCHAR(100) NOT NULL;

SET NAMES utf8mb4;

ALTER TABLE `parametros_sistema` MODIFY `valor` VARCHAR(255) NOT NULL;
