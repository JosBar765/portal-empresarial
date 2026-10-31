-- 24_prompts_quitar_recursos_min.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Publicar un producto ya no exige recursos activos: hay productos que no usan recursos fijos. Se retira del
--   ajuste «limites» la clave recursos_min_publicar, que el validador de ajustes ya no reconoce.
--
-- Qué cambia:
--   Solo la clave recursos_min_publicar del ajuste limites.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Reversa: no aplica; si se quisiera de nuevo la exigencia, habría que reintroducirla en el código.

SET NAMES utf8mb4;

UPDATE `prompt_ajustes`
SET `valor` = JSON_REMOVE(`valor`, '$.recursos_min_publicar')
WHERE `clave` = 'limites'
  AND JSON_CONTAINS_PATH(`valor`, 'one', '$.recursos_min_publicar');
