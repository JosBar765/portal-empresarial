-- 55_viaticos_reglas_licencia.sql
-- Módulo Calculadora de Viáticos: carga los tipos de licencia y las reglas de licencia de Guatemala,
-- El Salvador, Honduras, Nicaragua, Costa Rica y Panamá.
--
-- Qué hace:
--   1. Crea el país Panamá (PA) si no existe.
--   2. Crea los tipos de placa: Guatemala P, C, A, U; en los demás países uno solo («TODAS»), porque
--      allí la licencia no depende de la placa.
--   3. Crea los tipos de licencia con el código prefijado por país (GT-B, HN-B…): el código es único
--      global y varios países repiten letras con significado distinto.
--   4. Crea las reglas (país, licencia, placa) con tonelaje y pasajeros máximos (NULL: sin límite).
--
-- GT-M (motocicletas) queda sin límites en todas las placas, incluida la nueva placa «M» (Motocicleta),
-- para poder registrar motos como vehículo y pedir viáticos. Nicaragua: categorías 1 y 2 (motos) sin
-- límites; no se cargan las agrícolas (categoría 8).
-- No cubre (el modelo no lo expresa): remuneración, ejes, articulado, materiales peligrosos,
-- licencia Profesional ni transporte público. Las licencias de
-- pasajeros sin cifra en la fuente (CR-D1, CR-D3, PA-E1, PA-E3) quedan sin límite.
--
-- Cómo se aplica (idempotente: no duplica ni pisa lo que el dueño editó en Configuración):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Cómo se revierte (solo las filas de esta carga):
--   DELETE FROM `viaticos_tipos_licencia` WHERE `codigo` REGEXP '^(GT|SV|HN|NI|CR|PA)-' AND `id` NOT IN (SELECT `tipo_licencia_id` FROM `viaticos_licencias`);

INSERT INTO `paises` (`codigo`, `nombre`, `codigo_telefono`)
SELECT 'PA', 'Panamá', '+507' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `paises` WHERE `codigo` = 'PA');

