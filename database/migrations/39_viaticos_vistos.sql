-- viaticos_vistos.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Registra qué persona con permiso de autorizar ya abrió el documento de una solicitud de viáticos. El servidor
--   exige ese visto antes de autorizar o rechazar (el Administrador queda exento), igual que en Vales de Arte.
--
-- Qué agrega:
--   Tabla `viaticos_vistos` (solicitud_id, usuario_id, visto_en): un visto por persona y solicitud. Se borra sola
--   al eliminar la solicitud o la persona (CASCADE) y la aplicación la vacía cuando el solicitante modifica la solicitud.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--   Se aplica después de `viaticos_esquema` (el ejecutor ordena por nombre).
--
-- Cómo se revierte (solo si hiciera falta; Gestiones dejaría de funcionar hasta quitar también el código del visto):
--   DROP TABLE IF EXISTS `viaticos_vistos`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `viaticos_vistos` (
  `solicitud_id` INT NOT NULL,
  `usuario_id`   INT NOT NULL,
  `visto_en`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`solicitud_id`, `usuario_id`),
  INDEX `idx_viaticos_vistos_usuario` (`usuario_id`),
  FOREIGN KEY (`solicitud_id`) REFERENCES `viaticos_solicitudes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
