-- notificaciones_dispositivos.sql
-- Avisos del sistema (Web Push) en computadora y celular.
--
-- Qué hace:
--   1. `push_suscripciones`: una fila por navegador o dispositivo que activó los avisos.
--   2. `notificacion_preferencias`: qué categorías quiere recibir cada usuario, por módulo y clase de dispositivo.
--      Sin fila = desactivado.
--
-- Cómo se aplica (idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (el código nuevo dejaría de enviar avisos):
--   DROP TABLE `notificacion_preferencias`;
--   DROP TABLE `push_suscripciones`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `push_suscripciones` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  -- Dueño actual: la suscripción pasa al último usuario que la registra (equipos compartidos).
  `usuario_id`     INT NOT NULL,
  -- URL que entrega el servicio push del navegador para este dispositivo.
  `endpoint`       TEXT NOT NULL,
  -- SHA-256 (hex) del endpoint: el TEXT no se puede indexar completo.
  `endpoint_hash`  CHAR(64) NOT NULL,
  `p256dh`         VARCHAR(255) NOT NULL,
  `auth`           VARCHAR(255) NOT NULL,
  -- 'escritorio' o 'movil': decide qué columna de las preferencias aplica.
  `dispositivo`    VARCHAR(10) NOT NULL,
  `user_agent`     VARCHAR(255) NULL,
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_push_endpoint_hash` (`endpoint_hash`),
  KEY `idx_push_usuario` (`usuario_id`),
  CONSTRAINT `fk_push_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notificacion_preferencias` (
  `usuario_id`     INT NOT NULL,
  `modulo`         VARCHAR(30) NOT NULL,
  `categoria`      VARCHAR(40) NOT NULL,
  `escritorio`     TINYINT(1) NOT NULL DEFAULT 0,
  `movil`          TINYINT(1) NOT NULL DEFAULT 0,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`usuario_id`, `modulo`, `categoria`),
  CONSTRAINT `fk_notificacion_preferencias_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
