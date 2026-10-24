-- gerente_ver_historial.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Otorga al rol Gerente (rol_id 8) el permiso `vales.ver_historial`, para que el botón «Ver historial» le aparezca en
--   el Buzón y en «Trabajo realizado» con el historial del vale y los chats del rechazo (adjuntos y propuesta) en solo
--   lectura. Desde entonces se puede quitar o volver a poner desde «Roles y Permisos».
--
-- Qué agrega (solo datos; no cambia el esquema ni ningún otro permiso):
--   1. Una fila en `rol_permisos` (Gerente + `vales.ver_historial`), buscando el permiso por su código porque su
--      id cambia de una base a otra. Si el permiso no existe, no hace nada.
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/migrations/<correlativo>_gerente_ver_historial.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Los Gerentes con sesión abierta deben cerrar sesión e iniciar de nuevo para recibir el permiso (viaja en el token).
--
-- Cómo se revierte: quitar el permiso desde «Roles y Permisos», o
--   DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id`
--   WHERE rp.`rol_id` = 8 AND p.`codigo` = 'vales.ver_historial';

SET NAMES utf8mb4;

INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT 8, p.`id` FROM `permisos` p
WHERE p.`codigo` = 'vales.ver_historial'
  AND EXISTS (SELECT 1 FROM `roles` r WHERE r.`id` = 8)
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` rp WHERE rp.`rol_id` = 8 AND rp.`permiso_id` = p.`id`);
