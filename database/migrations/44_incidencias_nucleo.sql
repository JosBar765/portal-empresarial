-- incidencias_nucleo.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué agrega (módulo «Incidencias», fase 1):
--   1. Configuración editable desde el módulo: países habilitados, especialidades, categorías, zonas, tipos de activo,
--      prioridades y su regla impacto → prioridad, motivos de espera, técnicos (con especialidades y tiendas que cubren)
--      y verificadores (por tienda o por país).
--   2. Núcleo: `incidencias`, su historial inmutable (`incidencia_eventos`) y sus fotos (`incidencia_fotos`, solo la URL
--      del Storage; nunca la imagen en MySQL).
--   3. Permisos `incidencias.*` (tabla `permisos`). Solo el rol Administrador los recibe, para poder entrar a Configuración;
--      el resto se asigna desde la pestaña «Roles y permisos» del módulo o desde la pantalla Roles.
--   4. Semillas editables: Guatemala habilitada (los demás países apagados), especialidades, categorías, tipos de activo,
--      zonas, las cuatro prioridades con su regla y los motivos de espera.
--   Los parámetros (límite de fotos, reportes por día…) no se siembran: viven en `parametros_sistema` con el prefijo
--   `incidencias.` y, si falta la fila, manda el valor por defecto del código.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Nota del número: va después de los scripts de Proyectos (hasta el 43) para que el orden de aplicación sea el mismo
--   en cualquier rama; no depende de ellos.
--
-- Reversa (solo si hace falta deshacerlo; borra los datos cargados):
--   DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id` WHERE p.`modulo` = 'incidencias';
--   DELETE FROM `permisos` WHERE `modulo` = 'incidencias';
--   DELETE FROM `parametros_sistema` WHERE `clave` LIKE 'incidencias.%';
--   DROP TABLE IF EXISTS `incidencia_fotos`, `incidencia_eventos`, `incidencias`, `incidencia_verificadores`,
--     `incidencia_tecnico_tiendas`, `incidencia_tecnico_especialidades`, `incidencia_tecnicos`, `incidencia_motivos_espera`,
--     `incidencia_reglas_prioridad`, `incidencia_prioridades`, `incidencia_tipos_activo`, `incidencia_zonas`,
--     `incidencia_categorias`, `incidencia_especialidades`, `incidencia_paises`;

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Configuración
-- ---------------------------------------------------------------------------------------------------------------------

-- Qué países pueden reportar. Apagado, quien reporta ve `aviso`.
CREATE TABLE IF NOT EXISTS `incidencia_paises` (
  `pais_id`    INT NOT NULL PRIMARY KEY,
  `habilitado` TINYINT(1) NOT NULL DEFAULT 0,
  `aviso`      VARCHAR(160) DEFAULT NULL,
  FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `incidencia_especialidades` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(80) NOT NULL UNIQUE,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `orden`  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada categoría la atiende una especialidad (NULL = cualquier técnico).
CREATE TABLE IF NOT EXISTS `incidencia_categorias` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`          VARCHAR(80) NOT NULL UNIQUE,
  `especialidad_id` INT DEFAULT NULL,
  `activo`          TINYINT(1) NOT NULL DEFAULT 1,
  `orden`           INT NOT NULL DEFAULT 0,
  FOREIGN KEY (`especialidad_id`) REFERENCES `incidencia_especialidades` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `tienda_id` NULL = zona general (sirve en todas las tiendas).
