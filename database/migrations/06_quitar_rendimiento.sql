-- quitar_rendimiento.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   La pestaña «Rendimiento» de Vales de Arte (y «Encontrar vale» del Gerente) se eliminó del sistema. Su permiso
--   `vales.ver_gerencia` («Ver Panel de Gerencia») ya no habilita nada, así que se quita para que no aparezca en
--   «Roles y Permisos».
--
-- Qué hace (solo datos; no cambia el esquema):
--   1. Borra el permiso `vales.ver_gerencia` de la tabla `permisos`, buscándolo por su código porque su id cambia de
--      una base a otra. Las filas de `rol_permisos` que lo tenían se borran solas (ON DELETE CASCADE).
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_quitar_rendimiento.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Los usuarios con sesión abierta deben cerrar sesión e iniciar de nuevo.
--
-- Cómo se revierte: volver a crear el permiso con
--   INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
--   VALUES ('vales.ver_gerencia', 'Ver Panel de Gerencia', 'vales', 'Acceso de solo lectura a la vista de Rendimiento');
--   (la vista ya no existe, así que no tendría efecto alguno).

SET NAMES utf8mb4;

DELETE FROM `permisos` WHERE `codigo` = 'vales.ver_gerencia';
