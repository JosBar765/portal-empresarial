-- Proyectos · fase 9f: meta de ventas por asesor.
-- Aditiva e idempotente. La meta del proyecto (`proy_proyectos.meta_monto`) se reparte en partes iguales entre los asesores; esta tabla guarda
-- solo lo que el supervisor AJUSTÓ a mano (una fila por asesor). Sin fila, la meta del asesor es la parte igual. La de cada tienda es la suma.
-- Reversión manual: DROP TABLE `proy_metas_asesor`;
CREATE TABLE IF NOT EXISTS `proy_metas_asesor` (
  `proyecto_id`     INT NOT NULL,
  `asesor_id`       INT NOT NULL,
  `monto`           DECIMAL(12,2) NOT NULL,
  `actualizado_por` INT DEFAULT NULL,
  `actualizado_en`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`proyecto_id`, `asesor_id`),
  FOREIGN KEY (`proyecto_id`)     REFERENCES `proy_proyectos` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`asesor_id`)       REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`actualizado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