CREATE TABLE IF NOT EXISTS `incidencia_zonas` (
  `id`        INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`    VARCHAR(80) NOT NULL,
  `tienda_id` INT DEFAULT NULL,
  `activo`    TINYINT(1) NOT NULL DEFAULT 1,
  `orden`     INT NOT NULL DEFAULT 0,
  INDEX `idx_incidencia_zonas_tienda` (`tienda_id`),
  FOREIGN KEY (`tienda_id`) REFERENCES `tiendas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `incidencia_tipos_activo` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `categoria_id` INT NOT NULL,
  `nombre`       VARCHAR(80) NOT NULL,
  `activo`       TINYINT(1) NOT NULL DEFAULT 1,
  `orden`        INT NOT NULL DEFAULT 0,
  UNIQUE KEY `uq_incidencia_tipo_activo` (`categoria_id`, `nombre`),
  FOREIGN KEY (`categoria_id`) REFERENCES `incidencia_categorias` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `color` es el nombre de un color del portal (rojo, naranja, amarillo, gris), no un código.
CREATE TABLE IF NOT EXISTS `incidencia_prioridades` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `codigo` VARCHAR(4)  NOT NULL UNIQUE,
  `nombre` VARCHAR(40) NOT NULL,
  `color`  VARCHAR(20) NOT NULL DEFAULT 'gris',
  `orden`  INT NOT NULL DEFAULT 0,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Qué prioridad corresponde a cada impacto (los cuatro impactos son fijos; la prioridad se elige).
CREATE TABLE IF NOT EXISTS `incidencia_reglas_prioridad` (
  `impacto`      ENUM('riesgo_personas','detiene_operacion','trabajo_con_limitaciones','molestia_menor') NOT NULL PRIMARY KEY,
  `prioridad_id` INT NOT NULL,
  FOREIGN KEY (`prioridad_id`) REFERENCES `incidencia_prioridades` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `incidencia_motivos_espera` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(80) NOT NULL UNIQUE,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `orden`  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Técnicos: usuarios que ya existen en Administración. `todas_las_tiendas` = cubre cualquier tienda de un país habilitado;
-- si no, solo las de `incidencia_tecnico_tiendas`.
CREATE TABLE IF NOT EXISTS `incidencia_tecnicos` (
  `usuario_id`        INT NOT NULL PRIMARY KEY,
  `activo`            TINYINT(1) NOT NULL DEFAULT 1,
  `todas_las_tiendas` TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `incidencia_tecnico_especialidades` (
  `usuario_id`      INT NOT NULL,
  `especialidad_id` INT NOT NULL,
  PRIMARY KEY (`usuario_id`, `especialidad_id`),
  FOREIGN KEY (`usuario_id`)      REFERENCES `incidencia_tecnicos` (`usuario_id`)  ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`especialidad_id`) REFERENCES `incidencia_especialidades` (`id`)    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `incidencia_tecnico_tiendas` (
  `usuario_id` INT NOT NULL,
  `tienda_id`  INT NOT NULL,
  PRIMARY KEY (`usuario_id`, `tienda_id`),
  FOREIGN KEY (`usuario_id`) REFERENCES `incidencia_tecnicos` (`usuario_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`)  REFERENCES `tiendas` (`id`)                     ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verificadores: una fila por persona y por tienda, o por persona y por país (el del país vale para las tiendas
-- que no tienen uno propio). Exactamente uno de los dos, `tienda_id` o `pais_id`.
-- (MySQL no permite un CHECK sobre columnas con ON UPDATE CASCADE; los ids no cambian, así que no hace falta.)
CREATE TABLE IF NOT EXISTS `incidencia_verificadores` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `tienda_id`  INT DEFAULT NULL,
  `pais_id`    INT DEFAULT NULL,
  INDEX `idx_incidencia_verificador_tienda` (`tienda_id`),
  INDEX `idx_incidencia_verificador_pais` (`pais_id`),
  INDEX `idx_incidencia_verificador_usuario` (`usuario_id`),
  CONSTRAINT `chk_incidencia_verificador_alcance` CHECK ((`tienda_id` IS NULL) <> (`pais_id` IS NULL)),
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`)  REFERENCES `tiendas` (`id`)  ON DELETE CASCADE,
  FOREIGN KEY (`pais_id`)    REFERENCES `paises` (`id`)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Núcleo
-- ---------------------------------------------------------------------------------------------------------------------

-- Estados (palabras completas): en_buzon, en_proceso, en_espera, en_verificacion, correccion_pedida, cerrada, descartada.
-- `correlativo` (INC-000123) se asigna al crear, en la misma transacción. `ronda` cuenta las veces que se envió a verificación.
CREATE TABLE IF NOT EXISTS `incidencias` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `correlativo`    VARCHAR(12) DEFAULT NULL UNIQUE,
  `tienda_id`      INT NOT NULL,
  `zona_id`        INT DEFAULT NULL,
  `categoria_id`   INT NOT NULL,
  `tipo_activo_id` INT DEFAULT NULL,
  `activo_texto`   VARCHAR(120) DEFAULT NULL,
  `titulo`         VARCHAR(120) NOT NULL,
  `descripcion`    TEXT NOT NULL,
  `impacto`        ENUM('riesgo_personas','detiene_operacion','trabajo_con_limitaciones','molestia_menor') NOT NULL,
  `prioridad_id`   INT NOT NULL,
  `reincidente`    TINYINT(1) NOT NULL DEFAULT 0,
  `estado`         ENUM('en_buzon','en_proceso','en_espera','en_verificacion','correccion_pedida','cerrada','descartada') NOT NULL DEFAULT 'en_buzon',
  `reportada_por`  INT NOT NULL,
  `tecnico_id`     INT DEFAULT NULL,
  `ronda`          INT NOT NULL DEFAULT 0,
  `duplicada_de`   INT DEFAULT NULL,
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tomada_en`      DATETIME DEFAULT NULL,
  `cerrada_en`     DATETIME DEFAULT NULL,
  INDEX `idx_incidencias_estado` (`estado`, `prioridad_id`, `creado_en`),
  INDEX `idx_incidencias_tienda` (`tienda_id`, `estado`),
  INDEX `idx_incidencias_tecnico` (`tecnico_id`, `estado`),
  INDEX `idx_incidencias_reportante` (`reportada_por`, `creado_en`),
  FOREIGN KEY (`tienda_id`)      REFERENCES `tiendas` (`id`)                  ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`zona_id`)        REFERENCES `incidencia_zonas` (`id`)         ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`categoria_id`)   REFERENCES `incidencia_categorias` (`id`)    ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`tipo_activo_id`) REFERENCES `incidencia_tipos_activo` (`id`)  ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`prioridad_id`)   REFERENCES `incidencia_prioridades` (`id`)   ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`reportada_por`)  REFERENCES `usuarios` (`id`)                 ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`tecnico_id`)     REFERENCES `usuarios` (`id`)                 ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`duplicada_de`)   REFERENCES `incidencias` (`id`)              ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historial inmutable: apertura, toma, avances, espera, verificación, correcciones, reasignaciones, descarte y cierre.
