-- viaticos_semilla.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Carga lo mínimo para que el módulo «Calculadora de Viáticos» funcione: permisos, rol Piloto y catálogos
--   iniciales. Requiere las tablas de `viaticos_esquema`, que se aplica antes (el ejecutor ordena por nombre).
--
-- Qué agrega:
--   1. Permisos `viaticos.ver`, `viaticos.gestionar`, `viaticos.autorizar`, `viaticos.liquidar` y
--      `viaticos.configurar` (tabla `permisos`).
--   2. El rol Piloto con `viaticos.ver`; Administrador recibe los cinco permisos. Ningún otro rol.
--   3. Monedas, tipos de comida, estados, salvedades, combustibles, niveles, fluidos, elementos del kit,
--      tipos de gasto y de defecto, y los ajustes de archivos.
--   4. Datos de prueba: ubicaciones de Guatemala y 14 tramos desde Mundi Trofeos. El dueño los reemplaza desde
--      Configuración. Si no existe el país con código GT, no se insertan.
--   No se cargan valores de comida, motivos de viaje, tipos de licencia ni de placa, ni reglas de licencia:
--   los carga el dueño en Configuración.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--   Después, los usuarios afectados deben cerrar sesión e iniciar de nuevo para que su token
--   incluya los permisos nuevos.
--
-- Cómo se revierte (solo si hiciera falta; borra los datos cargados):
--   DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id` WHERE p.`modulo` = 'viaticos';
--   DELETE FROM `permisos` WHERE `modulo` = 'viaticos';
--   DELETE FROM `roles` WHERE `nombre` = 'Piloto';
--   Los catálogos se vacían con DROP TABLE de `viaticos_esquema`.

SET NAMES utf8mb4;

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'viaticos.ver', 'Ver Calculadora de Viáticos', 'viaticos', 'Permite acceder al módulo y solicitar sus propios viáticos' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'viaticos.ver');

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'viaticos.gestionar', 'Gestionar viáticos', 'viaticos', 'Permite ver todas las solicitudes de viáticos' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'viaticos.gestionar');

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'viaticos.autorizar', 'Autorizar viáticos', 'viaticos', 'Permite autorizar o rechazar solicitudes de viáticos' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'viaticos.autorizar');

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'viaticos.liquidar', 'Liquidar viáticos', 'viaticos', 'Permite revisar los comprobantes y liquidar viajes de más de un día' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'viaticos.liquidar');

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'viaticos.configurar', 'Configurar viáticos', 'viaticos', 'Permite administrar los catálogos, tramos, vehículos y licencias del módulo' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'viaticos.configurar');

INSERT INTO `roles` (`nombre`, `descripcion`, `activo`)
SELECT 'Piloto', 'Conductor que solicita viáticos', 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `nombre` = 'Piloto');

INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT r.`id`, p.`id` FROM `roles` r
JOIN `permisos` p ON p.`codigo` = 'viaticos.ver'
WHERE r.`nombre` = 'Piloto'
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` rp WHERE rp.`rol_id` = r.`id` AND rp.`permiso_id` = p.`id`);

INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT r.`id`, p.`id` FROM `roles` r
JOIN `permisos` p ON p.`codigo` IN ('viaticos.ver', 'viaticos.gestionar', 'viaticos.autorizar', 'viaticos.liquidar', 'viaticos.configurar')
WHERE r.`nombre` = 'Administrador'
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` rp WHERE rp.`rol_id` = r.`id` AND rp.`permiso_id` = p.`id`);

INSERT INTO `viaticos_monedas` (`codigo`, `nombre`, `simbolo`)
SELECT d.`codigo`, d.`nombre`, d.`simbolo` FROM (
  SELECT 'GTQ' AS `codigo`, 'Quetzal' AS `nombre`, 'Q' AS `simbolo`
  UNION ALL SELECT 'USD', 'Dólar', 'US$'
  UNION ALL SELECT 'HNL', 'Lempira', 'L'
  UNION ALL SELECT 'NIO', 'Córdoba', 'C$'
  UNION ALL SELECT 'CRC', 'Colón', '₡'
  UNION ALL SELECT 'PAB', 'Balboa', 'B/.'
  UNION ALL SELECT 'BZD', 'Dólar beliceño', 'BZ$'
) d
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_monedas` m WHERE m.`codigo` = d.`codigo`);

