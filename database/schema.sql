-- Schema: Portal Web de Herramientas Empresariales — MundiTrofeos S.A.
-- Motor: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
--
-- Solo estructura (tablas, claves, índices). Sin datos — ver seed.sql.
-- Orden de importación: schema.sql -> seed.sql.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `paises` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`          VARCHAR(2)   NOT NULL UNIQUE,
  `nombre`          VARCHAR(100) NOT NULL,
  `codigo_telefono` VARCHAR(5)   DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `empresas` (
  `id`      INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`  VARCHAR(150) NOT NULL,
  `pais_id` INT NOT NULL,
  FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `roles` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`         VARCHAR(50)  NOT NULL UNIQUE,
  `descripcion`    VARCHAR(255) DEFAULT NULL,
  `activo`         TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permisos` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`      VARCHAR(100) NOT NULL UNIQUE,
  `nombre`      VARCHAR(100) NOT NULL,
  `modulo`      VARCHAR(50)  NOT NULL,
  `descripcion` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rol_permisos` (
  `rol_id`     INT NOT NULL,
  `permiso_id` INT NOT NULL,
  PRIMARY KEY (`rol_id`, `permiso_id`),
  FOREIGN KEY (`rol_id`)     REFERENCES `roles`    (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`permiso_id`) REFERENCES `permisos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`              VARCHAR(150) NOT NULL,
  `email`               VARCHAR(150) NOT NULL UNIQUE,
  `password_hash`       VARCHAR(255) NOT NULL,
  `rol_id`              INT NOT NULL,
  `activo`              TINYINT(1) NOT NULL DEFAULT 1,
  `intentos_fallidos`   INT NOT NULL DEFAULT 0,
  `bloqueado_hasta`     DATETIME DEFAULT NULL,
  `creado_en`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_usuarios_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `asesores` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL UNIQUE,
  `tienda_id`  INT DEFAULT NULL,
  `telefono`   VARCHAR(30) DEFAULT NULL,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`)  REFERENCES `tiendas`  (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supervisores` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL UNIQUE,
  `telefono`   VARCHAR(30) DEFAULT NULL,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supervisor_tiendas` (
  `usuario_id` INT NOT NULL,
  `tienda_id`  INT NOT NULL,
  PRIMARY KEY (`usuario_id`, `tienda_id`),
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`)  REFERENCES `tiendas`  (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `departamentos` (
  `id`      INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`  VARCHAR(100) NOT NULL UNIQUE,
  `pais_id` INT DEFAULT NULL,
  `activo`  TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subdivisiones` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `departamento_id` INT NOT NULL,
  `nombre`          VARCHAR(100) NOT NULL,
  `pais_id`         INT NOT NULL,
  `activo`          TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY `uq_subdivision` (`departamento_id`, `nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiendas` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`          VARCHAR(10)  NOT NULL UNIQUE,
  `empresa_id`      INT NOT NULL,
  `departamento_id` INT NOT NULL,
  `subdivision_id`  INT DEFAULT NULL,
  `activo`          TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`subdivision_id`) REFERENCES `subdivisiones` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `talleres` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`       VARCHAR(100) NOT NULL UNIQUE,
  `encargado_id` INT DEFAULT NULL,
  `tienda_id`    INT DEFAULT NULL,
  `activo`       TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`encargado_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`) REFERENCES `tiendas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `encargado_tienda` (
  `taller_id` INT NOT NULL,
  `tienda_id` INT NOT NULL,
  PRIMARY KEY (`taller_id`, `tienda_id`),
  FOREIGN KEY (`taller_id`) REFERENCES `talleres` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`) REFERENCES `tiendas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `taller_tecnicos` (
  `usuario_id` INT NOT NULL PRIMARY KEY,
  `taller_id`  INT NOT NULL,
  FOREIGN KEY (`taller_id`)  REFERENCES `talleres` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_taller_tecnicos_taller` (`taller_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vales` (
  `id`                    INT AUTO_INCREMENT PRIMARY KEY,
  `correlativo`           VARCHAR(60) NOT NULL UNIQUE,
  `asesor_id`             INT NOT NULL,
  `tienda_id`             INT NOT NULL,
  `vale_original_id`      INT DEFAULT NULL,
  `fecha_creacion`        DATE NOT NULL,
  `hora_creacion`         TIME NOT NULL,
  `fecha_entrega`         DATETIME NOT NULL,
  `fecha_evento`          DATETIME NOT NULL,
  `urgente`               TINYINT(1) NOT NULL DEFAULT 0,
  -- Información del cliente (digitada por el asesor)
  `cliente_empresa`       VARCHAR(150) DEFAULT NULL,
  `cliente_nombre`        VARCHAR(150) NOT NULL,
  `cliente_telefono`      VARCHAR(30)  NOT NULL,
  `cliente_correo`        VARCHAR(150) NOT NULL,
  -- Información de venta
  `producto`              VARCHAR(150) NOT NULL,
  `material`              VARCHAR(150) NOT NULL,
  `tecnica`               VARCHAR(150) DEFAULT NULL,
  `acabado`               VARCHAR(150) DEFAULT NULL,
  `cantidad`              INT NOT NULL,
  `cotizacion`            DECIMAL(10,2) NOT NULL,
  -- Boceto, descripción y documentos oficiales
  `descripcion`           TEXT,
  `pdf_url`               TEXT DEFAULT NULL,
  `propuesta_general_url` TEXT DEFAULT NULL,
  `fusionado_por`         INT DEFAULT NULL,
  `fusionado_en`          DATETIME DEFAULT NULL,
  -- Control de Modificaciones
  `modificado`            INT NOT NULL DEFAULT 0,
  `atraso_congelado_en`   DATETIME DEFAULT NULL,
  `atraso_notificado_en`  DATETIME DEFAULT NULL,
  `talleres_solicitados`  VARCHAR(100) DEFAULT NULL,
  `autorizado_por`        INT DEFAULT NULL,
  `autorizado_en`         DATETIME DEFAULT NULL,
  `autorizacion_tipo`     ENUM('CREACION','MODIFICACION') DEFAULT NULL,
  `confirmado_en`         DATETIME DEFAULT NULL,
  `estado` ENUM('ESPERANDO_AUTORIZACION','CREADO','APROBADO_DEPARTAMENTO','PENDIENTE_CONFIRMACION','RECIBIDO','SOLICITANDO_MODIFICACION','MODIFICADO','CONFIRMADO') NOT NULL DEFAULT 'ESPERANDO_AUTORIZACION',
  `creado_en`             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`asesor_id`)        REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`)        REFERENCES `tiendas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`vale_original_id`) REFERENCES `vales` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`autorizado_por`)   REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`fusionado_por`)    REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_vales_estado` (`estado`),
  INDEX `idx_vales_asesor` (`asesor_id`),
  INDEX `idx_vales_fecha_entrega` (`fecha_entrega`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vale_talleres` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`          INT NOT NULL,
  `taller_id`        INT NOT NULL,
  `tecnico_id`       INT DEFAULT NULL,
  `estado`           ENUM('PENDIENTE_ASIGNACION','ASIGNADO','EN_PROCESO','EN_PAUSA','EN_REVISION','APROBADO') NOT NULL DEFAULT 'PENDIENTE_ASIGNACION',
  `fecha_asignacion` DATETIME DEFAULT NULL,
  `activo`           TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`taller_id`)  REFERENCES `talleres` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_vale_talleres_vale` (`vale_id`),
  INDEX `idx_vale_talleres_tecnico` (`tecnico_id`, `activo`),
  INDEX `idx_vale_talleres_taller` (`taller_id`, `activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vale_solicitudes_modificacion` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `vale_original_id` INT NOT NULL,
  `asesor_id`        INT NOT NULL,
  `fecha_entrega`    DATETIME NOT NULL,
  `fecha_evento`     DATETIME NOT NULL,
  `urgente`          TINYINT(1) NOT NULL DEFAULT 0,
  `cliente_empresa`  VARCHAR(150) DEFAULT NULL,
  `cliente_nombre`   VARCHAR(150) NOT NULL,
  `cliente_telefono` VARCHAR(30)  NOT NULL,
  `cliente_correo`   VARCHAR(150) NOT NULL,
  `producto`         VARCHAR(150) NOT NULL,
  `material`         VARCHAR(150) NOT NULL,
  `tecnica`          VARCHAR(150) DEFAULT NULL,
  `acabado`          VARCHAR(150) DEFAULT NULL,
  `cantidad`         INT NOT NULL,
  `cotizacion`       DECIMAL(10,2) NOT NULL,
  `talleres_ids`     VARCHAR(100) NOT NULL,
  `justificacion`    TEXT NOT NULL,
  `estado`           ENUM('PENDIENTE','APROBADA','RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
  `creado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_original_id`) REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`asesor_id`)        REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_solicitudes_vale_original` (`vale_original_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vale_propuestas` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`    INT NOT NULL,
  `tecnico_id` INT NOT NULL,
  `url`        TEXT DEFAULT NULL,
  `creado_en`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_propuestas_vale` (`vale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vale_documentos` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`         INT NOT NULL,
  `nombre_original` VARCHAR(255) NOT NULL,
  `ruta`            VARCHAR(500) NOT NULL,
  `tipo`            ENUM('imagen','documento') NOT NULL,
  `mime_type`       VARCHAR(100) NOT NULL,
  `tamano`          INT NOT NULL,
  `es_modificacion` TINYINT(1) NOT NULL DEFAULT 0,
  `subido_por`      INT NOT NULL,
  `creado_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`subido_por`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_documentos_vale` (`vale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vale_historial` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`         INT NOT NULL,
  `usuario_id`      INT NOT NULL,
  `taller_id`       INT DEFAULT NULL,
  `tecnico_id`      INT DEFAULT NULL,
  `estado_anterior` VARCHAR(50) DEFAULT NULL,
  `estado_nuevo`    VARCHAR(50) NOT NULL,
  `accion`          VARCHAR(150) NOT NULL,
  `creado_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`taller_id`)  REFERENCES `talleres` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_historial_vale` (`vale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mantenimiento_config` (
  `id`           TINYINT PRIMARY KEY DEFAULT 1,
  `activo`       TINYINT(1) NOT NULL DEFAULT 0,
  `mensaje`      VARCHAR(500) DEFAULT NULL,
  `activado_por` INT DEFAULT NULL,
  `activado_en`  DATETIME DEFAULT NULL,
  FOREIGN KEY (`activado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
