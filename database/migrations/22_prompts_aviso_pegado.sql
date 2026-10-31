-- 22_prompts_aviso_pegado.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Acorta el aviso que ve el asesor en la pantalla «Prompt generado» (ajuste textos_asesor.aviso_pegado): se quita
--   la frase final «El prompt le indica que ignore cualquier propuesta anterior.», que no le aporta al asesor.
--
-- Qué cambia:
--   Solo la clave aviso_pegado de textos_asesor, y solo si conserva exactamente el texto sembrado por
--   «prompts_ajustes» (comparación binaria): una edición hecha por un administrador en ese entorno no se pisa.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Reversa: editar el aviso en Admin > Ajustes > Textos del asesor.

SET NAMES utf8mb4;

UPDATE `prompt_ajustes`
SET `valor` = JSON_SET(`valor`, '$.aviso_pegado',
  'Abre un chat nuevo en tu generador de imágenes y pega primero las imágenes, una por una y en este orden; al final pega el prompt.')
WHERE `clave` = 'textos_asesor'
  AND CONVERT(JSON_UNQUOTE(JSON_EXTRACT(`valor`, '$.aviso_pegado')) USING utf8mb4) COLLATE utf8mb4_bin =
    'Abre un chat nuevo en tu generador de imágenes y pega primero las imágenes, una por una y en este orden; al final pega el prompt. El prompt le indica que ignore cualquier propuesta anterior.';
