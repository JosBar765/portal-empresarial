-- Proyectos · fase 7: vínculo entre un vale de arte creado desde Proyectos y la empresa del asesor.
-- Aditiva e idempotente. Un vale se liga a una sola empresa (`vale_id` único). El backend de Vales no depende de esta tabla.
-- Reversión manual: DROP TABLE `proy_vales`;
CREATE TABLE IF NOT EXISTS `proy_vales` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `participacion_id` INT NOT NULL,
  `vale_id`          INT NOT NULL,
  `vinculado_por`    INT NOT NULL,
  `vinculado_en`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_proy_vales_vale` (`vale_id`),
  INDEX `idx_proy_vales_participacion` (`participacion_id`),
  FOREIGN KEY (`participacion_id`) REFERENCES `proy_participaciones` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`vale_id`)          REFERENCES `vales` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`vinculado_por`)    REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
