-- proyectos_configurar.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué agrega: el permiso `proyectos.configurar`, que deja a los supervisores cambiar la parte OPERATIVA de la configuración de
-- Proyectos (plantillas, notificaciones, kit del nicho, campos propios y plan del año) y ver el historial. Lo delicado
-- (catálogos, parámetros, reglas y aprobaciones, alcance de usuarios) sigue siendo solo de `proyectos.administrar`.
-- Se crea SIN asignar a ningún rol: se da a los roles desde Administración → Roles (o con `scripts/proyectos/activacion.js --sql`).
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Reversa: DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id` WHERE p.`codigo` = 'proyectos.configurar';
--          DELETE FROM `permisos` WHERE `codigo` = 'proyectos.configurar';

SET NAMES utf8mb4;

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT n.`codigo`, n.`nombre`, 'proyectos', n.`descripcion`
FROM (
  SELECT 'proyectos.configurar' AS `codigo`, 'Configurar Proyectos' AS `nombre`, 'Cambiar plantillas, notificaciones, kit del nicho, campos propios y plan del año' AS `descripcion`
) n
WHERE NOT EXISTS (SELECT 1 FROM `permisos` p WHERE p.`codigo` = n.`codigo`);
