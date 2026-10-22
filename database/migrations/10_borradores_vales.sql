-- borradores_vales.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Habilita los borradores de vales de arte: quien puede crear vales (permiso `vales.crear`) guarda
--   su formulario a medias y lo termina después. Un borrador NO es un vale: no tiene correlativo y
--   no pasa por ninguna validación hasta que se envía con «Crear Vale de Arte».
--
-- Qué agrega:
--   1. Tabla `vale_borradores`: un borrador por fila, privado de su dueño (`usuario_id`). Todos los
--      campos del formulario admiten NULL. `vence_en` = creado_en + 30 días; no se renueva al editar.
--   2. Tabla `vale_borrador_documentos`: sus adjuntos (URL en el bucket de borradores).
--   3. Tabla `parametros_sistema` (si aún no existe) y el parámetro `max_borradores_por_usuario` = 15
--      (no pisa un valor ya cambiado). El Administrador lo edita en «Horarios y feriados».
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/borradores_vales.sql
--   Importarlo ANTES de desplegar el código nuevo. Antes de arrancar, crear el bucket de borradores
--   en Supabase Storage y definir SUPABASE_STORAGE_BUCKET_BORRADORES en el .env.
--
-- Reversa (solo si hace falta deshacerlo; borra los borradores guardados):
--   DELETE FROM `parametros_sistema` WHERE `clave` = 'max_borradores_por_usuario';
--   DROP TABLE IF EXISTS `vale_borrador_documentos`;
--   DROP TABLE IF EXISTS `vale_borradores`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `vale_borradores` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id`       INT NOT NULL,
  `cliente_empresa`  VARCHAR(150) DEFAULT NULL,
  `cliente_nombre`   VARCHAR(150) DEFAULT NULL,
  `cliente_telefono` VARCHAR(30)  DEFAULT NULL,
  `cliente_correo`   VARCHAR(150) DEFAULT NULL,
  `talleres_ids`     VARCHAR(100) DEFAULT NULL COMMENT 'Ids de talleres separados por coma, como vales.talleres_solicitados',
  `fecha_entrega`    DATETIME DEFAULT NULL,
  `fecha_evento`     DATETIME DEFAULT NULL,
  `urgente`          TINYINT(1) NOT NULL DEFAULT 0,
  `producto`         VARCHAR(150) DEFAULT NULL,
  `material`         VARCHAR(150) DEFAULT NULL,
  `tecnica`          VARCHAR(150) DEFAULT NULL,
  `acabado`          VARCHAR(150) DEFAULT NULL,
  `cantidad`         INT DEFAULT NULL,
  `cotizacion`       DECIMAL(10,2) DEFAULT NULL,
  `descripcion`      TEXT,
  `creado_en`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `vence_en`         DATETIME NOT NULL,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_borradores_usuario` (`usuario_id`),
  INDEX `idx_borradores_vence` (`vence_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vale_borrador_documentos` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `borrador_id`     INT NOT NULL,
  `nombre_original` VARCHAR(255) NOT NULL,
  `ruta`            VARCHAR(500) NOT NULL,
  `tipo`            ENUM('imagen','documento') NOT NULL,
  `mime_type`       VARCHAR(100) NOT NULL,
  `tamano`          INT NOT NULL,
  `creado_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`borrador_id`) REFERENCES `vale_borradores` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_borrador_documentos_borrador` (`borrador_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Parámetros globales editables por el administrador (misma definición que horarios_laborales).
CREATE TABLE IF NOT EXISTS `parametros_sistema` (
  `clave`          VARCHAR(60)  NOT NULL PRIMARY KEY,
  `valor`          VARCHAR(100) NOT NULL,
  `descripcion`    VARCHAR(255) DEFAULT NULL,
  `actualizado_en` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `parametros_sistema` (`clave`, `valor`, `descripcion`)
SELECT 'max_borradores_por_usuario', '15', 'Máximo de borradores de vale que puede tener cada usuario (entero de 1 a 200)' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `parametros_sistema` WHERE `clave` = 'max_borradores_por_usuario');