-- `tipo` lo valida el servicio (así un tipo nuevo no pide migración); `usuario_id` NULL = el sistema.
CREATE TABLE IF NOT EXISTS `incidencia_eventos` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `incidencia_id`     INT NOT NULL,
  `tipo`              VARCHAR(30) NOT NULL,
  `usuario_id`        INT DEFAULT NULL,
  `texto`             TEXT DEFAULT NULL,
  `evolucion`         ENUM('mejoro','sin_cambios','empeoro') DEFAULT NULL,
  `ronda`             INT DEFAULT NULL,
  `datos`             JSON DEFAULT NULL,
  `visible_reportante` TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_incidencia_eventos_incidencia` (`incidencia_id`, `creado_en`),
  FOREIGN KEY (`incidencia_id`) REFERENCES `incidencias` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`usuario_id`)    REFERENCES `usuarios` (`id`)    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fotos: solo la URL del Storage. `etapa`: reporte (al reportar), avance (en un avance), cierre (foto del trabajo terminado).
CREATE TABLE IF NOT EXISTS `incidencia_fotos` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `incidencia_id` INT NOT NULL,
  `evento_id`     INT DEFAULT NULL,
  `etapa`         ENUM('reporte','avance','cierre') NOT NULL,
  `url`           VARCHAR(500) NOT NULL,
  `subida_por`    INT NOT NULL,
  `creado_en`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_incidencia_fotos_incidencia` (`incidencia_id`, `etapa`),
  FOREIGN KEY (`incidencia_id`) REFERENCES `incidencias` (`id`)        ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`evento_id`)     REFERENCES `incidencia_eventos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`subida_por`)    REFERENCES `usuarios` (`id`)           ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Permisos (solo el rol Administrador los recibe)
-- ---------------------------------------------------------------------------------------------------------------------

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT n.`codigo`, n.`nombre`, 'incidencias', n.`descripcion`
FROM (
  SELECT 'incidencias.ver' AS `codigo`, 'Ver Incidencias' AS `nombre`, 'Permite entrar al módulo y ver las incidencias propias' AS `descripcion`
  UNION ALL SELECT 'incidencias.reportar', 'Reportar incidencias', 'Permite reportar un problema con fotos'
  UNION ALL SELECT 'incidencias.resolver', 'Atender incidencias', 'Permite tomar incidencias del buzón, dar avances y enviarlas a verificación'
  UNION ALL SELECT 'incidencias.verificar', 'Verificar incidencias', 'Permite aprobar el cierre de una incidencia o pedir una corrección'
  UNION ALL SELECT 'incidencias.asignar', 'Asignar incidencias', 'Permite reasignar o descartar incidencias'
  UNION ALL SELECT 'incidencias.ver_todas', 'Consultar todas las incidencias', 'Permite ver todas las incidencias de los países habilitados, solo para consultar'
  UNION ALL SELECT 'incidencias.configurar', 'Configurar Incidencias', 'Permite usar la configuración del módulo'
) n
WHERE NOT EXISTS (SELECT 1 FROM `permisos` p WHERE p.`codigo` = n.`codigo`);

INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT r.`id`, p.`id`
FROM `roles` r
JOIN `permisos` p ON p.`modulo` = 'incidencias'
WHERE r.`nombre` = 'Administrador'
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` x WHERE x.`rol_id` = r.`id` AND x.`permiso_id` = p.`id`);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Semillas editables
-- ---------------------------------------------------------------------------------------------------------------------

