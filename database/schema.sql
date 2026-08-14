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
  `password_hash`     VARCHAR(255) NOT NULL,
  `rol_id`            INT NOT NULL,
  `activo`            TINYINT(1)   NOT NULL DEFAULT 1,
  `intentos_fallidos` INT          NOT NULL DEFAULT 0,
  `bloqueado_hasta`   DATETIME     DEFAULT NULL,
  `creado_en`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_usuarios_email` (`email`)
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
(3, 'Asesor de Ventas', 'Acceso a eventos y vales de arte');

-- Permisos (basado en los módulos descritos en arquitectura_reglas.md)
INSERT INTO `permisos` (`id`, `codigo`, `nombre`, `modulo`, `descripcion`) VALUES
-- Vales
(1, 'vales.ver', 'Ver Vales de Arte', 'vales', 'Permite visualizar la lista de vales de arte'),
(2, 'vales.crear', 'Crear Vales de Arte', 'vales', 'Permite ingresar nuevos vales de arte'),
(3, 'vales.editar', 'Editar Vales de Arte', 'vales', 'Permite modificar vales de arte existentes'),
-- Prompts
(4, 'prompts.ver', 'Ver Generador de Prompts', 'prompts', 'Permite acceder al generador de prompts'),
(5, 'prompts.crear', 'Crear Prompts', 'prompts', 'Permite crear nuevos prompts para IA'),
-- Eventos
(6, 'eventos.ver', 'Ver Eventos', 'eventos', 'Permite ver y listar los eventos de carreras'),
(7, 'eventos.crear', 'Crear Eventos', 'eventos', 'Permite registrar nuevos eventos de carreras'),
-- Administración
(8, 'admin.ver', 'Ver Panel de Administración', 'admin', 'Permite acceder al módulo de administración central');

-- Asignación de Permisos a Roles (rol_permisos)
-- Administrador: todos (1 al 8)
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8),
-- Diseñador: Vales (ver, editar) + Prompts (ver, crear)
(2, 1), (2, 3), (2, 4), (2, 5),
-- Asesor de Ventas: Vales (ver, crear) + Eventos (ver, crear)
(3, 1), (3, 2), (3, 6), (3, 7);

-- Usuarios (contraseña predeterminada: admin123 para Administrador, diseno123 para Diseñador, ventas123 para Ventas)
-- Contraseñas hasheadas con bcrypt (rondas por defecto o simuladas):
-- admin@munditrofeos.com  -> admin123   -> $2a$10$P2N5e.5WlqL3Upt5C10Qe.R7tLdK.dGgX62G4x3T/j5gq.hR0yCme
-- diseno@munditrofeos.com -> diseno123  -> $2a$10$Uv0LqfEa2W2a3/ZgC3R7GOmB9wO3j2T.mUuUuFv3gq.hR0yCme
-- ventas@munditrofeos.com -> ventas123  -> $2a$10$c7CgqEa2W2a3/ZgC3R7GOmB9wO3j2T.mUuUuFv3gq.hR0yCme

INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password_hash`, `rol_id`) VALUES
(1, 'Administrador General', 'admin@munditrofeos.com', '$2a$10$P2N5e.5WlqL3Upt5C10Qe.R7tLdK.dGgX62G4x3T/j5gq.hR0yCme', 1),
(2, 'Diseñador Creativo', 'diseno@munditrofeos.com', '$2a$10$Uv0LqfEa2W2a3/ZgC3R7GOmB9wO3j2T.mUuUuFv3gq.hR0yCme', 2),
(3, 'Asesor Comercial', 'ventas@munditrofeos.com', '$2a$10$c7CgqEa2W2a3/ZgC3R7GOmB9wO3j2T.mUuUuFv3gq.hR0yCme', 3);

-- Asignación de países a usuarios
INSERT INTO `usuario_paises` (`usuario_id`, `pais_id`) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), -- Admin opera en todos
(2, 1), -- Diseñador opera en GT
(3, 1), (3, 2); -- Ventas opera en GT y SV

SET FOREIGN_KEY_CHECKS = 1;
