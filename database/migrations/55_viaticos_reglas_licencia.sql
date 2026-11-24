-- 55_viaticos_reglas_licencia.sql
-- Módulo Calculadora de Viáticos: carga los tipos de licencia y las reglas de licencia de Guatemala,
-- El Salvador, Honduras, Nicaragua, Costa Rica, Panamá y Belice.
--
-- Flotilla de la empresa: motocicleta, automóvil, SUV y panel. Solo hay dos reglas reales:
--   1. Moto y 4 ruedas están separadas: una licencia de moto solo sirve con la placa «M» (Motocicleta)
--      y una de 4 ruedas nunca con ella. Sin límites de tonelaje ni pasajeros.
--   2. Guatemala: la licencia C solo sirve con placa Particular (P); B y A sirven con P, C y A.
--      En los demás países toda licencia de 4 ruedas sirve con la placa única «TODAS».
--
-- Qué hace:
--   1. Crea el país Panamá (PA) si no existe.
--   2. Crea los tipos de placa: Guatemala P, C, A y M; los demás países «TODAS» (4 ruedas) y «M» (moto).
--   3. Crea los tipos de licencia con el código prefijado por país (GT-B, HN-B…): el código es único
--      global y varios países repiten letras con significado distinto.
--   4. Crea las reglas (país, licencia, placa), sin límites de tonelaje ni pasajeros (NULL).
--
-- No cubre (el modelo no lo expresa): licencia Profesional exigida a Nicaragua con placa comercial,
-- camiones, buses, ejes, articulado, carga peligrosa ni vehículos agrícolas.
--
-- Cómo se aplica (idempotente: no duplica ni pisa lo que el dueño editó en Configuración):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (solo las filas de esta carga; las licencias ya asignadas a personas se conservan):
--   DELETE FROM `viaticos_tipos_licencia` WHERE `codigo` REGEXP '^(GT|SV|HN|NI|CR|PA|BZ)-' AND `id` NOT IN (SELECT `tipo_licencia_id` FROM `viaticos_licencias`);

INSERT INTO `paises` (`codigo`, `nombre`, `codigo_telefono`)
SELECT 'PA', 'Panamá', '+507' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `paises` WHERE `codigo` = 'PA');

