-- notificaciones_por_tienda.sql
-- Los avisos siguen las tiendas que el supervisor tiene marcadas.
--
-- Qué hace:
--   1. Agrega a `notificaciones` las columnas opcionales `tienda_id` y `asesor_id`, y las rellena desde el vale.
--   2. Crea `notificacion_filtros`: qué tiendas (y asesores) quiere ver cada usuario, por módulo. Sin filas = todo.
--      La fila `guardado` solo recuerda que la persona ya eligió (aunque haya elegido «todas»).
--
-- Cómo se aplica (idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (el código nuevo dejaría de funcionar):
--   DROP TABLE `notificacion_filtros`; ALTER TABLE `notificaciones` DROP COLUMN `tienda_id`, DROP COLUMN `asesor_id`;

SET NAMES utf8mb4;

SET @agregar_tienda = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE `notificaciones` ADD COLUMN `tienda_id` INT DEFAULT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notificaciones' AND COLUMN_NAME = 'tienda_id'
);
PREPARE `paso_tienda` FROM @agregar_tienda;
EXECUTE `paso_tienda`;
DEALLOCATE PREPARE `paso_tienda`;

SET @agregar_asesor = (
  SELECT IF(COUNT(*) = 0, 'ALTER TABLE `notificaciones` ADD COLUMN `asesor_id` INT DEFAULT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notificaciones' AND COLUMN_NAME = 'asesor_id'
);
PREPARE `paso_asesor` FROM @agregar_asesor;
EXECUTE `paso_asesor`;
DEALLOCATE PREPARE `paso_asesor`;

-- Los avisos de vales ya guardados toman la tienda y el asesor de su vale (los de vales eliminados quedan sin dato y se muestran siempre).
UPDATE `notificaciones` n JOIN `vales` v ON v.`id` = n.`vale_id`
SET n.`tienda_id` = v.`tienda_id`, n.`asesor_id` = v.`asesor_id`
WHERE n.`modulo` = 'vales' AND n.`tienda_id` IS NULL;

CREATE TABLE IF NOT EXISTS `notificacion_filtros` (
  `usuario_id` INT NOT NULL,
  `modulo`     VARCHAR(30) NOT NULL,
  -- 'tienda', 'asesor' o 'guardado'.
  `clase`      VARCHAR(10) NOT NULL,
  `ref_id`     INT NOT NULL,
  PRIMARY KEY (`usuario_id`, `modulo`, `clase`, `ref_id`),
  CONSTRAINT `fk_notificacion_filtros_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
