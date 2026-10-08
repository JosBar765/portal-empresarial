-- admin_generar_vale.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Habilita la pestaña «Crear Vale de Arte» de Administración, que genera el PDF de un vale
--   con datos arbitrarios (correcciones), lo sube a Storage y deja una fila de auditoría.
--   No crea ni modifica vales.
--
-- Qué agrega:
--   1. Tabla `vale_pdf_generados` (auditoría: quién generó qué PDF, cuándo y con qué link).
--   2. Permiso `admin.vales.generar` (tabla `permisos`).
--   3. Asignación de ese permiso SOLO al rol Administrador (rol_id 1) en `rol_permisos`.
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_admin_generar_vale.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Después, los usuarios Administrador deben cerrar sesión e iniciar de nuevo
--   para que su token incluya el permiso nuevo.

SET NAMES utf8mb4;

-- Auditoría de PDFs generados desde Administración.
CREATE TABLE IF NOT EXISTS `vale_pdf_generados` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  -- Usuario que generó el PDF.
  `usuario_id`  INT NOT NULL,
  -- Correlativo escrito a mano en el formulario (texto libre).
  `correlativo` VARCHAR(50) NOT NULL,
  -- Link público del PDF en Supabase Storage.
  `url`         VARCHAR(500) NOT NULL,
  -- Cuándo se generó (la lista de la pestaña ordena por esta columna).
  `creado_en`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_vale_pdf_generados_creado` (`creado_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permiso nuevo, sin id fijo (se usa el siguiente libre de esta base).
INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'admin.vales.generar', 'Generar PDF de Vale', 'admin',
       'Permite generar el PDF de un vale con datos arbitrarios (correcciones) y subirlo a Storage, sin crear ni modificar vales'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'admin.vales.generar');

-- Solo el rol Administrador (rol_id 1) recibe el permiso.
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT 1, p.`id` FROM `permisos` p
WHERE p.`codigo` = 'admin.vales.generar'
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` rp WHERE rp.`rol_id` = 1 AND rp.`permiso_id` = p.`id`);