-- Tipos de placa
INSERT INTO `viaticos_tipos_placa` (`pais_id`, `codigo`, `nombre`)
SELECT p.`id`, d.`codigo`, d.`nombre` FROM (
  SELECT 'GT' AS `pais`, 'P' AS `codigo`, 'Particular' AS `nombre`
  UNION ALL SELECT 'GT', 'C', 'Comercial'
  UNION ALL SELECT 'GT', 'A', 'Alquiler'
  UNION ALL SELECT 'GT', 'M', 'Motocicleta'
  UNION ALL SELECT 'SV', 'TODAS', 'Todas las placas de 4 ruedas'
  UNION ALL SELECT 'SV', 'M', 'Motocicleta'
  UNION ALL SELECT 'HN', 'TODAS', 'Todas las placas de 4 ruedas'
  UNION ALL SELECT 'HN', 'M', 'Motocicleta'
  UNION ALL SELECT 'NI', 'TODAS', 'Todas las placas de 4 ruedas'
  UNION ALL SELECT 'NI', 'M', 'Motocicleta'
  UNION ALL SELECT 'CR', 'TODAS', 'Todas las placas de 4 ruedas'
  UNION ALL SELECT 'CR', 'M', 'Motocicleta'
  UNION ALL SELECT 'PA', 'TODAS', 'Todas las placas de 4 ruedas'
  UNION ALL SELECT 'PA', 'M', 'Motocicleta'
  UNION ALL SELECT 'BZ', 'TODAS', 'Todas las placas de 4 ruedas'
  UNION ALL SELECT 'BZ', 'M', 'Motocicleta'
) d
JOIN `paises` p ON p.`codigo` = d.`pais`
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_tipos_placa` t WHERE t.`pais_id` = p.`id` AND t.`codigo` = d.`codigo`);

-- Tipos de licencia
INSERT INTO `viaticos_tipos_licencia` (`codigo`, `nombre`)
SELECT d.`codigo`, d.`nombre` FROM (
  SELECT 'GT-M' AS `codigo`, 'Guatemala · Tipo M (motocicletas)' AS `nombre`
  UNION ALL SELECT 'GT-C', 'Guatemala · Tipo C'
  UNION ALL SELECT 'GT-B', 'Guatemala · Tipo B'
  UNION ALL SELECT 'GT-A', 'Guatemala · Tipo A'
  UNION ALL SELECT 'SV-MOTO', 'El Salvador · Motociclista'
  UNION ALL SELECT 'SV-PARTICULAR', 'El Salvador · Particular'
  UNION ALL SELECT 'SV-LIVIANA', 'El Salvador · Liviana'
  UNION ALL SELECT 'SV-PESADA', 'El Salvador · Pesada'
  UNION ALL SELECT 'SV-PESADA-T', 'El Salvador · Pesada-T'
  UNION ALL SELECT 'HN-MOTO', 'Honduras · Especial (motocicletas)'
  UNION ALL SELECT 'HN-B', 'Honduras · Tipo B'
  UNION ALL SELECT 'HN-C1', 'Honduras · Tipo C1'
  UNION ALL SELECT 'HN-C', 'Honduras · Tipo C'
  UNION ALL SELECT 'HN-CE', 'Honduras · Tipo CE'
  UNION ALL SELECT 'NI-1', 'Nicaragua · Categoría 1 (motocicletas de baja cilindrada)'
  UNION ALL SELECT 'NI-2', 'Nicaragua · Categoría 2 (motocicletas de mayor cilindrada)'
  UNION ALL SELECT 'NI-3', 'Nicaragua · Categoría 3'
  UNION ALL SELECT 'NI-4A', 'Nicaragua · Categoría 4A'
  UNION ALL SELECT 'NI-5A', 'Nicaragua · Categoría 5A'
  UNION ALL SELECT 'NI-6A', 'Nicaragua · Categoría 6A'
  UNION ALL SELECT 'CR-A1', 'Costa Rica · Tipo A1 (motocicletas)'
  UNION ALL SELECT 'CR-A2', 'Costa Rica · Tipo A2 (motocicletas)'
  UNION ALL SELECT 'CR-A3', 'Costa Rica · Tipo A3 (motocicletas)'
  UNION ALL SELECT 'CR-B1', 'Costa Rica · Tipo B1'
  UNION ALL SELECT 'CR-B2', 'Costa Rica · Tipo B2'
  UNION ALL SELECT 'CR-B3', 'Costa Rica · Tipo B3'
  UNION ALL SELECT 'CR-B4', 'Costa Rica · Tipo B4'
  UNION ALL SELECT 'PA-A', 'Panamá · Tipo A (motocicletas)'
  UNION ALL SELECT 'PA-B', 'Panamá · Tipo B (motocicletas)'
  UNION ALL SELECT 'PA-C', 'Panamá · Tipo C'
  UNION ALL SELECT 'PA-D', 'Panamá · Tipo D'
  UNION ALL SELECT 'PA-F', 'Panamá · Tipo F'
  UNION ALL SELECT 'PA-G', 'Panamá · Tipo G'
  UNION ALL SELECT 'BZ-A', 'Belice · Class A (motocicletas)'
  UNION ALL SELECT 'BZ-B', 'Belice · Class B'
  UNION ALL SELECT 'BZ-C', 'Belice · Class C'
) d
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_tipos_licencia` t WHERE t.`codigo` = d.`codigo`);

