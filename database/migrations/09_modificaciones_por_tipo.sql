-- modificaciones_por_tipo.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Habilita los tres tipos de modificación de un vale:
--     - Básica: no crea vale MOD. El asesor y el taller conversan (mensajes de 200 caracteres) y el taller
--       acepta o rechaza el cambio; si acepta, rehace la propuesta.
--     - Media y Avanzada: crean un vale MOD que autoriza el supervisor. Los MOD son acumulables
--       (MOD-X, MOD2-X, MOD3-X…), por eso se guarda el tipo y el número de cada uno.
--
-- Qué agrega (no modifica ninguna columna, dato ni permiso existente, salvo rellenar los MOD ya creados):
--   1. Columna `vales`.`modificacion_tipo` (MEDIA / AVANZADA; NULL en vales que no son MOD).
--   2. Columna `vales`.`modificacion_numero` (1, 2, 3…; NULL en vales que no son MOD).
--   3. Relleno: los vales MOD que ya existen quedan como MEDIA número 1 (era la única modificación posible).
--   4. Tabla `vale_modificaciones_basicas`: una solicitud de modificación básica de UN taller dentro de UN vale.
--   5. Tabla `vale_modificacion_mensajes`: los mensajes de la conversación de esa solicitud.
--   6. Permiso `vales.responder_modificacion_basica` (tabla `permisos`), asignado a los mismos roles que ya
--      tienen `vales.verificar_adjuntos` (el encargado de cada taller y sus asistentes).
--
-- Cómo se relaciona (solo por llaves foráneas, sin triggers):
--   - `vale_id` -> `vales` y `vale_taller_id` -> `vale_talleres`, ambas con ON DELETE CASCADE: si el vale
--     se elimina, caen sus solicitudes y con ellas los mensajes.
--   - `solicitante_id` y `autor_id` -> `usuarios` (RESTRICT, igual que el resto de tablas del módulo).
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_modificaciones_por_tipo.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Importar ANTES de desplegar el código nuevo. Los usuarios del taller deben cerrar sesión e iniciar de
--   nuevo para que su token incluya el permiso nuevo.
--
-- Cómo se revierte (solo si hiciera falta; borra las conversaciones de modificaciones básicas):
--   DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id` WHERE p.`codigo` = 'vales.responder_modificacion_basica';
--   DELETE FROM `permisos` WHERE `codigo` = 'vales.responder_modificacion_basica';
--   DROP TABLE IF EXISTS `vale_modificacion_mensajes`;
--   DROP TABLE IF EXISTS `vale_modificaciones_basicas`;
--   ALTER TABLE `vales` DROP COLUMN `modificacion_numero`, DROP COLUMN `modificacion_tipo`;

SET NAMES utf8mb4;

-- 1. vales.modificacion_tipo (solo si todavía no existe)
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vales' AND COLUMN_NAME = 'modificacion_tipo');
SET @sql := IF(@existe = 0,
  'ALTER TABLE `vales` ADD COLUMN `modificacion_tipo` ENUM(''MEDIA'', ''AVANZADA'') DEFAULT NULL',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;

-- 2. vales.modificacion_numero (solo si todavía no existe)
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vales' AND COLUMN_NAME = 'modificacion_numero');
SET @sql := IF(@existe = 0,
  'ALTER TABLE `vales` ADD COLUMN `modificacion_numero` INT DEFAULT NULL',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;

-- 3. Los MOD que ya existen eran la única modificación posible: Media, número 1.
UPDATE `vales`
SET `modificacion_tipo` = 'MEDIA', `modificacion_numero` = 1
WHERE `vale_original_id` IS NOT NULL AND `modificacion_tipo` IS NULL;

-- 4. Solicitud de modificación básica (un taller dentro de un vale).
CREATE TABLE IF NOT EXISTS `vale_modificaciones_basicas` (
  `id`                     INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`                INT NOT NULL,
  `vale_taller_id`         INT NOT NULL,
  `solicitante_id`         INT NOT NULL,
  -- Mientras conversan: EN_CONVERSACION. Al responder el taller: ACEPTADA o RECHAZADA. El asesor puede
  -- CANCELAR. Cuando el taller entrega y se aprueba la nueva propuesta: ENTREGADA.
  `estado`                 ENUM('EN_CONVERSACION', 'ACEPTADA', 'RECHAZADA', 'CANCELADA', 'ENTREGADA') NOT NULL DEFAULT 'EN_CONVERSACION',
  -- Fecha de entrega vigente al pedirla y la que regiría (1 día hábil más); se aplica solo si el taller acepta.
  `fecha_entrega_anterior` DATETIME NOT NULL,
  `fecha_entrega_nueva`    DATETIME NOT NULL,
  `creado_en`              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resuelto_en`            DATETIME DEFAULT NULL,
  `resuelto_por`           INT DEFAULT NULL,
  FOREIGN KEY (`vale_id`)        REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`vale_taller_id`) REFERENCES `vale_talleres` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`solicitante_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`resuelto_por`)   REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_modificaciones_basicas_vale` (`vale_id`, `estado`),
  INDEX `idx_modificaciones_basicas_taller` (`vale_taller_id`, `estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Mensajes de la conversación (máximo 200 caracteres; también se valida en el servidor).
CREATE TABLE IF NOT EXISTS `vale_modificacion_mensajes` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `modificacion_id` INT NOT NULL,
  `autor_id`        INT NOT NULL,
  `lado`            ENUM('TALLER', 'ASESOR') NOT NULL,
  `mensaje`         VARCHAR(200) NOT NULL,
  `creado_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`modificacion_id`) REFERENCES `vale_modificaciones_basicas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`autor_id`)        REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_modificacion_mensajes_hilo` (`modificacion_id`, `creado_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Permiso nuevo, sin id fijo (se usa el siguiente libre de esta base).
INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'vales.responder_modificacion_basica', 'Responder Modificación Básica', 'vales',
       'Permite al encargado de taller conversar, aceptar o rechazar una modificación básica solicitada por el asesor'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'vales.responder_modificacion_basica');

-- Lo reciben los mismos roles que ya verifican adjuntos (encargados y asistentes de cada taller).
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT rp.`rol_id`, pn.`id`
FROM `rol_permisos` rp
JOIN `permisos` pv ON pv.`id` = rp.`permiso_id` AND pv.`codigo` = 'vales.verificar_adjuntos'
JOIN `permisos` pn ON pn.`codigo` = 'vales.responder_modificacion_basica'
WHERE NOT EXISTS (SELECT 1 FROM `rol_permisos` x WHERE x.`rol_id` = rp.`rol_id` AND x.`permiso_id` = pn.`id`);