INSERT INTO `viaticos_tipos_comida` (`nombre`, `orden`)
SELECT d.`nombre`, d.`orden` FROM (
  SELECT 'desayuno' AS `nombre`, 1 AS `orden`
  UNION ALL SELECT 'almuerzo', 2
  UNION ALL SELECT 'cena', 3
) d
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_tipos_comida` t WHERE t.`nombre` = d.`nombre`);

INSERT INTO `viaticos_estados` (`nombre`)
SELECT d.`nombre` FROM (
  SELECT 'esperando autorización' AS `nombre`
  UNION ALL SELECT 'rechazada'
  UNION ALL SELECT 'autorizada'
  UNION ALL SELECT 'liquidada'
) d
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_estados` e WHERE e.`nombre` = d.`nombre`);

INSERT INTO `viaticos_salvedades` (`nombre`, `texto_pdf`)
SELECT d.`nombre`, d.`texto_pdf` FROM (
  SELECT 'licencia' AS `nombre`, 'La licencia vencerá durante el trayecto' AS `texto_pdf`
  UNION ALL SELECT 'tarjeta de circulación', 'La tarjeta de circulación vencerá durante el trayecto'
  UNION ALL SELECT 'seguro', 'El seguro vencerá durante el trayecto'
) d
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_salvedades` s WHERE s.`nombre` = d.`nombre`);

INSERT INTO `viaticos_combustibles` (`nombre`)
SELECT d.`nombre` FROM (
  SELECT 'gasolina' AS `nombre`
  UNION ALL SELECT 'diésel'
) d
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_combustibles` c WHERE c.`nombre` = d.`nombre`);

INSERT INTO `viaticos_niveles` (`nombre`, `orden`, `bajo_la_mitad`)
SELECT d.`nombre`, d.`orden`, d.`bajo_la_mitad` FROM (
  SELECT 'F' AS `nombre`, 1 AS `orden`, 0 AS `bajo_la_mitad`
  UNION ALL SELECT '3/4', 2, 0
  UNION ALL SELECT '1/2', 3, 0
  UNION ALL SELECT '1/4', 4, 1
  UNION ALL SELECT 'E', 5, 1
  UNION ALL SELECT 'N/A', 6, 0
) d
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_niveles` n WHERE n.`nombre` = d.`nombre`);

INSERT INTO `viaticos_fluidos` (`nombre`, `permite_no_aplica`, `orden`)
SELECT d.`nombre`, d.`permite_no_aplica`, d.`orden` FROM (
  SELECT 'combustible' AS `nombre`, 0 AS `permite_no_aplica`, 1 AS `orden`
  UNION ALL SELECT 'aceite del motor', 0, 2
  UNION ALL SELECT 'agua del radiador', 0, 3
  UNION ALL SELECT 'líquido de frenos', 0, 4
  UNION ALL SELECT 'líquido hidráulico', 1, 5
) d
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_fluidos` f WHERE f.`nombre` = d.`nombre`);

INSERT INTO `viaticos_kit_items` (`nombre`, `orden`)
SELECT d.`nombre`, d.`orden` FROM (
  SELECT 'llanta de repuesto' AS `nombre`, 1 AS `orden`
  UNION ALL SELECT 'triquet/gato hidráulico', 2
  UNION ALL SELECT 'triángulo de señalización', 3
  UNION ALL SELECT 'extintor recargado', 4
) d
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_kit_items` k WHERE k.`nombre` = d.`nombre`);

INSERT INTO `viaticos_tipos_gasto` (`nombre`, `es_otros`, `seleccionable_en_gastos`)
SELECT d.`nombre`, d.`es_otros`, d.`seleccionable_en_gastos` FROM (
  SELECT 'Hospedaje' AS `nombre`, 0 AS `es_otros`, 0 AS `seleccionable_en_gastos`
  UNION ALL SELECT 'Combustible', 0, 0
  UNION ALL SELECT 'Peaje', 0, 1
  UNION ALL SELECT 'Parqueo', 0, 1
  UNION ALL SELECT 'Ferry', 0, 1
  UNION ALL SELECT 'Otros', 1, 1
) d
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_tipos_gasto` g WHERE g.`nombre` = d.`nombre`);

