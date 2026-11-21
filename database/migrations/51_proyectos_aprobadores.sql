-- proyectos_aprobadores.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué agrega: la tabla `proy_aprobadores`, con las personas que aprueban la activación de un proyecto y las que dan el visto bueno
-- al cierre. Antes lo decidía un permiso de rol (`proyectos.aprobar_activacion`, `proyectos.dar_visto_bueno`); ahora lo configura el
-- administrador por persona, en Reglas y aprobaciones. Sin datos iniciales: hasta que el administrador asigne a alguien, nadie aprueba.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Reversa: DROP TABLE IF EXISTS `proy_aprobadores`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `proy_aprobadores` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `usuario_id` INT NOT NULL,
  `paso`       ENUM('activacion', 'visto_bueno') NOT NULL,
  `creado_por` INT NULL,
  `creado_en`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_proy_aprobadores` (`paso`, `usuario_id`),
  KEY `idx_proy_aprobadores_usuario` (`usuario_id`),
  CONSTRAINT `fk_proy_aprobadores_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
