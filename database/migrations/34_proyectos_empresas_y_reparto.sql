-- proyectos_empresas_y_reparto.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué agrega (módulo «Proyectos», parte 2 de 3; requiere proyectos_catalogos_configuracion):
--   1. Base global de empresas (`proy_clientes`) y sus contactos (`proy_contactos`).
--   2. Proyecto, etapas, tiendas del alcance, participantes y participaciones (el reparto).
--   3. Dos índices únicos sobre columnas generadas VIRTUAL que respaldan en la base de datos:
--        - una tienda está en un solo proyecto activo a la vez (`tienda_abierta_id`);
--        - una empresa está en un solo proyecto activo a la vez (`cliente_abierto_id`).
--      Los NULL repetidos no chocan en un índice único, así que las filas de proyectos cerrados no estorban.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Reversa (solo si hace falta deshacerlo; borra los datos cargados):
--   DROP TABLE IF EXISTS `proy_participaciones`, `proy_participantes`, `proy_proyecto_tiendas`,
--     `proy_proyecto_etapas`, `proy_proyectos`, `proy_contactos`, `proy_clientes`;

SET NAMES utf8mb4;

-- `estado`: activa | inactiva | no_contactar. `origen`: asesor | importacion.
-- El duplicado se detecta en el servicio, por eso no hay clave única sobre el nombre.
CREATE TABLE IF NOT EXISTS `proy_clientes` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`             VARCHAR(150) NOT NULL,
  `nombre_normalizado` VARCHAR(150) NOT NULL,
  `nicho_id`           INT NOT NULL,
  `pais_id`            INT NOT NULL,
  `ciudad`             VARCHAR(100) DEFAULT NULL,
  `direccion`          VARCHAR(255) DEFAULT NULL,
  `sitio_web`          VARCHAR(255) DEFAULT NULL,
  `telefono`           VARCHAR(30)  DEFAULT NULL,
  `datos_extra`        JSON DEFAULT NULL,
  `estructura_id`      INT NOT NULL,
  `estado`             VARCHAR(20) NOT NULL DEFAULT 'activa',
  `origen`             VARCHAR(20) NOT NULL DEFAULT 'asesor',
  `tienda_origen_id`   INT DEFAULT NULL,
  `creado_por`         INT NOT NULL,
  `creado_en`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`nicho_id`)         REFERENCES `proy_nichos` (`id`),
  FOREIGN KEY (`estructura_id`)    REFERENCES `proy_estructuras` (`id`),
  FOREIGN KEY (`pais_id`)          REFERENCES `paises` (`id`),
  FOREIGN KEY (`tienda_origen_id`) REFERENCES `tiendas` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`creado_por`)       REFERENCES `usuarios` (`id`),
  INDEX `idx_proy_clientes_reparto`  (`nicho_id`, `pais_id`, `estado`),
  INDEX `idx_proy_clientes_busqueda` (`pais_id`, `nombre_normalizado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_contactos` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `cliente_id` INT NOT NULL,
  `area_id`    INT NOT NULL,
  `nombre`     VARCHAR(150) NOT NULL,
  `cargo`      VARCHAR(100) DEFAULT NULL,
  `telefono`   VARCHAR(30)  DEFAULT NULL,
  `correo`     VARCHAR(150) DEFAULT NULL,
  `principal`  TINYINT(1) NOT NULL DEFAULT 0,
  `activo`     TINYINT(1) NOT NULL DEFAULT 1,
  `creado_por` INT NOT NULL,
  `creado_en`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`cliente_id`) REFERENCES `proy_clientes` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`area_id`)    REFERENCES `proy_areas_contacto` (`id`),
  FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`),
  INDEX `idx_proy_contactos_cliente` (`cliente_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `estado`: borrador | pendiente_aprobacion | activo | cerrado | cancelado.
-- `config_snapshot` es la foto de la configuración al activar; `resumen_cierre`, la de las cifras al cerrar.
CREATE TABLE IF NOT EXISTS `proy_proyectos` (
  `id`                     INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`                 VARCHAR(60)  NOT NULL UNIQUE,
  `nombre`                 VARCHAR(150) NOT NULL,
  `nicho_id`               INT NOT NULL,
  `anio`                   SMALLINT NOT NULL,
  `mes`                    TINYINT NOT NULL,
  `articulo_id`            INT DEFAULT NULL,
  `existencia_muestras`    INT DEFAULT NULL,
  `plantilla_id`           INT DEFAULT NULL,
  `config_snapshot`        JSON DEFAULT NULL,
  `aviso_vencido_en`       DATETIME DEFAULT NULL,
  `meta_monto`             DECIMAL(12,2) DEFAULT NULL,
  `meta_moneda`            VARCHAR(3) DEFAULT NULL,
  `estado`                 VARCHAR(25) NOT NULL DEFAULT 'borrador',
  `fecha_inicio`           DATE DEFAULT NULL,
  `fecha_fin`              DATE DEFAULT NULL,
  `tope_por_asesor`        INT DEFAULT NULL,
  `aprobacion_pedida_por`  INT DEFAULT NULL,
  `aprobacion_pedida_en`   DATETIME DEFAULT NULL,
  `aprobada_por`           INT DEFAULT NULL,
  `aprobada_en`            DATETIME DEFAULT NULL,
  `aprobacion_comentario`  VARCHAR(500) DEFAULT NULL,
  `activado_por`           INT DEFAULT NULL,
  `activado_en`            DATETIME DEFAULT NULL,
  `cerrado_por`            INT DEFAULT NULL,
  `cerrado_en`             DATETIME DEFAULT NULL,
  `conclusiones`           TEXT DEFAULT NULL,
  `resumen_cierre`         JSON DEFAULT NULL,
  `visto_bueno_por`        INT DEFAULT NULL,
  `visto_bueno_en`         DATETIME DEFAULT NULL,
  `visto_bueno_comentario` VARCHAR(500) DEFAULT NULL,
  `creado_por`             INT NOT NULL,
  `creado_en`              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`nicho_id`)              REFERENCES `proy_nichos` (`id`),
  FOREIGN KEY (`articulo_id`)           REFERENCES `proy_articulos` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`plantilla_id`)          REFERENCES `proy_plantillas` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`meta_moneda`)           REFERENCES `proy_monedas` (`codigo`) ON DELETE SET NULL,
  FOREIGN KEY (`aprobacion_pedida_por`) REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`aprobada_por`)          REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`activado_por`)          REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`cerrado_por`)           REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`visto_bueno_por`)       REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`creado_por`)            REFERENCES `usuarios` (`id`),
  INDEX `idx_proy_proyectos_estado` (`estado`, `anio`, `mes`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_proyecto_etapas` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `proyecto_id`  INT NOT NULL,
  `orden`        INT NOT NULL,
  `nombre`       VARCHAR(100) NOT NULL,
  `descripcion`  VARCHAR(255) DEFAULT NULL,
  `fecha_inicio` DATE DEFAULT NULL,
  `fecha_fin`    DATE DEFAULT NULL,
  UNIQUE KEY `uq_proy_proyecto_etapa` (`proyecto_id`, `orden`),
  FOREIGN KEY (`proyecto_id`) REFERENCES `proy_proyectos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `proyecto_abierto` vale 1 solo mientras el proyecto está activo; la columna generada
-- `tienda_abierta_id` es VIRTUAL (no STORED: con claves foráneas en cascada MariaDB 11 dio el error 1901).
CREATE TABLE IF NOT EXISTS `proy_proyecto_tiendas` (
  `proyecto_id`       INT NOT NULL,
  `tienda_id`         INT NOT NULL,
  `proyecto_abierto`  TINYINT(1) NOT NULL DEFAULT 0,
  `tienda_abierta_id` INT AS (IF(`proyecto_abierto` = 1, `tienda_id`, NULL)) VIRTUAL,
  PRIMARY KEY (`proyecto_id`, `tienda_id`),
  UNIQUE KEY `uq_proy_tienda_abierta` (`tienda_abierta_id`),
  FOREIGN KEY (`proyecto_id`) REFERENCES `proy_proyectos` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`tienda_id`)   REFERENCES `tiendas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `estado`: activo | excluido.
CREATE TABLE IF NOT EXISTS `proy_participantes` (
  `proyecto_id` INT NOT NULL,
  `usuario_id`  INT NOT NULL,
  `tienda_id`   INT NOT NULL,
  `estado`      VARCHAR(10) NOT NULL DEFAULT 'activo',
  `motivo`      VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`proyecto_id`, `usuario_id`),
  FOREIGN KEY (`proyecto_id`) REFERENCES `proy_proyectos` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`usuario_id`)  REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`tienda_id`)   REFERENCES `tiendas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `estado`: pendiente | en_gestion | interesada | cotizada | vendida | perdida | descartada.
-- `asignada_por` NULL = reparto automático. `proxima_gestion_en` es la única fuente del próximo seguimiento.
-- `abierta` vale 1 mientras el proyecto está activo; `cliente_abierto_id` es VIRTUAL, como en las tiendas.
CREATE TABLE IF NOT EXISTS `proy_participaciones` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `proyecto_id`        INT NOT NULL,
  `cliente_id`         INT NOT NULL,
  `asesor_id`          INT DEFAULT NULL,
  `tienda_id`          INT DEFAULT NULL,
  `estado`             VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  `asignada_en`        DATETIME DEFAULT NULL,
  `asignada_por`       INT DEFAULT NULL,
  `ultima_gestion_en`  DATETIME DEFAULT NULL,
  `proxima_gestion_en` DATETIME DEFAULT NULL,
  `motivo_perdida_id`  INT DEFAULT NULL,
  `abierta`            TINYINT(1) NOT NULL DEFAULT 1,
  `cliente_abierto_id` INT AS (IF(`abierta` = 1, `cliente_id`, NULL)) VIRTUAL,
  UNIQUE KEY `uq_proy_participacion` (`proyecto_id`, `cliente_id`),
  UNIQUE KEY `uq_proy_cliente_abierto` (`cliente_abierto_id`),
  INDEX `idx_proy_part_asesor_estado` (`proyecto_id`, `asesor_id`, `estado`),
  INDEX `idx_proy_part_seguimiento`   (`asesor_id`, `abierta`, `proxima_gestion_en`),
  FOREIGN KEY (`proyecto_id`)       REFERENCES `proy_proyectos` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`cliente_id`)        REFERENCES `proy_clientes` (`id`),
  FOREIGN KEY (`asesor_id`)         REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`tienda_id`)         REFERENCES `tiendas` (`id`),
  FOREIGN KEY (`asignada_por`)      REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`motivo_perdida_id`) REFERENCES `proy_motivos_perdida` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