-- Tipos de placa
INSERT INTO `viaticos_tipos_placa` (`pais_id`, `codigo`, `nombre`)
SELECT p.`id`, d.`codigo`, d.`nombre` FROM (
  SELECT 'GT' AS `pais`, 'P' AS `codigo`, 'Particular' AS `nombre`
  UNION ALL SELECT 'GT', 'C', 'Comercial'
  UNION ALL SELECT 'GT', 'A', 'Alquiler'
  UNION ALL SELECT 'GT', 'U', 'Urbana'
  UNION ALL SELECT 'GT', 'M', 'Motocicleta'
  UNION ALL SELECT 'SV', 'TODAS', 'Todas las placas'
  UNION ALL SELECT 'HN', 'TODAS', 'Todas las placas'
  UNION ALL SELECT 'NI', 'TODAS', 'Todas las placas'
  UNION ALL SELECT 'CR', 'TODAS', 'Todas las placas'
  UNION ALL SELECT 'PA', 'TODAS', 'Todas las placas'
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
  UNION ALL SELECT 'SV-PARTICULAR', 'El Salvador · Particular'
  UNION ALL SELECT 'SV-LIVIANA', 'El Salvador · Liviana'
  UNION ALL SELECT 'SV-PESADA', 'El Salvador · Pesada'
  UNION ALL SELECT 'SV-PESADA-T', 'El Salvador · Pesada-T'
  UNION ALL SELECT 'HN-B', 'Honduras · Tipo B'
  UNION ALL SELECT 'HN-C1', 'Honduras · Tipo C1'
  UNION ALL SELECT 'HN-C', 'Honduras · Tipo C'
  UNION ALL SELECT 'HN-CE', 'Honduras · Tipo CE'
  UNION ALL SELECT 'HN-D1', 'Honduras · Tipo D1'
  UNION ALL SELECT 'HN-D', 'Honduras · Tipo D'
  UNION ALL SELECT 'NI-1', 'Nicaragua · Categoría 1 (motocicletas de baja cilindrada)'
  UNION ALL SELECT 'NI-2', 'Nicaragua · Categoría 2 (motocicletas de mayor cilindrada)'
  UNION ALL SELECT 'NI-3', 'Nicaragua · Categoría 3'
  UNION ALL SELECT 'NI-4A', 'Nicaragua · Categoría 4A'
  UNION ALL SELECT 'NI-4B', 'Nicaragua · Categoría 4B'
  UNION ALL SELECT 'NI-5A', 'Nicaragua · Categoría 5A'
  UNION ALL SELECT 'NI-5B', 'Nicaragua · Categoría 5B'
  UNION ALL SELECT 'NI-6A', 'Nicaragua · Categoría 6A'
  UNION ALL SELECT 'NI-6B', 'Nicaragua · Categoría 6B'
  UNION ALL SELECT 'NI-7', 'Nicaragua · Categoría 7'
  UNION ALL SELECT 'CR-B1', 'Costa Rica · Tipo B1'
  UNION ALL SELECT 'CR-B2', 'Costa Rica · Tipo B2'
  UNION ALL SELECT 'CR-B3', 'Costa Rica · Tipo B3'
  UNION ALL SELECT 'CR-B4', 'Costa Rica · Tipo B4'
  UNION ALL SELECT 'CR-D1', 'Costa Rica · Tipo D1'
  UNION ALL SELECT 'CR-D2', 'Costa Rica · Tipo D2'
  UNION ALL SELECT 'CR-D3', 'Costa Rica · Tipo D3'
  UNION ALL SELECT 'PA-C', 'Panamá · Tipo C'
  UNION ALL SELECT 'PA-D', 'Panamá · Tipo D'
  UNION ALL SELECT 'PA-F', 'Panamá · Tipo F'
  UNION ALL SELECT 'PA-G', 'Panamá · Tipo G'
  UNION ALL SELECT 'PA-H', 'Panamá · Tipo H'
  UNION ALL SELECT 'PA-E1', 'Panamá · Tipo E1'
  UNION ALL SELECT 'PA-E2', 'Panamá · Tipo E2'
  UNION ALL SELECT 'PA-E3', 'Panamá · Tipo E3'
) d
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_tipos_licencia` t WHERE t.`codigo` = d.`codigo`);

-- Reglas: placa NULL en la fuente = la placa única del país («TODAS»); en Guatemala se indica P, C, A o U.
INSERT INTO `viaticos_reglas_licencia` (`pais_id`, `tipo_licencia_id`, `tipo_placa_id`, `tonelaje_max`, `pasajeros_max`)
SELECT p.`id`, tl.`id`, tp.`id`, d.`tonelaje_max`, d.`pasajeros_max` FROM (
  SELECT 'GT' AS `pais`, 'GT-M' AS `licencia`, 'P' AS `placa`, NULL AS `tonelaje_max`, NULL AS `pasajeros_max`
  UNION ALL SELECT 'GT', 'GT-M', 'C', NULL, NULL
  UNION ALL SELECT 'GT', 'GT-M', 'A', NULL, NULL
  UNION ALL SELECT 'GT', 'GT-M', 'U', NULL, NULL
  UNION ALL SELECT 'GT', 'GT-M', 'M', NULL, NULL
  UNION ALL SELECT 'GT', 'GT-C', 'P', 3.50, NULL
  UNION ALL SELECT 'GT', 'GT-B', 'P', 3.50, NULL
  UNION ALL SELECT 'GT', 'GT-B', 'C', 3.50, NULL
  UNION ALL SELECT 'GT', 'GT-B', 'A', 3.50, NULL
  UNION ALL SELECT 'GT', 'GT-A', 'P', NULL, NULL
  UNION ALL SELECT 'GT', 'GT-A', 'C', NULL, NULL
  UNION ALL SELECT 'GT', 'GT-A', 'A', NULL, NULL
  UNION ALL SELECT 'GT', 'GT-A', 'U', NULL, NULL
  UNION ALL SELECT 'SV', 'SV-PARTICULAR', 'TODAS', 3.50, NULL
  UNION ALL SELECT 'SV', 'SV-LIVIANA', 'TODAS', 5.00, 30
  UNION ALL SELECT 'SV', 'SV-PESADA', 'TODAS', NULL, NULL
  UNION ALL SELECT 'SV', 'SV-PESADA-T', 'TODAS', NULL, NULL
  UNION ALL SELECT 'HN', 'HN-B', 'TODAS', 3.50, 8
  UNION ALL SELECT 'HN', 'HN-C1', 'TODAS', 7.50, NULL
  UNION ALL SELECT 'HN', 'HN-C', 'TODAS', NULL, NULL
  UNION ALL SELECT 'HN', 'HN-CE', 'TODAS', NULL, NULL
  UNION ALL SELECT 'HN', 'HN-D1', 'TODAS', NULL, 25
  UNION ALL SELECT 'HN', 'HN-D', 'TODAS', NULL, NULL
  UNION ALL SELECT 'NI', 'NI-1', 'TODAS', NULL, NULL
  UNION ALL SELECT 'NI', 'NI-2', 'TODAS', NULL, NULL
  UNION ALL SELECT 'NI', 'NI-3', 'TODAS', 3.50, 9
  UNION ALL SELECT 'NI', 'NI-4A', 'TODAS', 8.00, NULL
  UNION ALL SELECT 'NI', 'NI-4B', 'TODAS', NULL, 18
  UNION ALL SELECT 'NI', 'NI-5A', 'TODAS', 12.00, NULL
  UNION ALL SELECT 'NI', 'NI-5B', 'TODAS', NULL, 25
  UNION ALL SELECT 'NI', 'NI-6A', 'TODAS', 18.00, NULL
  UNION ALL SELECT 'NI', 'NI-6B', 'TODAS', NULL, NULL
  UNION ALL SELECT 'NI', 'NI-7', 'TODAS', NULL, NULL
  UNION ALL SELECT 'CR', 'CR-B1', 'TODAS', 4.00, NULL
  UNION ALL SELECT 'CR', 'CR-B2', 'TODAS', 8.00, NULL
  UNION ALL SELECT 'CR', 'CR-B3', 'TODAS', 16.00, NULL
  UNION ALL SELECT 'CR', 'CR-B4', 'TODAS', NULL, NULL
  UNION ALL SELECT 'CR', 'CR-D1', 'TODAS', NULL, NULL
  UNION ALL SELECT 'CR', 'CR-D2', 'TODAS', NULL, 24
  UNION ALL SELECT 'CR', 'CR-D3', 'TODAS', NULL, NULL
  UNION ALL SELECT 'PA', 'PA-C', 'TODAS', NULL, 9
  UNION ALL SELECT 'PA', 'PA-D', 'TODAS', 8.00, NULL
  UNION ALL SELECT 'PA', 'PA-F', 'TODAS', NULL, NULL
  UNION ALL SELECT 'PA', 'PA-G', 'TODAS', NULL, NULL
  UNION ALL SELECT 'PA', 'PA-H', 'TODAS', NULL, NULL
  UNION ALL SELECT 'PA', 'PA-E1', 'TODAS', NULL, NULL
  UNION ALL SELECT 'PA', 'PA-E2', 'TODAS', NULL, 16
  UNION ALL SELECT 'PA', 'PA-E3', 'TODAS', NULL, NULL
) d
JOIN `paises` p ON p.`codigo` = d.`pais`
JOIN `viaticos_tipos_licencia` tl ON tl.`codigo` = d.`licencia`
JOIN `viaticos_tipos_placa` tp ON tp.`pais_id` = p.`id` AND tp.`codigo` = d.`placa`
WHERE NOT EXISTS (
  SELECT 1 FROM `viaticos_reglas_licencia` r
  WHERE r.`pais_id` = p.`id` AND r.`tipo_licencia_id` = tl.`id` AND r.`tipo_placa_id` = tp.`id`
);
