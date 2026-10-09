-- mensajes_rechazo.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Habilita la conversación entre el Encargado/Asistente de un taller y el asesor del vale cuando el
--   taller rechaza el vale (rechazo general con mensaje) y mientras corre el plazo de 24 h. Los mensajes
--   miden como máximo 200 caracteres.
--
-- Qué agrega (y nada más; no modifica ninguna tabla, columna, índice, dato ni permiso existente):
--   1. Tabla `vale_taller_mensajes`: un mensaje de la conversación de UN taller dentro de UN vale.
--
-- Cómo se relaciona (solo por llaves foráneas, sin triggers):
--   - `vale_taller_id` -> `vale_talleres` con ON DELETE CASCADE. Cuando se elimina el vale
--     (plazo vencido, baja del asesor o rechazo del supervisor), sus filas de `vale_talleres` caen en
--     cascada y con ellas la conversación.
--   - `autor_id` -> `usuarios` (RESTRICT, igual que el resto de tablas del módulo).
--
-- Permisos: no hay permisos nuevos. Escribe del lado del taller quien tiene `vales.verificar_adjuntos`
-- y del lado del asesor quien tiene `vales.corregir` (el dueño del vale).
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_mensajes_rechazo.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Importar ANTES de desplegar el código nuevo. No hace falta que los usuarios vuelvan a iniciar sesión.
--
-- Cómo se revierte (solo si hiciera falta; borra las conversaciones):
--   DROP TABLE IF EXISTS `vale_taller_mensajes`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `vale_taller_mensajes` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  -- Taller (dentro del vale) al que pertenece la conversación.
  `vale_taller_id` INT NOT NULL,
  -- Quien escribió el mensaje.
  `autor_id`       INT NOT NULL,
  -- De qué lado escribió: el taller (encargado/asistente) o el asesor dueño del vale.
  `lado`           ENUM('TALLER', 'ASESOR') NOT NULL,
  -- Máximo 200 caracteres (también se valida en el servidor).
  `mensaje`        VARCHAR(200) NOT NULL,
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_taller_id`) REFERENCES `vale_talleres` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`autor_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_vale_taller_mensajes_hilo` (`vale_taller_id`, `creado_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