-- Reglas (sin límites de tonelaje ni pasajeros)
INSERT INTO `viaticos_reglas_licencia` (`pais_id`, `tipo_licencia_id`, `tipo_placa_id`)
SELECT p.`id`, tl.`id`, tp.`id` FROM (
  SELECT 'GT' AS `pais`, 'GT-M' AS `licencia`, 'M' AS `placa`
  UNION ALL SELECT 'GT', 'GT-C', 'P'
  UNION ALL SELECT 'GT', 'GT-B', 'P'
  UNION ALL SELECT 'GT', 'GT-B', 'C'
  UNION ALL SELECT 'GT', 'GT-B', 'A'
  UNION ALL SELECT 'GT', 'GT-A', 'P'
  UNION ALL SELECT 'GT', 'GT-A', 'C'
  UNION ALL SELECT 'GT', 'GT-A', 'A'
  UNION ALL SELECT 'SV', 'SV-MOTO', 'M'
  UNION ALL SELECT 'SV', 'SV-PARTICULAR', 'TODAS'
  UNION ALL SELECT 'SV', 'SV-LIVIANA', 'TODAS'
  UNION ALL SELECT 'SV', 'SV-PESADA', 'TODAS'
  UNION ALL SELECT 'SV', 'SV-PESADA-T', 'TODAS'
  UNION ALL SELECT 'HN', 'HN-MOTO', 'M'
  UNION ALL SELECT 'HN', 'HN-B', 'TODAS'
  UNION ALL SELECT 'HN', 'HN-C1', 'TODAS'
  UNION ALL SELECT 'HN', 'HN-C', 'TODAS'
  UNION ALL SELECT 'HN', 'HN-CE', 'TODAS'
  UNION ALL SELECT 'NI', 'NI-1', 'M'
  UNION ALL SELECT 'NI', 'NI-2', 'M'
  UNION ALL SELECT 'NI', 'NI-3', 'TODAS'
  UNION ALL SELECT 'NI', 'NI-4A', 'TODAS'
  UNION ALL SELECT 'NI', 'NI-5A', 'TODAS'
  UNION ALL SELECT 'NI', 'NI-6A', 'TODAS'
  UNION ALL SELECT 'CR', 'CR-A1', 'M'
  UNION ALL SELECT 'CR', 'CR-A2', 'M'
  UNION ALL SELECT 'CR', 'CR-A3', 'M'
  UNION ALL SELECT 'CR', 'CR-B1', 'TODAS'
  UNION ALL SELECT 'CR', 'CR-B2', 'TODAS'
  UNION ALL SELECT 'CR', 'CR-B3', 'TODAS'
  UNION ALL SELECT 'CR', 'CR-B4', 'TODAS'
  UNION ALL SELECT 'PA', 'PA-A', 'M'
  UNION ALL SELECT 'PA', 'PA-B', 'M'
  UNION ALL SELECT 'PA', 'PA-C', 'TODAS'
  UNION ALL SELECT 'PA', 'PA-D', 'TODAS'
  UNION ALL SELECT 'PA', 'PA-F', 'TODAS'
  UNION ALL SELECT 'PA', 'PA-G', 'TODAS'
  UNION ALL SELECT 'BZ', 'BZ-A', 'M'
  UNION ALL SELECT 'BZ', 'BZ-B', 'TODAS'
  UNION ALL SELECT 'BZ', 'BZ-C', 'TODAS'
) d
JOIN `paises` p ON p.`codigo` = d.`pais`
JOIN `viaticos_tipos_licencia` tl ON tl.`codigo` = d.`licencia`
JOIN `viaticos_tipos_placa` tp ON tp.`pais_id` = p.`id` AND tp.`codigo` = d.`placa`
WHERE NOT EXISTS (
  SELECT 1 FROM `viaticos_reglas_licencia` r
  WHERE r.`pais_id` = p.`id` AND r.`tipo_licencia_id` = tl.`id` AND r.`tipo_placa_id` = tp.`id`
);
