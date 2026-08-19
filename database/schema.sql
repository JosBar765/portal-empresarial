-- =========================================================================
-- Schema: Portal Web de Herramientas Empresariales — MundiTrofeos S.A.
-- Motor: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------------------
-- 1. Catálogo de Países
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `paises` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`          VARCHAR(2)   NOT NULL UNIQUE COMMENT 'Código ISO (GT, SV, HN, NI, CR, BZ)',
  `nombre`          VARCHAR(100) NOT NULL,
  `codigo_telefono` VARCHAR(5)  DEFAULT NULL,
  `moneda_codigo`   VARCHAR(3)  DEFAULT NULL,
  `moneda_simbolo`  VARCHAR(5)  DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 2. Roles
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`         VARCHAR(50)  NOT NULL UNIQUE,
  `descripcion`    VARCHAR(255) DEFAULT NULL,
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 3. Permisos (Control de acceso a nivel de módulos y acciones)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `permisos` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`      VARCHAR(100) NOT NULL UNIQUE COMMENT 'Ej: vales.ver, eventos.ver',
  `nombre`      VARCHAR(100) NOT NULL,
  `modulo`      VARCHAR(50)  NOT NULL COMMENT 'Asociado al módulo (vales, prompts, eventos, etc.)',
  `descripcion` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 4. Pivot Rol ↔ Permiso
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `rol_permisos` (
  `rol_id`     INT NOT NULL,
  `permiso_id` INT NOT NULL,
  PRIMARY KEY (`rol_id`, `permiso_id`),
  FOREIGN KEY (`rol_id`)     REFERENCES `roles`    (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`permiso_id`) REFERENCES `permisos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 5. Usuarios
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`            VARCHAR(150) NOT NULL,
  `email`             VARCHAR(150) NOT NULL UNIQUE,
  `telefono`          VARCHAR(30)  DEFAULT NULL,
  `password_hash`     VARCHAR(255) NOT NULL,
  `rol_id`            INT NOT NULL,
  `localidad_id`      INT          DEFAULT NULL COMMENT 'Localidad base del usuario (usada para el correlativo de vales)',
  `encargado_id`      INT          DEFAULT NULL COMMENT 'Auto-referencia: encargado/supervisor al mando de este usuario (ej. técnico -> encargado)',
  `activo`            TINYINT(1)   NOT NULL DEFAULT 1,
  `intentos_fallidos` INT          NOT NULL DEFAULT 0,
  `bloqueado_hasta`   DATETIME     DEFAULT NULL,
  `creado_en`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`encargado_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_usuarios_email` (`email`),
  INDEX `idx_usuarios_encargado` (`encargado_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 6. Pivot Usuario ↔ País (Filtro geográfico de operación)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuario_paises` (
  `usuario_id` INT NOT NULL,
  `pais_id`    INT NOT NULL,
  PRIMARY KEY (`usuario_id`, `pais_id`),
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`pais_id`)    REFERENCES `paises`   (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 7. Datos de Semilla (Seeds iniciales)
-- -------------------------------------------------------------------------

-- Países
INSERT INTO `paises` (`codigo`, `nombre`, `codigo_telefono`, `moneda_codigo`, `moneda_simbolo`) VALUES
('GT', 'Guatemala', '+502', 'GTQ', 'Q'),
('SV', 'El Salvador', '+503', 'USD', '$'),
('HN', 'Honduras', '+504', 'HNL', 'L'),
('NI', 'Nicaragua', '+505', 'NIO', 'C$'),
('CR', 'Costa Rica', '+506', 'CRC', '₡'),
('BZ', 'Belice', '+501', 'BZD', 'BZ$');

-- Roles
INSERT INTO `roles` (`id`, `nombre`, `descripcion`) VALUES
(1, 'Administrador', 'Acceso total a todos los módulos y configuraciones del portal'),
(2, 'Diseñador', 'Acceso a vales de arte y generador de prompts'),
(3, 'Asesor de Ventas', 'Crea vales de arte, confirma o cancela ventas y solicita modificaciones'),
(4, 'Supervisor de Ventas', 'Supervisa el flujo de vales de arte y autoriza modificaciones'),
(5, 'Encargado de Diseño', 'Asigna vales de arte a técnicos y revisa sus propuestas'),
(6, 'Encargado de Diseño UV/3D', 'Asigna vales de arte a técnicos UV/3D y revisa sus propuestas'),
(7, 'Técnico de Diseño', 'Ejecuta los vales de arte que le asigna su encargado');

-- Permisos (basado en los módulos descritos en arquitectura_reglas.md)
INSERT INTO `permisos` (`id`, `codigo`, `nombre`, `modulo`, `descripcion`) VALUES
-- Vales
(1, 'vales.ver', 'Ver Vales de Arte', 'vales', 'Permite visualizar la lista/buzón de vales de arte'),
(2, 'vales.crear', 'Crear Vales de Arte', 'vales', 'Permite ingresar nuevos vales de arte'),
(3, 'vales.editar', 'Editar Vales de Arte', 'vales', 'Permite modificar el contenido de un vale de arte (formulario de modificación)'),
(9, 'vales.asignar', 'Asignar Vales de Arte', 'vales', 'Permite asignar/reasignar un vale de arte a un técnico'),
(10, 'vales.revisar', 'Revisar Propuestas', 'vales', 'Permite aprobar o desaprobar la propuesta de un técnico'),
(11, 'vales.trabajar', 'Trabajar Vales de Arte', 'vales', 'Permite a un técnico comenzar, entregar o cancelar un vale asignado'),
(12, 'vales.confirmar', 'Confirmar o Cancelar Venta', 'vales', 'Permite al asesor confirmar la venta o cancelar un vale de arte'),
(13, 'vales.solicitar_modificacion', 'Solicitar Modificación', 'vales', 'Permite al asesor solicitar la modificación de un vale de arte'),
(14, 'vales.aprobar_modificacion', 'Aprobar Modificación', 'vales', 'Permite al supervisor autorizar una modificación solicitada'),
(15, 'vales.supervisar', 'Supervisar Vales de Arte', 'vales', 'Acceso de solo lectura al panel de supervisión de vales de arte'),
-- Prompts
(4, 'prompts.ver', 'Ver Generador de Prompts', 'prompts', 'Permite acceder al generador de prompts'),
(5, 'prompts.crear', 'Crear Prompts', 'prompts', 'Permite crear nuevos prompts para IA'),
-- Eventos
(6, 'eventos.ver', 'Ver Eventos', 'eventos', 'Permite ver y listar los eventos de carreras'),
(7, 'eventos.crear', 'Crear Eventos', 'eventos', 'Permite registrar nuevos eventos de carreras'),
-- Administración
(8, 'admin.ver', 'Ver Panel de Administración', 'admin', 'Permite acceder al módulo de administración central');

-- Asignación de Permisos a Roles (rol_permisos)
-- Administrador: todos
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10), (1, 11), (1, 12), (1, 13), (1, 14), (1, 15),
-- Diseñador (legacy, no ligado al flujo de actores de vales): Vales (ver, editar) + Prompts (ver, crear)
(2, 1), (2, 3), (2, 4), (2, 5),
-- Asesor de Ventas: Vales (ver, crear, editar en modificación, confirmar, solicitar modificación) + Eventos (ver, crear)
(3, 1), (3, 2), (3, 3), (3, 12), (3, 13), (3, 6), (3, 7),
-- Supervisor de Ventas: Vales (ver, supervisar, aprobar modificación)
(4, 1), (4, 15), (4, 14),
-- Encargado de Diseño: Vales (ver, asignar, revisar)
(5, 1), (5, 9), (5, 10),
-- Encargado de Diseño UV/3D: Vales (ver, asignar, revisar)
(6, 1), (6, 9), (6, 10),
-- Técnico de Diseño: Vales (ver, trabajar)
(7, 1), (7, 11);

-- Usuarios (contraseñas hasheadas con bcrypt, 10 rondas)
-- admin@munditrofeos.com          -> admin123
-- diseno@munditrofeos.com         -> diseno123
-- ventas@munditrofeos.com         -> ventas123
-- supervisor@munditrofeos.com     -> supervisor123
-- encargado.diseno@munditrofeos.com -> disenoenc123
-- encargado.uv3d@munditrofeos.com   -> uv3denc123
-- tecnico.a@munditrofeos.com / tecnico.b@munditrofeos.com / tecnico.c@munditrofeos.com -> tecnico123

INSERT INTO `usuarios` (`id`, `nombre`, `email`, `telefono`, `password_hash`, `rol_id`, `localidad_id`, `encargado_id`) VALUES
(1, 'Administrador General', 'admin@munditrofeos.com', '+502 5555-0001', '$2a$10$0.B9xk21MYppfOd4XbtP3u5mJ6NzlaA6eqlu65Fy5G7xb2VnN2Lwu', 1, 1, NULL),
(2, 'Diseñador Creativo', 'diseno@munditrofeos.com', '+502 5555-0002', '$2a$10$SXZEYhhebLnagsNMyFiqFOIn3m4Uwwf45PKHBvEIooMvzfqLXBpaC', 2, 1, NULL),
(3, 'Asesor Comercial', 'ventas@munditrofeos.com', '+502 5555-0003', '$2a$10$KrYwD5jW2ApvSCzeE8r75O4OJViry2yLLHnujyPX4ZGw58IJpSnmW', 3, 1, NULL),
(4, 'Supervisor de Ventas', 'supervisor@munditrofeos.com', '+502 5555-0004', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 4, 1, NULL),
(5, 'Encargado de Diseño', 'encargado.diseno@munditrofeos.com', '+502 5555-0005', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 5, 1, NULL),
(6, 'Encargado de Diseño UV/3D', 'encargado.uv3d@munditrofeos.com', '+502 5555-0006', '$2a$10$DEPhj4Vnp.cgA6u3w3Leg.FVQ9O3JgKDXizOYCXEbGFlSgEBcb6F6', 6, 1, NULL),
(7, 'Técnico Diseño A', 'tecnico.a@munditrofeos.com', '+502 5555-0007', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 1, 5),
(8, 'Técnico Diseño B', 'tecnico.b@munditrofeos.com', '+502 5555-0008', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 1, 5),
(9, 'Técnico UV/3D C', 'tecnico.c@munditrofeos.com', '+502 5555-0009', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 1, 6);

-- Asignación de países a usuarios
INSERT INTO `usuario_paises` (`usuario_id`, `pais_id`) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), -- Admin opera en todos
(2, 1), -- Diseñador opera en GT
(3, 1), (3, 2), -- Ventas opera en GT y SV
(4, 1), (5, 1), (6, 1), (7, 1), (8, 1), (9, 1);

-- -------------------------------------------------------------------------
-- 8. Módulo Vales de Arte
-- -------------------------------------------------------------------------

-- Localidades (tiendas/sucursales) usadas para el correlativo de vales
CREATE TABLE IF NOT EXISTS `localidades` (
  `id`      INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`  VARCHAR(10)  NOT NULL UNIQUE COMMENT 'Ej: GUA',
  `nombre`  VARCHAR(100) NOT NULL,
  `pais_id` INT DEFAULT NULL,
  `activo`  TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catálogos del formulario de vale de arte (combobox)
