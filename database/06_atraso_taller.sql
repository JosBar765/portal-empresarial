-- atraso_taller.sql
-- Migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué hace:
--   1. Agrega `vale_talleres.atraso_congelado_en`: momento en que el Encargado del taller APRUEBA la propuesta. El atraso que ven
--      el Encargado del taller y el Diseñador (Buzón y Reportes) se mide hasta ese momento; mientras la propuesta está en revisión
--      sigue corriendo. El del Asesor, Supervisor, Gerente y Administrador no cambia. Si la propuesta se desaprueba y el vale
--      vuelve a ASIGNADO, el valor se borra y el atraso se reanuda.
--   2. Rellena el valor de las filas ya APROBADAS con la fecha de su última aprobación registrada en `vale_historial`.
--
-- Cómo se importa (idempotente, se puede repetir):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_atraso_taller.sql
--   IMPORTAR ANTES de desplegar el código nuevo.
--
-- Reversa (solo si hace falta):
--   ALTER TABLE `vale_talleres` DROP COLUMN `atraso_congelado_en`;

SET NAMES utf8mb4;
-- La app guarda las horas en Guatemala (UTC-6); el relleno de abajo copia una hora del historial, así que se hace en esa zona.
SET time_zone = '-06:00';

-- 1. Columna (solo si falta)
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE `vale_talleres` ADD COLUMN `atraso_congelado_en` DATETIME NULL COMMENT ''Momento en que el Encargado aprobó la propuesta del taller: fin de su atraso'' AFTER `adjuntos_respondido_en`',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vale_talleres' AND COLUMN_NAME = 'atraso_congelado_en');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Relleno de las filas ya aprobadas que aún no tienen valor
UPDATE `vale_talleres` vt
JOIN `estados_taller` et ON et.id = vt.estado_id AND et.nombre = 'APROBADO'
JOIN (
  SELECT vale_id, taller_id, MAX(creado_en) AS aprobado_en
  FROM `vale_historial`
  WHERE estado_anterior = 'EN_REVISION' AND estado_nuevo = 'APROBADO'
  GROUP BY vale_id, taller_id
) h ON h.vale_id = vt.vale_id AND h.taller_id = vt.taller_id
SET vt.atraso_congelado_en = h.aprobado_en
WHERE vt.atraso_congelado_en IS NULL;
