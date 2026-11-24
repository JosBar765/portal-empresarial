-- Proyectos · fase 6a: estado del visto bueno del cierre.
-- Aditiva e idempotente. `visto_bueno_estado`: pendiente | dado | devuelto; vacío = el proyecto no pasa por visto bueno
-- (todavía no se cierra, o el administrador apagó el visto bueno al cerrar).
-- Reversión manual: ALTER TABLE `proy_proyectos` DROP COLUMN `visto_bueno_estado`;

-- ADD COLUMN IF NOT EXISTS no existe en MySQL: se consulta information_schema para que valga en ambos motores.
SET @agregar_estado = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `proy_proyectos` ADD COLUMN `visto_bueno_estado` VARCHAR(12) DEFAULT NULL',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'proy_proyectos' AND COLUMN_NAME = 'visto_bueno_estado'
);
PREPARE `paso_visto_bueno` FROM @agregar_estado;
EXECUTE `paso_visto_bueno`;
DEALLOCATE PREPARE `paso_visto_bueno`;
