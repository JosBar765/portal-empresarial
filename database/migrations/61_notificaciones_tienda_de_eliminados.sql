-- notificaciones_tienda_de_eliminados.sql
-- Recupera la tienda de los avisos de vales ya eliminados.
--
-- Qué hace:
--   Los avisos guardados antes de anotar la tienda no pudieron tomarla de su vale si este ya no existe, y por eso
--   se mostraban aunque se filtrara por otra tienda. El correlativo del mensaje lleva el código de la tienda
--   (`Vale: [MOD-]PAÍS-TIENDA-…`): con él se completa `tienda_id`. Lo que no coincide se queda como está.
--
-- Cómo se aplica (idempotente: solo toca avisos sin tienda):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte:
--   No hace falta: la columna es informativa y solo se completa donde estaba vacía.

SET NAMES utf8mb4;

UPDATE `notificaciones` n
JOIN `tiendas` t ON n.`mensaje` REGEXP CONCAT('^Vale: (MOD[0-9]*-)?[A-Z]+-', t.`codigo`, '-')
SET n.`tienda_id` = t.`id`
WHERE n.`modulo` = 'vales' AND n.`tienda_id` IS NULL;
