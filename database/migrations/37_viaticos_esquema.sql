-- viaticos_esquema.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Crea las tablas del módulo «Calculadora de Viáticos»: catálogos administrables, licencias y vehículos,
--   solicitudes de viáticos con sus partes (tramos, hospedajes, comidas, gastos, inspección, comprobantes).
--   Solo estructura; los permisos, el rol Piloto y los datos iniciales los carga `viaticos_semilla`.
--
-- Qué agrega:
--   33 tablas con prefijo `viaticos_`, creadas en orden de dependencia. Nacen vacías: nada cambia al aplicarla.
--   Los archivos (defectos y comprobantes) guardan solo la ruta de Storage, nunca el binario.
--   Las columnas de `viaticos_tramos` que usa el CHECK (par ordenado) no llevan acciones en cascada porque MySQL
--   no permite combinarlas.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--   Se aplica antes que `viaticos_semilla` (el ejecutor las ordena por nombre).
--
-- Cómo se revierte (solo si hiciera falta; borra los datos del módulo; primero `viaticos_semilla`):
--   DROP TABLE IF EXISTS `viaticos_comprobantes`, `viaticos_defectos`, `viaticos_solicitud_kit`,
--     `viaticos_inspeccion_fluidos`, `viaticos_solicitud_salvedades`, `viaticos_solicitud_gastos`,
--     `viaticos_solicitud_comidas`, `viaticos_solicitud_hospedajes`, `viaticos_solicitud_tramos`,
--     `viaticos_historial`, `viaticos_solicitudes`, `viaticos_vehiculos`, `viaticos_usuario_paises`,
--     `viaticos_licencias`, `viaticos_reglas_licencia`, `viaticos_tipos_placa`, `viaticos_tipos_licencia`,
--     `viaticos_secuencias`, `viaticos_ajustes`, `viaticos_salvedades`, `viaticos_estados`,
--     `viaticos_combustibles`, `viaticos_kit_items`, `viaticos_niveles`, `viaticos_fluidos`,
--     `viaticos_tipos_defecto`, `viaticos_tipos_gasto`, `viaticos_motivos`, `viaticos_tramos`,
--     `viaticos_ubicaciones`, `viaticos_valores_comida`, `viaticos_tipos_comida`, `viaticos_monedas`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `viaticos_monedas` (
  `id`      INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`  VARCHAR(3)  NOT NULL,
  `nombre`  VARCHAR(50) NOT NULL,
  `simbolo` VARCHAR(5)  NOT NULL,
  `activo`  TINYINT(1)  NOT NULL DEFAULT 1,
  UNIQUE KEY `uq_viaticos_monedas_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_tipos_comida` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(50) NOT NULL,
  `orden`  INT NOT NULL,
  UNIQUE KEY `uq_viaticos_tipos_comida_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_valores_comida` (
  `moneda_id`      INT NOT NULL,
  `tipo_comida_id` INT NOT NULL,
  `valor`          DECIMAL(10,2) NOT NULL CHECK (`valor` > 0),
  PRIMARY KEY (`moneda_id`, `tipo_comida_id`),
  INDEX `idx_viaticos_valores_comida_tipo` (`tipo_comida_id`),
  FOREIGN KEY (`moneda_id`)      REFERENCES `viaticos_monedas`      (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tipo_comida_id`) REFERENCES `viaticos_tipos_comida` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_ubicaciones` (
  `id`      INT AUTO_INCREMENT PRIMARY KEY,
  `pais_id` INT NOT NULL,
  `nombre`  VARCHAR(100) NOT NULL,
  `activo`  TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY `uq_viaticos_ubicaciones_pais_nombre` (`pais_id`, `nombre`),
  FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_tramos` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `ubicacion_a_id` INT NOT NULL,
  `ubicacion_b_id` INT NOT NULL,
  `km`             DECIMAL(10,2) NOT NULL CHECK (`km` > 0),
  `horas`          DECIMAL(5,2)  NOT NULL CHECK (`horas` > 0),
  `activo`         TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY `uq_viaticos_tramos_par` (`ubicacion_a_id`, `ubicacion_b_id`),
  INDEX `idx_viaticos_tramos_ubicacion_b` (`ubicacion_b_id`),
  CHECK (`ubicacion_a_id` < `ubicacion_b_id`),
  FOREIGN KEY (`ubicacion_a_id`) REFERENCES `viaticos_ubicaciones` (`id`),
  FOREIGN KEY (`ubicacion_b_id`) REFERENCES `viaticos_ubicaciones` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_motivos` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY `uq_viaticos_motivos_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_tipos_gasto` (
  `id`                      INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`                  VARCHAR(100) NOT NULL,
  `es_otros`                TINYINT(1) NOT NULL DEFAULT 0,
  `seleccionable_en_gastos` TINYINT(1) NOT NULL DEFAULT 1,
  `activo`                  TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY `uq_viaticos_tipos_gasto_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_tipos_defecto` (
  `id`       INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`   VARCHAR(100) NOT NULL,
  `es_otros` TINYINT(1) NOT NULL DEFAULT 0,
  `activo`   TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY `uq_viaticos_tipos_defecto_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_fluidos` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`            VARCHAR(100) NOT NULL,
  `permite_no_aplica` TINYINT(1) NOT NULL DEFAULT 0,
  `orden`             INT NOT NULL,
  UNIQUE KEY `uq_viaticos_fluidos_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_niveles` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`        VARCHAR(10) NOT NULL,
  `orden`         INT NOT NULL,
  `bajo_la_mitad` TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY `uq_viaticos_niveles_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_kit_items` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `orden`  INT NOT NULL,
  UNIQUE KEY `uq_viaticos_kit_items_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_combustibles` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(50) NOT NULL,
  UNIQUE KEY `uq_viaticos_combustibles_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_estados` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(50) NOT NULL,
  UNIQUE KEY `uq_viaticos_estados_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_salvedades` (
  `id`        INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`    VARCHAR(50)  NOT NULL,
  `texto_pdf` VARCHAR(150) NOT NULL,
  UNIQUE KEY `uq_viaticos_salvedades_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_ajustes` (
  `clave`       VARCHAR(50) NOT NULL PRIMARY KEY,
  `valor`       JSON NOT NULL,
  `descripcion` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_secuencias` (
  `pais_id` INT NOT NULL PRIMARY KEY,
  `ultimo`  INT NOT NULL DEFAULT 0,
  FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_tipos_licencia` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `codigo` VARCHAR(20)  NOT NULL,
  `nombre` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY `uq_viaticos_tipos_licencia_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_tipos_placa` (
  `id`      INT AUTO_INCREMENT PRIMARY KEY,
  `pais_id` INT NOT NULL,
  `codigo`  VARCHAR(20)  NOT NULL,
  `nombre`  VARCHAR(100) NOT NULL,
  `activo`  TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY `uq_viaticos_tipos_placa_pais_codigo` (`pais_id`, `codigo`),
  FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_reglas_licencia` (
  `pais_id`          INT NOT NULL,
  `tipo_licencia_id` INT NOT NULL,
  `tipo_placa_id`    INT NOT NULL,
  `tonelaje_max`     DECIMAL(10,2) DEFAULT NULL CHECK (`tonelaje_max` IS NULL OR `tonelaje_max` > 0),
  `pasajeros_max`    INT DEFAULT NULL CHECK (`pasajeros_max` IS NULL OR `pasajeros_max` > 0),
  PRIMARY KEY (`pais_id`, `tipo_licencia_id`, `tipo_placa_id`),
  INDEX `idx_viaticos_reglas_licencia_tipo_licencia` (`tipo_licencia_id`),
  INDEX `idx_viaticos_reglas_licencia_tipo_placa` (`tipo_placa_id`),
  FOREIGN KEY (`pais_id`)          REFERENCES `paises`                  (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tipo_licencia_id`) REFERENCES `viaticos_tipos_licencia` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tipo_placa_id`)    REFERENCES `viaticos_tipos_placa`    (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_licencias` (
  `usuario_id`       INT NOT NULL PRIMARY KEY,
  `tipo_licencia_id` INT NOT NULL,
  `numero`           VARCHAR(50) NOT NULL,
  `vence_el`         DATE NOT NULL,
  `creado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_viaticos_licencias_tipo_licencia` (`tipo_licencia_id`),
  FOREIGN KEY (`usuario_id`)       REFERENCES `usuarios`                (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tipo_licencia_id`) REFERENCES `viaticos_tipos_licencia` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_usuario_paises` (
  `usuario_id` INT NOT NULL,
  `pais_id`    INT NOT NULL,
  PRIMARY KEY (`usuario_id`, `pais_id`),
  INDEX `idx_viaticos_usuario_paises_pais` (`pais_id`),
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`pais_id`)    REFERENCES `paises`   (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_vehiculos` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `pais_id`         INT NOT NULL,
  `propietario_id`  INT DEFAULT NULL COMMENT 'NULL: vehículo de la empresa',
  `marca`           VARCHAR(50) NOT NULL,
  `modelo`          VARCHAR(50) NOT NULL,
  `anio`            SMALLINT NOT NULL,
  `placa`           VARCHAR(20) NOT NULL,
  `tipo_placa_id`   INT NOT NULL,
  `combustible_id`  INT NOT NULL,
  `tonelaje`        DECIMAL(10,2) DEFAULT NULL CHECK (`tonelaje` IS NULL OR `tonelaje` > 0),
  `pasajeros`       INT DEFAULT NULL CHECK (`pasajeros` IS NULL OR `pasajeros` > 0),
  `poliza_numero`   VARCHAR(50) DEFAULT NULL,
  `poliza_vence_el` DATE DEFAULT NULL,
  `tarjeta_vence_el` DATE NOT NULL,
  `activo`          TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_viaticos_vehiculos_pais_placa` (`pais_id`, `placa`),
  INDEX `idx_viaticos_vehiculos_propietario` (`propietario_id`),
  INDEX `idx_viaticos_vehiculos_tipo_placa` (`tipo_placa_id`),
  INDEX `idx_viaticos_vehiculos_combustible` (`combustible_id`),
  FOREIGN KEY (`pais_id`)        REFERENCES `paises`                (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`propietario_id`) REFERENCES `usuarios`              (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`tipo_placa_id`)  REFERENCES `viaticos_tipos_placa`  (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`combustible_id`) REFERENCES `viaticos_combustibles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_solicitudes` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `correlativo`         VARCHAR(30) NOT NULL,
  `pais_id`             INT NOT NULL,
  `moneda_id`           INT DEFAULT NULL,
  `solicitante_id`      INT NOT NULL,
  `modalidad`           ENUM('hasta_un_dia','mas_de_un_dia') NOT NULL,
  `estado_id`           INT NOT NULL,
  `motivo_id`           INT NOT NULL,
  `vehiculo_id`         INT NOT NULL,
  `fecha_salida`        DATETIME NOT NULL,
  `fecha_regreso`       DATE DEFAULT NULL,
  `rendimiento_km_galon` DECIMAL(10,2) NOT NULL CHECK (`rendimiento_km_galon` > 0),
  `precio_galon`        DECIMAL(10,2) NOT NULL CHECK (`precio_galon` > 0),
  `depreciacion_por_km` DECIMAL(10,2) DEFAULT NULL CHECK (`depreciacion_por_km` IS NULL OR `depreciacion_por_km` > 0),
  `odometro`            DECIMAL(10,2) DEFAULT NULL CHECK (`odometro` IS NULL OR `odometro` > 0),
  `total_solicitado`    DECIMAL(10,2) NOT NULL DEFAULT 0,
  `pdf_ruta`            VARCHAR(500) DEFAULT NULL,
  `creado_en`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_viaticos_solicitudes_correlativo` (`correlativo`),
  INDEX `idx_viaticos_solicitudes_solicitante_salida` (`solicitante_id`, `fecha_salida`),
  INDEX `idx_viaticos_solicitudes_estado` (`estado_id`),
  INDEX `idx_viaticos_solicitudes_pais` (`pais_id`),
  INDEX `idx_viaticos_solicitudes_moneda` (`moneda_id`),
  INDEX `idx_viaticos_solicitudes_motivo` (`motivo_id`),
  INDEX `idx_viaticos_solicitudes_vehiculo` (`vehiculo_id`),
  FOREIGN KEY (`pais_id`)        REFERENCES `paises`             (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`moneda_id`)      REFERENCES `viaticos_monedas`   (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`solicitante_id`) REFERENCES `usuarios`           (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`estado_id`)      REFERENCES `viaticos_estados`   (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`motivo_id`)      REFERENCES `viaticos_motivos`   (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`vehiculo_id`)    REFERENCES `viaticos_vehiculos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_historial` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `solicitud_id` INT NOT NULL,
  `estado_id`    INT NOT NULL,
  `usuario_id`   INT NOT NULL,
  `motivo`       VARCHAR(500) DEFAULT NULL COMMENT 'Razón del rechazo',
  `creado_en`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_viaticos_historial_solicitud` (`solicitud_id`),
  INDEX `idx_viaticos_historial_estado` (`estado_id`),
  INDEX `idx_viaticos_historial_usuario` (`usuario_id`),
  FOREIGN KEY (`solicitud_id`) REFERENCES `viaticos_solicitudes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`estado_id`)    REFERENCES `viaticos_estados`     (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`usuario_id`)   REFERENCES `usuarios`             (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_solicitud_tramos` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `solicitud_id` INT NOT NULL,
  `orden`        INT NOT NULL,
  `tramo_id`     INT NOT NULL,
  `sentido`      ENUM('ida','vuelta') NOT NULL,
  `km`           DECIMAL(10,2) NOT NULL CHECK (`km` > 0),
  `horas`        DECIMAL(5,2)  NOT NULL CHECK (`horas` > 0),
  INDEX `idx_viaticos_solicitud_tramos_solicitud` (`solicitud_id`),
  INDEX `idx_viaticos_solicitud_tramos_tramo` (`tramo_id`),
  FOREIGN KEY (`solicitud_id`) REFERENCES `viaticos_solicitudes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tramo_id`)     REFERENCES `viaticos_tramos`      (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_solicitud_hospedajes` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `solicitud_id` INT NOT NULL,
  `hotel`        VARCHAR(50) NOT NULL,
  `lugar`        VARCHAR(50) NOT NULL,
  `noches`       INT NOT NULL CHECK (`noches` > 0),
  `valor_noche`  DECIMAL(10,2) NOT NULL CHECK (`valor_noche` > 0),
  INDEX `idx_viaticos_solicitud_hospedajes_solicitud` (`solicitud_id`),
  FOREIGN KEY (`solicitud_id`) REFERENCES `viaticos_solicitudes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_solicitud_comidas` (
  `solicitud_id`   INT NOT NULL,
  `fecha`          DATE NOT NULL,
  `tipo_comida_id` INT NOT NULL,
  `valor_unitario` DECIMAL(10,2) NOT NULL CHECK (`valor_unitario` > 0),
  PRIMARY KEY (`solicitud_id`, `fecha`, `tipo_comida_id`),
  INDEX `idx_viaticos_solicitud_comidas_tipo` (`tipo_comida_id`),
  FOREIGN KEY (`solicitud_id`)   REFERENCES `viaticos_solicitudes`  (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tipo_comida_id`) REFERENCES `viaticos_tipos_comida` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_solicitud_gastos` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `solicitud_id`  INT NOT NULL,
  `tipo_gasto_id` INT NOT NULL,
  `descripcion`   VARCHAR(100) NOT NULL,
  `monto`         DECIMAL(10,2) NOT NULL CHECK (`monto` > 0),
  INDEX `idx_viaticos_solicitud_gastos_solicitud` (`solicitud_id`),
  INDEX `idx_viaticos_solicitud_gastos_tipo` (`tipo_gasto_id`),
  FOREIGN KEY (`solicitud_id`)  REFERENCES `viaticos_solicitudes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tipo_gasto_id`) REFERENCES `viaticos_tipos_gasto` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_solicitud_salvedades` (
  `solicitud_id` INT NOT NULL,
  `salvedad_id`  INT NOT NULL,
  PRIMARY KEY (`solicitud_id`, `salvedad_id`),
  INDEX `idx_viaticos_solicitud_salvedades_salvedad` (`salvedad_id`),
  FOREIGN KEY (`solicitud_id`) REFERENCES `viaticos_solicitudes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`salvedad_id`)  REFERENCES `viaticos_salvedades`  (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_inspeccion_fluidos` (
  `solicitud_id` INT NOT NULL,
  `fluido_id`    INT NOT NULL,
  `nivel_id`     INT NOT NULL,
  PRIMARY KEY (`solicitud_id`, `fluido_id`),
  INDEX `idx_viaticos_inspeccion_fluidos_fluido` (`fluido_id`),
  INDEX `idx_viaticos_inspeccion_fluidos_nivel` (`nivel_id`),
  FOREIGN KEY (`solicitud_id`) REFERENCES `viaticos_solicitudes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`fluido_id`)    REFERENCES `viaticos_fluidos`     (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`nivel_id`)     REFERENCES `viaticos_niveles`     (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_solicitud_kit` (
  `solicitud_id` INT NOT NULL,
  `kit_item_id`  INT NOT NULL,
  `presente`     TINYINT(1) NOT NULL,
  PRIMARY KEY (`solicitud_id`, `kit_item_id`),
  INDEX `idx_viaticos_solicitud_kit_item` (`kit_item_id`),
  FOREIGN KEY (`solicitud_id`) REFERENCES `viaticos_solicitudes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`kit_item_id`)  REFERENCES `viaticos_kit_items`   (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_defectos` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `solicitud_id`    INT NOT NULL,
  `tipo_defecto_id` INT NOT NULL,
  `descripcion`     VARCHAR(100) DEFAULT NULL COMMENT 'Solo para el tipo «otros»',
  `ruta`            VARCHAR(500) NOT NULL,
  `mime_type`       VARCHAR(100) NOT NULL,
  `tamano`          INT UNSIGNED NOT NULL,
  `creado_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_viaticos_defectos_solicitud` (`solicitud_id`),
  INDEX `idx_viaticos_defectos_tipo` (`tipo_defecto_id`),
  FOREIGN KEY (`solicitud_id`)    REFERENCES `viaticos_solicitudes`    (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tipo_defecto_id`) REFERENCES `viaticos_tipos_defecto`  (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `viaticos_comprobantes` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `solicitud_id`    INT NOT NULL,
  `tipo_gasto_id`   INT NOT NULL,
  `descripcion`     VARCHAR(100) DEFAULT NULL COMMENT 'Solo para el tipo «otros»',
  `monto`           DECIMAL(10,2) NOT NULL CHECK (`monto` > 0),
  `nombre_original` VARCHAR(255) NOT NULL,
  `ruta`            VARCHAR(500) NOT NULL,
  `mime_type`       VARCHAR(100) NOT NULL,
  `tamano`          INT UNSIGNED NOT NULL,
  `subido_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_viaticos_comprobantes_solicitud` (`solicitud_id`),
  INDEX `idx_viaticos_comprobantes_tipo_gasto` (`tipo_gasto_id`),
  FOREIGN KEY (`solicitud_id`)  REFERENCES `viaticos_solicitudes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tipo_gasto_id`) REFERENCES `viaticos_tipos_gasto` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