CREATE TABLE IF NOT EXISTS `vale_productos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo` VARCHAR(20) NOT NULL UNIQUE,
  `nombre` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vale_materiales` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vale_tecnicas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vale_acabados` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Límite diario de vales por asesor
CREATE TABLE IF NOT EXISTS `asesor_limites` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `asesor_id`       INT NOT NULL,
  `limite_diario`   INT NOT NULL DEFAULT 6,
  `activo`          TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`asesor_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Enum de estados del flujo de vale de arte
-- CREADO, ASIGNADO, EN_PROCESO, EN_REVISION, APROBADO, CONFIRMACION_MODIFICACION, MODIFICADO, VENDIDO, CANCELADO
CREATE TABLE IF NOT EXISTS `vales` (
  `id`                          INT AUTO_INCREMENT PRIMARY KEY,
  `correlativo`                 VARCHAR(60) NOT NULL UNIQUE COMMENT 'Estructura: [MOD-]LOCALIDAD-ASESOR-0001',
  `asesor_id`                   INT NOT NULL,
  `localidad_id`                INT NOT NULL,
  `fecha_creacion`               DATE NOT NULL,
  `hora_creacion`                TIME NOT NULL,
  `fecha_entrega`                DATETIME NOT NULL,
  `fecha_evento`                 DATETIME NOT NULL,
  `urgente`                      TINYINT(1) NOT NULL DEFAULT 0,
  -- Información del cliente (digitada por el asesor)
  `cliente_empresa`              VARCHAR(150) DEFAULT NULL,
  `cliente_nombre`               VARCHAR(150) NOT NULL,
  `cliente_telefono`             VARCHAR(30)  NOT NULL,
  `cliente_correo`               VARCHAR(150) NOT NULL,
  -- Información de venta
  `producto_id`                  INT DEFAULT NULL,
  `material_id`                  INT DEFAULT NULL,
  `tecnica_id`                   INT DEFAULT NULL,
  `acabado_id`                   INT DEFAULT NULL,
  `cantidad`                     INT NOT NULL COMMENT 'Debe ser > 1',
  `cotizacion`                   DECIMAL(10,2) NOT NULL,
  -- Boceto y descripción
  `descripcion`                  TEXT,
  `descripcion_original`         TEXT DEFAULT NULL COMMENT 'Snapshot de la descripción previa a la única modificación permitida',
  `pdf_url`                      TEXT DEFAULT NULL COMMENT 'URL del PDF generado, nunca se guarda el binario en BD',
  -- Control de Modificaciones
  `modificado`                   INT NOT NULL DEFAULT 0 COMMENT 'Máx 1 permitida',
  `justificacion_modificacion`   TEXT DEFAULT NULL,
  `estado` ENUM('CREADO','ASIGNADO','EN_PROCESO','EN_REVISION','APROBADO','CONFIRMACION_MODIFICACION','MODIFICADO','VENDIDO','CANCELADO') NOT NULL DEFAULT 'CREADO',
  `creado_en`                    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`asesor_id`)    REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`localidad_id`) REFERENCES `localidades` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`producto_id`)  REFERENCES `vale_productos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`material_id`)  REFERENCES `vale_materiales` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`tecnica_id`)   REFERENCES `vale_tecnicas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`acabado_id`)   REFERENCES `vale_acabados` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_vales_estado` (`estado`),
  INDEX `idx_vales_asesor` (`asesor_id`),
  INDEX `idx_vales_fecha_entrega` (`fecha_entrega`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Asignaciones de un vale de arte a un técnico bajo el mando de un encargado
CREATE TABLE IF NOT EXISTS `vale_asignaciones` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`           INT NOT NULL,
  `tecnico_id`        INT NOT NULL,
  `encargado_id`      INT NOT NULL,
  `fecha_asignacion`  DATETIME NOT NULL,
  `activo`            TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Determina la asignación vigente para la carga de trabajo',
  `creado_en`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)      REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tecnico_id`)   REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`encargado_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_asignaciones_vale` (`vale_id`),
  INDEX `idx_asignaciones_tecnico` (`tecnico_id`, `activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Propuestas entregadas por un técnico para revisión del encargado
CREATE TABLE IF NOT EXISTS `vale_propuestas` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`        INT NOT NULL,
  `tecnico_id`     INT NOT NULL,
  `url`            TEXT DEFAULT NULL COMMENT 'URL del documento de propuesta; NULL si fue una cancelación en blanco',
  `es_cancelacion` TINYINT(1) NOT NULL DEFAULT 0,
  `fecha_subida`   DATETIME NOT NULL,
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_propuestas_vale` (`vale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Metadatos de archivos adjuntos (imágenes y documentos); el binario nunca se guarda en BD
CREATE TABLE IF NOT EXISTS `vale_documentos` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`          INT NOT NULL,
  `nombre_original`  VARCHAR(255) NOT NULL,
  `ruta`             VARCHAR(500) NOT NULL,
  `tipo`             ENUM('imagen','documento') NOT NULL,
  `mime_type`        VARCHAR(100) NOT NULL,
  `tamano`           INT NOT NULL COMMENT 'Tamaño en bytes',
  `es_modificacion`  TINYINT(1) NOT NULL DEFAULT 0,
  `subido_por`       INT NOT NULL,
  `creado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`subido_por`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_documentos_vale` (`vale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historial/trazabilidad de cada cambio de estado de un vale
CREATE TABLE IF NOT EXISTS `vale_historial` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`         INT NOT NULL,
  `usuario_id`      INT NOT NULL,
  `estado_anterior` VARCHAR(50) DEFAULT NULL,
  `estado_nuevo`    VARCHAR(50) NOT NULL,
  `accion`          VARCHAR(150) NOT NULL,
  `creado_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_historial_vale` (`vale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 9. Semillas del Módulo Vales de Arte
-- -------------------------------------------------------------------------

INSERT INTO `localidades` (`id`, `codigo`, `nombre`, `pais_id`) VALUES
(1, 'GUA', 'Guatemala', 1),
(2, 'SAN', 'San Salvador', 2),
(3, 'TEG', 'Tegucigalpa', 3);

INSERT INTO `vale_productos` (`id`, `codigo`, `nombre`) VALUES
(1, 'PRD-TROF', 'Trofeo'),
(2, 'PRD-MED', 'Medalla'),
(3, 'PRD-PLA', 'Placa'),
(4, 'PRD-BAN', 'Banner');

INSERT INTO `vale_materiales` (`id`, `nombre`) VALUES
(1, 'Acrílico'), (2, 'Metal'), (3, 'Madera'), (4, 'Cristal');

INSERT INTO `vale_tecnicas` (`id`, `nombre`) VALUES
(1, 'Grabado Láser'), (2, 'Sublimación'), (3, 'Impresión UV'), (4, 'Vinil de Corte');

INSERT INTO `vale_acabados` (`id`, `nombre`) VALUES
(1, 'Brillante'), (2, 'Mate'), (3, 'Satinado');

INSERT INTO `asesor_limites` (`asesor_id`, `limite_diario`) VALUES
(3, 6);

-- Vales de demostración cubriendo el flujo completo (usados solo si se corre este schema contra MySQL real)
INSERT INTO `vales` (`id`, `correlativo`, `asesor_id`, `localidad_id`, `fecha_creacion`, `hora_creacion`, `fecha_entrega`, `fecha_evento`, `urgente`, `cliente_empresa`, `cliente_nombre`, `cliente_telefono`, `cliente_correo`, `producto_id`, `material_id`, `tecnica_id`, `acabado_id`, `cantidad`, `cotizacion`, `descripcion`, `estado`) VALUES
(1, 'GUA-3-0001', 3, 1, '2026-08-19', '08:30:00', '2026-08-22 17:00:00', '2026-08-25 09:00:00', 0, 'Corporación Deportiva S.A.', 'Juan Pérez', '+502 5555-1111', 'juan.perez@corpdeportiva.com', 1, 2, 1, 1, 50, 1500.00, 'Trofeos para premiación anual de ventas.', 'CREADO'),
(2, 'GUA-3-0002', 3, 1, '2026-08-18', '09:15:00', '2026-08-20 17:00:00', '2026-08-23 09:00:00', 0, 'Liga Guatemalteca', 'María López', '+502 5555-2222', 'maria.lopez@liga.gt', 2, 1, 2, 2, 200, 800.00, 'Medallas para maratón centroamericano.', 'ASIGNADO'),
(3, 'GUA-3-0003', 3, 1, '2026-08-17', '10:00:00', '2026-08-21 17:00:00', '2026-08-24 09:00:00', 1, 'Club Atlético GUA', 'Carlos Ruiz', '+502 5555-3333', 'carlos.ruiz@clubgua.com', 3, 3, 3, 3, 30, 950.00, 'Placas conmemorativas grabadas en madera.', 'EN_PROCESO'),
(4, 'GUA-3-0004', 3, 1, '2026-08-14', '11:20:00', '2026-08-18 17:00:00', '2026-08-20 09:00:00', 1, 'MundiEventos', 'Ana Gómez', '+502 5555-4444', 'ana.gomez@mundieventos.com', 1, 4, 1, 1, 15, 2200.00, 'Trofeos de cristal para gala anual.', 'EN_REVISION'),
(5, 'GUA-3-0005', 3, 1, '2026-08-13', '08:45:00', '2026-08-17 17:00:00', '2026-08-19 09:00:00', 0, 'Federación Nacional', 'Luis Herrera', '+502 5555-5555', 'luis.herrera@fednacional.org', 4, 1, 3, 2, 5, 600.00, 'Banners UV para evento deportivo.', 'APROBADO'),
(6, 'GUA-3-0006', 3, 1, '2026-08-10', '13:00:00', '2026-08-15 17:00:00', '2026-08-16 09:00:00', 0, 'Copa MundiTrofeos', 'Diego Alvarado', '+502 5555-6666', 'diego.alvarado@copamt.com', 1, 2, 1, 1, 100, 3200.00, 'Trofeos de premiación Copa MundiTrofeos.', 'VENDIDO'),
(7, 'GUA-3-0007', 3, 1, '2026-08-09', '15:30:00', '2026-08-16 17:00:00', '2026-08-17 09:00:00', 0, 'Cliente particular', 'Sofía Ramírez', '+502 5555-7777', 'sofia.ramirez@correo.com', 2, 1, 2, 2, 40, 450.00, 'Medallas para evento escolar (venta no concretada).', 'CANCELADO');

INSERT INTO `vale_asignaciones` (`vale_id`, `tecnico_id`, `encargado_id`, `fecha_asignacion`, `activo`) VALUES
(2, 7, 5, '2026-08-18 09:30:00', 1),
(3, 7, 5, '2026-08-17 10:30:00', 1),
(4, 8, 5, '2026-08-14 11:45:00', 1),
(5, 9, 6, '2026-08-13 09:00:00', 1),
(6, 7, 5, '2026-08-10 13:20:00', 1);

INSERT INTO `vale_propuestas` (`vale_id`, `tecnico_id`, `url`, `es_cancelacion`, `fecha_subida`) VALUES
(4, 8, NULL, 0, '2026-08-17 16:00:00'),
(5, 9, NULL, 0, '2026-08-15 12:00:00'),
(6, 7, NULL, 0, '2026-08-12 10:00:00');

INSERT INTO `vale_historial` (`vale_id`, `usuario_id`, `estado_anterior`, `estado_nuevo`, `accion`) VALUES
(1, 3, NULL, 'CREADO', 'Vale de arte creado por el asesor'),
(2, 3, NULL, 'CREADO', 'Vale de arte creado por el asesor'),
(2, 5, 'CREADO', 'ASIGNADO', 'Asignado al técnico Técnico Diseño A'),
(3, 3, NULL, 'CREADO', 'Vale de arte creado por el asesor'),
(3, 5, 'CREADO', 'ASIGNADO', 'Asignado al técnico Técnico Diseño A'),
(3, 7, 'ASIGNADO', 'EN_PROCESO', 'Técnico marcó el vale como en proceso'),
(4, 3, NULL, 'CREADO', 'Vale de arte creado por el asesor'),
(4, 5, 'CREADO', 'ASIGNADO', 'Asignado al técnico Técnico Diseño B'),
(4, 8, 'ASIGNADO', 'EN_PROCESO', 'Técnico marcó el vale como en proceso'),
(4, 8, 'EN_PROCESO', 'EN_REVISION', 'Técnico entregó propuesta'),
(5, 3, NULL, 'CREADO', 'Vale de arte creado por el asesor'),
(5, 6, 'CREADO', 'ASIGNADO', 'Asignado al técnico Técnico UV/3D C'),
(5, 9, 'ASIGNADO', 'EN_REVISION', 'Técnico entregó propuesta'),
(5, 6, 'EN_REVISION', 'APROBADO', 'Encargado aprobó la propuesta'),
(6, 3, NULL, 'CREADO', 'Vale de arte creado por el asesor'),
(6, 5, 'CREADO', 'ASIGNADO', 'Asignado al técnico Técnico Diseño A'),
(6, 7, 'ASIGNADO', 'EN_REVISION', 'Técnico entregó propuesta'),
(6, 5, 'EN_REVISION', 'APROBADO', 'Encargado aprobó la propuesta'),
(6, 3, 'APROBADO', 'VENDIDO', 'Asesor confirmó la venta'),
(7, 3, NULL, 'CREADO', 'Vale de arte creado por el asesor'),
(7, 3, 'CREADO', 'CANCELADO', 'Asesor canceló el vale de arte');

SET FOREIGN_KEY_CHECKS = 1;
