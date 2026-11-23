-- Proyectos · fase 6c: matriz de avisos configurable (pantalla A8).
-- Solo guardan lo que el administrador CAMBIÓ respecto a los valores por defecto del código (`eventos.js`): sin filas, todo está
-- en su valor por defecto; «Restaurar valores por defecto» borra las filas. Aditiva e idempotente.
-- Reversión manual: DROP TABLE `proy_avisos_anticipacion`; DROP TABLE `proy_avisos_config`;

-- `evento` y `rol` (asesor | supervisor | gerente): ¿se avisa a ese rol por ese evento?
CREATE TABLE IF NOT EXISTS `proy_avisos_config` (
  `evento`         VARCHAR(40) NOT NULL,
  `rol`            VARCHAR(12) NOT NULL,
  `activo`         TINYINT(1) NOT NULL,
  `actualizado_por` INT DEFAULT NULL,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`evento`, `rol`),
  FOREIGN KEY (`actualizado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Con cuánta anticipación avisa un evento (horas, días o unidades según el evento).
CREATE TABLE IF NOT EXISTS `proy_avisos_anticipacion` (
  `evento`         VARCHAR(40) NOT NULL PRIMARY KEY,
  `valor`          INT NOT NULL,
  `actualizado_por` INT DEFAULT NULL,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`actualizado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
