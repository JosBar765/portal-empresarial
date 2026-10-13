-- asistentes_por_taller.sql
-- Migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué hace:
--   1. Agrega `roles.hereda_de_rol_id`: rol del encargado del que un rol de asistente hereda permisos.
--   2. Crea los roles de asistente de UV/3D, Protextil y Diseño Local (por nombre, sin ids fijos).
--   3. Enlaza cada asistente con el rol de su encargado (solo si aún no tiene padre).
--   4. A los 3 roles nuevos les copia los permisos de su rol padre. No toca los del rol 'Asistente de Diseño'.
--
-- Cómo se importa (idempotente, se puede repetir):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_asistentes_por_taller.sql
--   IMPORTAR ANTES de desplegar el código nuevo.
--
-- Reversa (solo si hace falta):
--   ALTER TABLE `roles` DROP FOREIGN KEY `fk_roles_hereda_de`, DROP COLUMN `hereda_de_rol_id`;
--   (y borrar a mano los 3 roles nuevos si no tienen usuarios)

SET NAMES utf8mb4;

-- 1. Columna + FK (solo si falta)
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `roles` ADD COLUMN `hereda_de_rol_id` INT NULL COMMENT ''Rol del encargado del que hereda permisos'', ADD CONSTRAINT `fk_roles_hereda_de` FOREIGN KEY (`hereda_de_rol_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'hereda_de_rol_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Roles nuevos (solo si no existen por nombre)
INSERT INTO `roles` (`nombre`, `descripcion`, `activo`)
SELECT v.nombre, v.descripcion, 1
FROM (
  SELECT 'Asistente de Diseño UV/3D' AS nombre, 'Asistente del Encargado del taller de Diseño UV/3D' AS descripcion
  UNION ALL SELECT 'Asistente de Protextil', 'Asistente del Encargado del taller de Protextil'
  UNION ALL SELECT 'Asistente de Diseño Local', 'Asistente del Encargado de un taller de Diseño Local'
) v
WHERE NOT EXISTS (SELECT 1 FROM `roles` r WHERE r.nombre = v.nombre);

-- 3. Padre de cada asistente (solo si está en NULL)
UPDATE `roles` a
JOIN (
  SELECT 'Asistente de Diseño' AS hijo, 'Encargado de taller de Diseño' AS padre
  UNION ALL SELECT 'Asistente de Diseño UV/3D', 'Encargado de taller de Diseño 3d'
  UNION ALL SELECT 'Asistente de Protextil', 'Encargado de taller de Protextil'
  UNION ALL SELECT 'Asistente de Diseño Local', 'Diseño Local'
) m ON m.hijo = a.nombre
JOIN `roles` p ON p.nombre = m.padre
SET a.hereda_de_rol_id = p.id
WHERE a.hereda_de_rol_id IS NULL;

-- 4. Permisos del padre para los 3 roles nuevos (los que ya tengan permisos no se duplican)
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT a.id, rp.permiso_id
FROM `roles` a
JOIN `rol_permisos` rp ON rp.rol_id = a.hereda_de_rol_id
WHERE a.nombre IN ('Asistente de Diseño UV/3D', 'Asistente de Protextil', 'Asistente de Diseño Local')
  AND NOT EXISTS (
    SELECT 1 FROM `rol_permisos` x WHERE x.rol_id = a.id AND x.permiso_id = rp.permiso_id
  );
