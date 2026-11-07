-- proyectos_trabajo_asesor.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué agrega (módulo «Proyectos», parte 3 de 3; requiere proyectos_empresas_y_reparto):
--   1. Trabajo del asesor, solo se agregan filas: gestiones, entregas de muestra, cotizaciones,
--      ventas y reasignaciones.
--   2. Soporte: historial del proyecto, importaciones y plan de nichos del año.
--   3. Columnas opcionales `referencia_tipo` y `referencia_id` en `notificaciones`, para avisar
--      de Proyectos sin depender de `vale_id`. No afectan lo existente.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Reversa (solo si hace falta deshacerlo; borra los datos cargados):
--   ALTER TABLE `notificaciones` DROP COLUMN `referencia_id`, DROP COLUMN `referencia_tipo`;
--   DROP TABLE IF EXISTS `proy_plan_nichos`, `proy_importaciones`, `proy_historial`, `proy_reasignaciones`,
--     `proy_ventas`, `proy_cotizaciones`, `proy_entregas_muestra`, `proy_gestiones`;

SET NAMES utf8mb4;

-- `proxima_en` es el dato histórico del registro; la fecha vigente está en `proy_participaciones`.
CREATE TABLE IF NOT EXISTS `proy_gestiones` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `participacion_id` INT NOT NULL,
  `usuario_id`       INT NOT NULL,
  `canal_id`         INT NOT NULL,
  `contacto_id`      INT DEFAULT NULL,
  `resultado_id`     INT NOT NULL,
  `nota`             VARCHAR(1000) DEFAULT NULL,
  `proxima_en`       DATETIME DEFAULT NULL,
  `creado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`participacion_id`) REFERENCES `proy_participaciones` (`id`),
  FOREIGN KEY (`usuario_id`)       REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`canal_id`)         REFERENCES `proy_canales` (`id`),
  FOREIGN KEY (`contacto_id`)      REFERENCES `proy_contactos` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`resultado_id`)     REFERENCES `proy_resultados_gestion` (`id`),
  INDEX `idx_proy_gestiones_participacion` (`participacion_id`, `creado_en`),
  INDEX `idx_proy_gestiones_usuario`       (`usuario_id`, `creado_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_entregas_muestra` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `participacion_id` INT NOT NULL,
  `area_id`          INT DEFAULT NULL,
  `cantidad`         INT NOT NULL DEFAULT 1,
  `entregada_por`    INT NOT NULL,
  `creado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`participacion_id`) REFERENCES `proy_participaciones` (`id`),
  FOREIGN KEY (`area_id`)          REFERENCES `proy_areas_contacto` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`entregada_por`)    REFERENCES `usuarios` (`id`),
  INDEX `idx_proy_entregas_participacion` (`participacion_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `referencia` es el número del sistema contable; si es obligatoria lo decide el servicio con la configuración del país.
-- Anular llena `anulada_*` (nunca se borra) y el estado de la participación se recalcula ignorando lo anulado.
CREATE TABLE IF NOT EXISTS `proy_cotizaciones` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `participacion_id` INT NOT NULL,
  `monto`            DECIMAL(12,2) NOT NULL,
  `moneda`           VARCHAR(3) NOT NULL,
  `referencia`       VARCHAR(60) DEFAULT NULL,
  `nota`             VARCHAR(500) DEFAULT NULL,
  `vale_id`          INT DEFAULT NULL,
  `creado_por`       INT NOT NULL,
  `creado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `anulada_en`       DATETIME DEFAULT NULL,
  `anulada_por`      INT DEFAULT NULL,
  `anulacion_motivo` VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY (`participacion_id`) REFERENCES `proy_participaciones` (`id`),
  FOREIGN KEY (`moneda`)           REFERENCES `proy_monedas` (`codigo`),
  FOREIGN KEY (`vale_id`)          REFERENCES `vales` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`creado_por`)       REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`anulada_por`)      REFERENCES `usuarios` (`id`),
  INDEX `idx_proy_cotizaciones_participacion` (`participacion_id`),
  INDEX `idx_proy_cotizaciones_referencia`    (`referencia`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `estado`: confirmada | por_confirmar | rechazada. Solo las confirmadas cuentan en los informes.
CREATE TABLE IF NOT EXISTS `proy_ventas` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `participacion_id` INT NOT NULL,
  `monto`            DECIMAL(12,2) NOT NULL,
  `moneda`           VARCHAR(3) NOT NULL,
  `referencia`       VARCHAR(60) DEFAULT NULL,
  `vale_id`          INT DEFAULT NULL,
  `estado`           VARCHAR(20) NOT NULL DEFAULT 'confirmada',
  `revisada_por`     INT DEFAULT NULL,
  `revisada_en`      DATETIME DEFAULT NULL,
  `revision_motivo`  VARCHAR(255) DEFAULT NULL,
  `creado_por`       INT NOT NULL,
  `creado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `anulada_en`       DATETIME DEFAULT NULL,
  `anulada_por`      INT DEFAULT NULL,
  `anulacion_motivo` VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY (`participacion_id`) REFERENCES `proy_participaciones` (`id`),
  FOREIGN KEY (`moneda`)           REFERENCES `proy_monedas` (`codigo`),
  FOREIGN KEY (`vale_id`)          REFERENCES `vales` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`revisada_por`)     REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`creado_por`)       REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`anulada_por`)      REFERENCES `usuarios` (`id`),
  INDEX `idx_proy_ventas_participacion` (`participacion_id`),
  INDEX `idx_proy_ventas_referencia`    (`referencia`),
  INDEX `idx_proy_ventas_estado`        (`estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_reasignaciones` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `participacion_id` INT NOT NULL,
  `de_usuario_id`    INT DEFAULT NULL,
  `a_usuario_id`     INT NOT NULL,
  `motivo`           VARCHAR(255) DEFAULT NULL,
  `por_usuario_id`   INT NOT NULL,
  `creado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`participacion_id`) REFERENCES `proy_participaciones` (`id`),
  FOREIGN KEY (`de_usuario_id`)    REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`a_usuario_id`)     REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`por_usuario_id`)   REFERENCES `usuarios` (`id`),
  INDEX `idx_proy_reasignaciones_participacion` (`participacion_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `accion`: activar, cerrar, cancelar, visto bueno, etc.
CREATE TABLE IF NOT EXISTS `proy_historial` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `proyecto_id` INT NOT NULL,
  `usuario_id`  INT NOT NULL,
  `accion`      VARCHAR(40) NOT NULL,
  `detalle`     JSON DEFAULT NULL,
  `creado_en`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`proyecto_id`) REFERENCES `proy_proyectos` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`usuario_id`)  REFERENCES `usuarios` (`id`),
  INDEX `idx_proy_historial_proyecto` (`proyecto_id`, `creado_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_importaciones` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `archivo`    VARCHAR(255) NOT NULL,
  `filas`      INT NOT NULL DEFAULT 0,
  `creadas`    INT NOT NULL DEFAULT 0,
  `duplicadas` INT NOT NULL DEFAULT 0,
  `con_error`  INT NOT NULL DEFAULT 0,
  `creado_en`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  INDEX `idx_proy_importaciones_usuario` (`usuario_id`, `creado_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `pais_id` NULL = el plan vale para todos los países.
CREATE TABLE IF NOT EXISTS `proy_plan_nichos` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `anio`         SMALLINT NOT NULL,
  `mes`          TINYINT NOT NULL,
  `pais_id`      INT DEFAULT NULL,
  `nicho_id`     INT NOT NULL,
  `articulo_id`  INT DEFAULT NULL,
  `plantilla_id` INT DEFAULT NULL,
  UNIQUE KEY `uq_proy_plan_nicho` (`anio`, `mes`, `pais_id`),
  FOREIGN KEY (`pais_id`)      REFERENCES `paises` (`id`),
  FOREIGN KEY (`nicho_id`)     REFERENCES `proy_nichos` (`id`),
  FOREIGN KEY (`articulo_id`)  REFERENCES `proy_articulos` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`plantilla_id`) REFERENCES `proy_plantillas` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ADD COLUMN IF NOT EXISTS no existe en MySQL: se consulta information_schema para que valga en ambos motores.
SET @agregar_tipo = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `notificaciones` ADD COLUMN `referencia_tipo` VARCHAR(30) DEFAULT NULL',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notificaciones' AND COLUMN_NAME = 'referencia_tipo'
);
PREPARE `paso_tipo` FROM @agregar_tipo;
EXECUTE `paso_tipo`;
DEALLOCATE PREPARE `paso_tipo`;

SET @agregar_id = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `notificaciones` ADD COLUMN `referencia_id` INT DEFAULT NULL',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notificaciones' AND COLUMN_NAME = 'referencia_id'
);
PREPARE `paso_id` FROM @agregar_id;
EXECUTE `paso_id`;
DEALLOCATE PREPARE `paso_id`;