-- Guatemala habilitada; los demás países apagados con su aviso.
INSERT INTO `incidencia_paises` (`pais_id`, `habilitado`, `aviso`)
SELECT p.`id`, IF(p.`codigo` = 'GT', 1, 0), IF(p.`codigo` = 'GT', NULL, 'Todavía no está disponible en tu país')
FROM `paises` p
WHERE NOT EXISTS (SELECT 1 FROM `incidencia_paises` x WHERE x.`pais_id` = p.`id`);

INSERT INTO `incidencia_especialidades` (`nombre`, `orden`)
SELECT n.`nombre`, n.`orden`
FROM (
  SELECT 'Electricidad' AS `nombre`, 1 AS `orden`
  UNION ALL SELECT 'Equipo de impresión', 2
  UNION ALL SELECT 'Climatización', 3
  UNION ALL SELECT 'Mobiliario', 4
  UNION ALL SELECT 'Plomería', 5
  UNION ALL SELECT 'Informática', 6
  UNION ALL SELECT 'Infraestructura', 7
  UNION ALL SELECT 'Seguridad', 8
) n
WHERE NOT EXISTS (SELECT 1 FROM `incidencia_especialidades` x WHERE x.`nombre` = n.`nombre`);

INSERT INTO `incidencia_categorias` (`nombre`, `especialidad_id`, `orden`)
SELECT n.`nombre`, (SELECT e.`id` FROM `incidencia_especialidades` e WHERE e.`nombre` = n.`especialidad`), n.`orden`
FROM (
  SELECT 'Eléctrica' AS `nombre`, 'Electricidad' AS `especialidad`, 1 AS `orden`
  UNION ALL SELECT 'Equipo de impresión', 'Equipo de impresión', 2
  UNION ALL SELECT 'Climatización', 'Climatización', 3
  UNION ALL SELECT 'Mobiliario', 'Mobiliario', 4
  UNION ALL SELECT 'Plomería', 'Plomería', 5
  UNION ALL SELECT 'Redes y cómputo', 'Informática', 6
  UNION ALL SELECT 'Infraestructura', 'Infraestructura', 7
  UNION ALL SELECT 'Seguridad', 'Seguridad', 8
  UNION ALL SELECT 'Otra', NULL, 9
) n
WHERE NOT EXISTS (SELECT 1 FROM `incidencia_categorias` x WHERE x.`nombre` = n.`nombre`);

