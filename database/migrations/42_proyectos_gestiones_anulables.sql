-- Proyectos · fase 9a: una gestión equivocada se puede anular (con motivo, quién y cuándo), igual que una cotización o una venta.
-- Aditiva e idempotente: solo agrega columnas opcionales; nada se borra y lo anulado queda en el historial.
-- Reversión manual: ALTER TABLE `proy_gestiones` DROP COLUMN `anulada_en`, DROP COLUMN `anulada_por`, DROP COLUMN `anulacion_motivo`;

-- ADD COLUMN IF NOT EXISTS no existe en MySQL: se consulta information_schema para que valga en ambos motores.
SET @agregar_en = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE `proy_gestiones` ADD COLUMN `anulada_en` DATETIME DEFAULT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'proy_gestiones' AND COLUMN_NAME = 'anulada_en'
);
PREPARE `paso_anulada_en` FROM @agregar_en;
EXECUTE `paso_anulada_en`;
DEALLOCATE PREPARE `paso_anulada_en`;

SET @agregar_por = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE `proy_gestiones` ADD COLUMN `anulada_por` INT DEFAULT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'proy_gestiones' AND COLUMN_NAME = 'anulada_por'
);
PREPARE `paso_anulada_por` FROM @agregar_por;
EXECUTE `paso_anulada_por`;
DEALLOCATE PREPARE `paso_anulada_por`;

SET @agregar_motivo = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE `proy_gestiones` ADD COLUMN `anulacion_motivo` VARCHAR(255) DEFAULT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'proy_gestiones' AND COLUMN_NAME = 'anulacion_motivo'
);
PREPARE `paso_anulacion_motivo` FROM @agregar_motivo;
EXECUTE `paso_anulacion_motivo`;
DEALLOCATE PREPARE `paso_anulacion_motivo`;