INSERT INTO `viaticos_tipos_defecto` (`nombre`, `es_otros`)
SELECT 'Otros', 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_tipos_defecto` WHERE `nombre` = 'Otros');

INSERT INTO `viaticos_ajustes` (`clave`, `valor`, `descripcion`)
SELECT 'tipos_archivo_permitidos', '["image/jpeg","image/png","application/pdf"]',
       'Tipos de archivo permitidos en defectos y comprobantes' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_ajustes` WHERE `clave` = 'tipos_archivo_permitidos');

INSERT INTO `viaticos_ajustes` (`clave`, `valor`, `descripcion`)
SELECT 'max_archivo_mb', '10', 'Tamaño máximo por archivo, en megabytes' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `viaticos_ajustes` WHERE `clave` = 'max_archivo_mb');

INSERT INTO `viaticos_ubicaciones` (`pais_id`, `nombre`)
SELECT p.`id`, d.`nombre` FROM `paises` p
JOIN (
  SELECT 'Mundi Trofeos' AS `nombre`
  UNION ALL SELECT 'TRX Coban'
  UNION ALL SELECT 'TRX Peten'
  UNION ALL SELECT 'TRX Puertos Barrios'
  UNION ALL SELECT 'TRX Chiquimula'
  UNION ALL SELECT 'TRX Jutiapa'
  UNION ALL SELECT 'TRX Zona 3'
  UNION ALL SELECT 'TRX San Juan'
  UNION ALL SELECT 'TRX San Marcos'
  UNION ALL SELECT 'TRX Chimaltenango'
  UNION ALL SELECT 'TRX Escuintla'
  UNION ALL SELECT 'TRX Huehuetenango'
  UNION ALL SELECT 'TRX Mazatenango'
  UNION ALL SELECT 'TRX Villa Nueva'
  UNION ALL SELECT 'TRX Xela'
) d
WHERE p.`codigo` = 'GT'
  AND NOT EXISTS (SELECT 1 FROM `viaticos_ubicaciones` u WHERE u.`pais_id` = p.`id` AND u.`nombre` = d.`nombre`);

INSERT INTO `viaticos_tramos` (`ubicacion_a_id`, `ubicacion_b_id`, `km`, `horas`)
SELECT LEAST(uo.`id`, ud.`id`), GREATEST(uo.`id`, ud.`id`), t.`km`, t.`horas`
FROM (
  SELECT 'Mundi Trofeos' AS `origen`, 'TRX Coban' AS `destino`, 215 AS `km`, 8 AS `horas`
  UNION ALL SELECT 'Mundi Trofeos', 'TRX Peten', 480, 8
  UNION ALL SELECT 'Mundi Trofeos', 'TRX Puertos Barrios', 295, 8
  UNION ALL SELECT 'Mundi Trofeos', 'TRX Chiquimula', 170, 8
  UNION ALL SELECT 'Mundi Trofeos', 'TRX Jutiapa', 120, 8
  UNION ALL SELECT 'Mundi Trofeos', 'TRX Zona 3', 8, 8
  UNION ALL SELECT 'Mundi Trofeos', 'TRX San Juan', 18, 8
  UNION ALL SELECT 'Mundi Trofeos', 'TRX San Marcos', 250, 8
  UNION ALL SELECT 'Mundi Trofeos', 'TRX Chimaltenango', 54, 8
  UNION ALL SELECT 'Mundi Trofeos', 'TRX Escuintla', 60, 8
  UNION ALL SELECT 'Mundi Trofeos', 'TRX Huehuetenango', 265, 8
  UNION ALL SELECT 'Mundi Trofeos', 'TRX Mazatenango', 160, 8
  UNION ALL SELECT 'Mundi Trofeos', 'TRX Villa Nueva', 18, 8
  UNION ALL SELECT 'Mundi Trofeos', 'TRX Xela', 205, 8
) t
JOIN `paises` p ON p.`codigo` = 'GT'
JOIN `viaticos_ubicaciones` uo ON uo.`pais_id` = p.`id` AND uo.`nombre` = t.`origen`
JOIN `viaticos_ubicaciones` ud ON ud.`pais_id` = p.`id` AND ud.`nombre` = t.`destino`
WHERE NOT EXISTS (
  SELECT 1 FROM `viaticos_tramos` x
  WHERE x.`ubicacion_a_id` = LEAST(uo.`id`, ud.`id`) AND x.`ubicacion_b_id` = GREATEST(uo.`id`, ud.`id`)
);
