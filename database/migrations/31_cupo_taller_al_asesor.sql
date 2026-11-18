-- cupo_taller_al_asesor.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   El cupo diario de los talleres en el calendario del Buzón pasa a depender SOLO del permiso `vales.ver_cupo`.
--   Antes el Asesor lo veía por su rol y cualquier rol con `vales.crear` y tienda en `asesores` lo veía como asesor.
--   Para que el Asesor (rol_id 2) no pierda nada, esta migración le da `vales.ver_cupo`. Los demás roles lo ven
--   únicamente si se les da desde «Roles y Permisos» (no se les da aquí). La disponibilidad de fechas dentro del
--   formulario de crear vale sigue bajo `vales.crear` y los conteos del taller y del diseñador no cambian.
--
-- Qué hace (solo datos; no cambia el esquema):
--   1. Una fila en `rol_permisos` (Asesor + `vales.ver_cupo`), si el rol y el permiso existen y aún no la tiene.
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/migrations/<correlativo>_cupo_taller_al_asesor.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Importar justo antes de desplegar el código nuevo. Los asesores deben cerrar sesión e iniciar de nuevo para que su
--   token refleje el permiso.
--
-- Cómo se revierte (solo si hiciera falta):
--   DELETE rp FROM `rol_permisos` rp
--   JOIN `permisos` p ON p.`id` = rp.`permiso_id`
--   WHERE rp.`rol_id` = 2 AND p.`codigo` = 'vales.ver_cupo';

SET NAMES utf8mb4;

INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT 2, p.`id` FROM `permisos` p
WHERE p.`codigo` = 'vales.ver_cupo'
  AND EXISTS (SELECT 1 FROM `roles` r WHERE r.`id` = 2)
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` rp WHERE rp.`rol_id` = 2 AND rp.`permiso_id` = p.`id`);
