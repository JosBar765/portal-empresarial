-- tiempos_nucleo.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué agrega: el módulo Calculadora de Tiempos. La Tabla de tiempos se guarda por VERSIÓN: cada versión es una copia completa
-- (líneas, categorías, etapas, productos, rangos con sus días, extras con sus opciones y alcance, reglas y avisos); una versión está «publicada» (la que ven todos),
-- como mucho una está en «borrador» (lo que edita el administrador) y las anteriores quedan «reemplazadas» como historial.
-- «Cliente» no se guarda: se calcula (suma de etapas + margen). La carga inicial (Ver. 5.0) la hace el servidor al arrancar si no
-- hay ninguna versión. Crea además los permisos `tiempos.ver` y `tiempos.administrar`, SIN asignar a ningún rol.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Reversa:
--   DROP TABLE IF EXISTS `tiempos_historial`, `tiempos_avisos`, `tiempos_parametros`, `tiempos_extra_alcance`, `tiempos_extra_rangos`,
--     `tiempos_extra_opciones`, `tiempos_extras`, `tiempos_rango_etapas`, `tiempos_rangos`, `tiempos_productos`, `tiempos_etapas`,
--     `tiempos_categorias`, `tiempos_lineas`, `tiempos_versiones`;
--   DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id` WHERE p.`modulo` = 'tiempos';
--   DELETE FROM `permisos` WHERE `modulo` = 'tiempos';

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `tiempos_versiones` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `numero`       VARCHAR(20) NOT NULL,
  `fecha`        DATE NOT NULL,
  `nota`         VARCHAR(255) DEFAULT NULL,
  `estado`       ENUM('borrador', 'publicada', 'reemplazada') NOT NULL DEFAULT 'borrador',
  `creada_por`   INT DEFAULT NULL,
  `creada_en`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `publicada_por` INT DEFAULT NULL,
  `publicada_en` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tiempos_version_numero` (`numero`),
  KEY `idx_tiempos_version_estado` (`estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiempos_lineas` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `version_id` INT UNSIGNED NOT NULL,
  `clave`      VARCHAR(40) NOT NULL,
  `nombre`     VARCHAR(80) NOT NULL,
  `orden`      INT NOT NULL DEFAULT 0,
  `activo`     TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tiempos_linea` (`version_id`, `clave`),
  CONSTRAINT `fk_tiempos_linea_version` FOREIGN KEY (`version_id`) REFERENCES `tiempos_versiones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categorías: agrupan los productos dentro de una línea (se renombran, ordenan y ocultan desde la administración).
CREATE TABLE IF NOT EXISTS `tiempos_categorias` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `version_id`  INT UNSIGNED NOT NULL,
  `clave`       VARCHAR(80) NOT NULL,
  `linea_clave` VARCHAR(40) NOT NULL,
  `nombre`      VARCHAR(80) NOT NULL,
  `orden`       INT NOT NULL DEFAULT 0,
  `activo`      TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tiempos_categoria` (`version_id`, `clave`),
  CONSTRAINT `fk_tiempos_categoria_version` FOREIGN KEY (`version_id`) REFERENCES `tiempos_versiones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiempos_etapas` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `version_id` INT UNSIGNED NOT NULL,
  `clave`      VARCHAR(40) NOT NULL,
  `nombre`     VARCHAR(80) NOT NULL,
  `orden`      INT NOT NULL DEFAULT 0,
  `activo`     TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tiempos_etapa` (`version_id`, `clave`),
  CONSTRAINT `fk_tiempos_etapa_version` FOREIGN KEY (`version_id`) REFERENCES `tiempos_versiones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiempos_productos` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `version_id`      INT UNSIGNED NOT NULL,
  `clave`           VARCHAR(80) NOT NULL,
  `linea_clave`     VARCHAR(40) NOT NULL,
  `categoria_clave` VARCHAR(80) DEFAULT NULL,
  `nombre`          VARCHAR(150) NOT NULL,
  `orden`           INT NOT NULL DEFAULT 0,
  `activo`          TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tiempos_producto` (`version_id`, `clave`),
  KEY `idx_tiempos_producto_linea` (`version_id`, `linea_clave`),
  CONSTRAINT `fk_tiempos_producto_version` FOREIGN KEY (`version_id`) REFERENCES `tiempos_versiones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiempos_rangos` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `producto_id` INT UNSIGNED NOT NULL,
  `desde`       INT NOT NULL,
  `hasta`       INT DEFAULT NULL,
  `a_convenir`  TINYINT(1) NOT NULL DEFAULT 0,
  `orden`       INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_tiempos_rango_producto` (`producto_id`, `desde`),
  CONSTRAINT `fk_tiempos_rango_producto` FOREIGN KEY (`producto_id`) REFERENCES `tiempos_productos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiempos_rango_etapas` (
  `rango_id`   INT UNSIGNED NOT NULL,
  `etapa_clave` VARCHAR(40) NOT NULL,
  `dias`       INT NOT NULL,
  PRIMARY KEY (`rango_id`, `etapa_clave`),
  CONSTRAINT `fk_tiempos_rango_etapa` FOREIGN KEY (`rango_id`) REFERENCES `tiempos_rangos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Extras: lo que se suma a una pieza según lo que pide el cliente. Tres tipos:
--   si_no        → casilla; suma `dias_fijos` (p. ej. Moldes).
--   por_cantidad → días según la cantidad, con una o varias opciones y una tabla de rangos por opción (p. ej. Impresión UV).
--   por_unidades → número; incluye `unidades_incluidas` y suma `unidades_dias` por cada `unidades_cada` más (p. ej. Colores).
-- `todos` = se ofrece en todos los productos; si no, en lo que diga `tiempos_extra_alcance`.
CREATE TABLE IF NOT EXISTS `tiempos_extras` (
  `id`                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `version_id`         INT UNSIGNED NOT NULL,
  `clave`              VARCHAR(80) NOT NULL,
  `tipo`               ENUM('si_no', 'por_cantidad', 'por_unidades') NOT NULL,
  `nombre`             VARCHAR(80) NOT NULL,
  `etiqueta`           VARCHAR(120) NOT NULL,
  `ayuda`              VARCHAR(255) DEFAULT NULL,
  `aviso`              VARCHAR(255) DEFAULT NULL,
  `dias_fijos`         INT DEFAULT NULL,
  `unidades_incluidas` INT DEFAULT NULL,
  `unidades_cada`      INT DEFAULT NULL,
  `unidades_dias`      INT DEFAULT NULL,
  `unidades_max`       INT DEFAULT NULL,
  `todos`              TINYINT(1) NOT NULL DEFAULT 1,
  `activo`             TINYINT(1) NOT NULL DEFAULT 1,
  `orden`              INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tiempos_extra` (`version_id`, `clave`),
  CONSTRAINT `fk_tiempos_extra_version` FOREIGN KEY (`version_id`) REFERENCES `tiempos_versiones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opciones de un extra por cantidad (los tipos de UV); cada una tiene su tabla de rangos.
CREATE TABLE IF NOT EXISTS `tiempos_extra_opciones` (
  `id`       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `extra_id` INT UNSIGNED NOT NULL,
  `clave`    VARCHAR(80) NOT NULL,
  `nombre`   VARCHAR(80) NOT NULL,
  `aviso`    VARCHAR(255) DEFAULT NULL,
  `orden`    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tiempos_extra_opcion` (`extra_id`, `clave`),
  CONSTRAINT `fk_tiempos_extra_opcion` FOREIGN KEY (`extra_id`) REFERENCES `tiempos_extras` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiempos_extra_rangos` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `opcion_id`  INT UNSIGNED NOT NULL,
  `desde`      INT NOT NULL,
  `hasta`      INT DEFAULT NULL,
  `dias`       INT DEFAULT NULL,
  `a_convenir` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_tiempos_extra_rango` (`opcion_id`, `desde`),
  CONSTRAINT `fk_tiempos_extra_rango` FOREIGN KEY (`opcion_id`) REFERENCES `tiempos_extra_opciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dónde se ofrece un extra que no es para todos: líneas, categorías o productos (por clave).
CREATE TABLE IF NOT EXISTS `tiempos_extra_alcance` (
  `extra_id` INT UNSIGNED NOT NULL,
  `tipo`     ENUM('linea', 'categoria', 'producto') NOT NULL,
  `clave`    VARCHAR(80) NOT NULL,
  PRIMARY KEY (`extra_id`, `tipo`, `clave`),
  CONSTRAINT `fk_tiempos_extra_alcance` FOREIGN KEY (`extra_id`) REFERENCES `tiempos_extras` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reglas: números (`valor`) o textos (`texto`), p. ej. margen_dias, max_piezas, aviso_urgente.
CREATE TABLE IF NOT EXISTS `tiempos_parametros` (
  `version_id` INT UNSIGNED NOT NULL,
  `clave`      VARCHAR(40) NOT NULL,
  `valor`      INT DEFAULT NULL,
  `texto`      VARCHAR(255) DEFAULT NULL,
  `ayuda`      VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`version_id`, `clave`),
  CONSTRAINT `fk_tiempos_parametro_version` FOREIGN KEY (`version_id`) REFERENCES `tiempos_versiones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiempos_avisos` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `version_id`     INT UNSIGNED NOT NULL,
  `producto_clave` VARCHAR(80) DEFAULT NULL,
  `texto`          VARCHAR(255) NOT NULL,
  `orden`          INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_tiempos_aviso` (`version_id`, `producto_clave`),
  CONSTRAINT `fk_tiempos_aviso_version` FOREIGN KEY (`version_id`) REFERENCES `tiempos_versiones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quién cambió qué (borradores, publicaciones y descartes). No se borra con la versión.
CREATE TABLE IF NOT EXISTS `tiempos_historial` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `usuario_id` INT DEFAULT NULL,
  `version_id` INT UNSIGNED DEFAULT NULL,
  `entidad`    VARCHAR(40) NOT NULL,
  `clave`      VARCHAR(120) NOT NULL,
  `accion`     VARCHAR(30) NOT NULL,
  `antes`      TEXT DEFAULT NULL,
  `despues`    TEXT DEFAULT NULL,
  `creado_en`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tiempos_historial` (`creado_en`, `entidad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT n.`codigo`, n.`nombre`, 'tiempos', n.`descripcion`
FROM (
  SELECT 'tiempos.ver' AS `codigo`, 'Ver la Calculadora de Tiempos' AS `nombre`, 'Entrar al módulo: calcular tiempos y consultar la tabla' AS `descripcion`
  UNION ALL SELECT 'tiempos.administrar', 'Administrar la Tabla de tiempos', 'Editar productos, rangos, días, extras y avisos, y publicar versiones'
) n
WHERE NOT EXISTS (SELECT 1 FROM `permisos` p WHERE p.`codigo` = n.`codigo`);
