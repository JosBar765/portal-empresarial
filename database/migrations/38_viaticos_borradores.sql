-- viaticos_borradores.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Habilita los borradores de solicitudes de viáticos: quien solicita guarda el formulario a medias y lo
--   termina después. Un borrador NO es una solicitud: no tiene correlativo ni pasa por validación estricta
--   hasta que se envía. No guarda fotos ni archivos.
--
-- Qué agrega:
--   1. Tabla `viaticos_borradores`: un borrador por fila, privado de su dueño (`usuario_id`); el estado del
--      formulario vive como JSON en `datos`. `vence_en` se fija al crear y no se renueva al editar.
--   2. Ajustes `borrador_vigencia_dias` (30) y `borrador_max_por_usuario` (15) en `viaticos_ajustes`
--      (no pisa un valor ya cambiado).
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--   Se aplica después de `viaticos_esquema` (el ejecutor ordena por nombre).
--
-- Cómo se revierte (solo si hiciera falta; borra los borradores guardados):
--   DELETE FROM `viaticos_ajustes` WHERE `clave` IN ('borrador_vigencia_dias', 'borrador_max_por_usuario');
--   DROP TABLE IF EXISTS `viaticos_borradores`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `viaticos_borradores` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id`     INT NOT NULL,
  `modalidad`      ENUM('hasta_un_dia','mas_de_un_dia') NOT NULL,
  `datos`          JSON NOT NULL,
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `vence_en`       DATETIME NOT NULL,
  INDEX `idx_viaticos_borradores_usuario` (`usuario_id`),
  INDEX `idx_viaticos_borradores_vence` (`vence_en`),
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `viaticos_ajustes` (`clave`, `valor`, `descripcion`)
SELECT 'borrador_vigencia_dias', '30', 'Días que vive un borrador de solicitud desde su creación' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_ajustes` WHERE `clave` = 'borrador_vigencia_dias');

INSERT INTO `viaticos_ajustes` (`clave`, `valor`, `descripcion`)
SELECT 'borrador_max_por_usuario', '15', 'Máximo de borradores de solicitud que puede tener cada usuario' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_ajustes` WHERE `clave` = 'borrador_max_por_usuario');