INSERT INTO `incidencia_tipos_activo` (`categoria_id`, `nombre`, `orden`)
SELECT (SELECT c.`id` FROM `incidencia_categorias` c WHERE c.`nombre` = n.`categoria`), n.`nombre`, n.`orden`
FROM (
  SELECT 'Eléctrica' AS `categoria`, 'Tomacorriente' AS `nombre`, 1 AS `orden`
  UNION ALL SELECT 'Eléctrica', 'Luminaria', 2
  UNION ALL SELECT 'Eléctrica', 'Interruptor', 3
  UNION ALL SELECT 'Equipo de impresión', 'Impresora', 1
  UNION ALL SELECT 'Equipo de impresión', 'Impresora térmica', 2
  UNION ALL SELECT 'Equipo de impresión', 'Plotter', 3
  UNION ALL SELECT 'Equipo de impresión', 'Sublimadora', 4
  UNION ALL SELECT 'Climatización', 'Aire acondicionado', 1
  UNION ALL SELECT 'Climatización', 'Extractor', 2
  UNION ALL SELECT 'Mobiliario', 'Silla', 1
  UNION ALL SELECT 'Mobiliario', 'Escritorio', 2
  UNION ALL SELECT 'Mobiliario', 'Vitrina', 3
  UNION ALL SELECT 'Plomería', 'Lavamanos', 1
  UNION ALL SELECT 'Plomería', 'Tubería', 2
  UNION ALL SELECT 'Plomería', 'Calentador', 3
  UNION ALL SELECT 'Redes y cómputo', 'Computadora', 1
  UNION ALL SELECT 'Redes y cómputo', 'Router', 2
  UNION ALL SELECT 'Redes y cómputo', 'Cableado', 3
  UNION ALL SELECT 'Infraestructura', 'Puerta', 1
  UNION ALL SELECT 'Infraestructura', 'Ventana', 2
  UNION ALL SELECT 'Infraestructura', 'Piso o techo', 3
  UNION ALL SELECT 'Seguridad', 'Cámara', 1
  UNION ALL SELECT 'Seguridad', 'Alarma', 2
  UNION ALL SELECT 'Seguridad', 'Extintor', 3
) n
WHERE NOT EXISTS (
  SELECT 1 FROM `incidencia_tipos_activo` x
  JOIN `incidencia_categorias` c ON c.`id` = x.`categoria_id`
  WHERE c.`nombre` = n.`categoria` AND x.`nombre` = n.`nombre`
);

-- Zonas generales (sirven en todas las tiendas).
INSERT INTO `incidencia_zonas` (`nombre`, `tienda_id`, `orden`)
SELECT n.`nombre`, NULL, n.`orden`
FROM (
  SELECT 'Sala de ventas' AS `nombre`, 1 AS `orden`
  UNION ALL SELECT 'Diseño', 2
  UNION ALL SELECT 'Producción', 3
  UNION ALL SELECT 'Bodega', 4
  UNION ALL SELECT 'Gerencia', 5
  UNION ALL SELECT 'Comercialización', 6
  UNION ALL SELECT 'Servicios', 7
  UNION ALL SELECT 'Exterior', 8
  UNION ALL SELECT 'Otra', 9
) n
WHERE NOT EXISTS (SELECT 1 FROM `incidencia_zonas` x WHERE x.`nombre` = n.`nombre` AND x.`tienda_id` IS NULL);

INSERT INTO `incidencia_prioridades` (`codigo`, `nombre`, `color`, `orden`)
SELECT n.`codigo`, n.`nombre`, n.`color`, n.`orden`
FROM (
  SELECT 'P1' AS `codigo`, 'Crítica' AS `nombre`, 'rojo' AS `color`, 1 AS `orden`
  UNION ALL SELECT 'P2', 'Alta', 'naranja', 2
  UNION ALL SELECT 'P3', 'Media', 'amarillo', 3
  UNION ALL SELECT 'P4', 'Baja', 'gris', 4
) n
WHERE NOT EXISTS (SELECT 1 FROM `incidencia_prioridades` x WHERE x.`codigo` = n.`codigo`);

INSERT INTO `incidencia_reglas_prioridad` (`impacto`, `prioridad_id`)
SELECT n.`impacto`, (SELECT p.`id` FROM `incidencia_prioridades` p WHERE p.`codigo` = n.`codigo`)
FROM (
  SELECT 'riesgo_personas' AS `impacto`, 'P1' AS `codigo`
  UNION ALL SELECT 'detiene_operacion', 'P2'
  UNION ALL SELECT 'trabajo_con_limitaciones', 'P3'
  UNION ALL SELECT 'molestia_menor', 'P4'
) n
WHERE NOT EXISTS (SELECT 1 FROM `incidencia_reglas_prioridad` x WHERE x.`impacto` = n.`impacto`);

INSERT INTO `incidencia_motivos_espera` (`nombre`, `orden`)
SELECT n.`nombre`, n.`orden`
FROM (
  SELECT 'Esperando repuesto' AS `nombre`, 1 AS `orden`
  UNION ALL SELECT 'Esperando al proveedor', 2
  UNION ALL SELECT 'Sin acceso al lugar', 3
  UNION ALL SELECT 'Esperando respuesta de quien reportó', 4
  UNION ALL SELECT 'Otro', 5
) n
WHERE NOT EXISTS (SELECT 1 FROM `incidencia_motivos_espera` x WHERE x.`nombre` = n.`nombre`);
