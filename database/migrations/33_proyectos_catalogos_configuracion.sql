-- proyectos_catalogos_configuracion.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Qué agrega (módulo «Proyectos», parte 1 de 3):
--   1. Catálogos del módulo: nichos, artículos, áreas de contacto, canales, resultados de gestión,
--      motivos de pérdida, monedas, estructuras de empresa y configuración por país.
--   2. Tablas de configuración del administrador: plantillas y sus etapas, campos propios, alcance de
--      usuarios por país, avisos, kits de nicho e historial de cambios.
--   3. Permisos `proyectos.*` (tabla `permisos`), SIN asignar a ningún rol: se asignan desde la
--      pantalla Roles al activar el módulo.
--   4. Semillas editables por el administrador: 17 nichos, 3 artículos, 7 áreas, 4 canales,
--      8 resultados, 6 motivos, 5 monedas, 3 estructuras, configuración de los 6 países,
--      la plantilla «Proyecto mensual estándar» y el campo «¿Ya es cliente de Premia?».
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--
-- Reversa (solo si hace falta deshacerlo; borra los datos cargados):
--   DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id` WHERE p.`modulo` = 'proyectos';
--   DELETE FROM `permisos` WHERE `modulo` = 'proyectos';
--   Después, DROP TABLE IF EXISTS en orden inverso al de creación de este script.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `proy_nichos` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`      VARCHAR(100) NOT NULL UNIQUE,
  `descripcion` VARCHAR(255) DEFAULT NULL,
  `activo`      TINYINT(1) NOT NULL DEFAULT 1,
  `orden`       INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_articulos` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`      VARCHAR(100) NOT NULL UNIQUE,
  `descripcion` VARCHAR(255) DEFAULT NULL,
  `activo`      TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_areas_contacto` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL UNIQUE,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `orden`  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_canales` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`     VARCHAR(100) NOT NULL UNIQUE,
  `presencial` TINYINT(1) NOT NULL DEFAULT 0,
  `activo`     TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `efecto_estado` solo sube el estado de la participación hasta `interesada`; nunca lo baja.
CREATE TABLE IF NOT EXISTS `proy_resultados_gestion` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`           VARCHAR(100) NOT NULL UNIQUE,
  `contacto_logrado` TINYINT(1) NOT NULL DEFAULT 0,
  `requiere_proxima` TINYINT(1) NOT NULL DEFAULT 0,
  `efecto_estado`    VARCHAR(20) NOT NULL DEFAULT 'ninguno',
  `activo`           TINYINT(1) NOT NULL DEFAULT 1,
  `orden`            INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_motivos_perdida` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL UNIQUE,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `orden`  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_monedas` (
  `codigo`  VARCHAR(3)  NOT NULL PRIMARY KEY,
  `nombre`  VARCHAR(50) NOT NULL,
  `simbolo` VARCHAR(5)  NOT NULL,
  `activa`  TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_estructuras` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL UNIQUE,
  `activa` TINYINT(1) NOT NULL DEFAULT 1,
  `orden`  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `confirmacion_ventas` NULL = usa el valor global.
CREATE TABLE IF NOT EXISTS `proy_pais_config` (
  `pais_id`                INT NOT NULL PRIMARY KEY,
  `moneda_codigo`          VARCHAR(3) DEFAULT NULL,
  `prefijo_telefono`       VARCHAR(5) DEFAULT NULL,
  `formato_telefono`       VARCHAR(30) DEFAULT NULL,
  `referencia_obligatoria` TINYINT(1) NOT NULL DEFAULT 1,
  `confirmacion_ventas`    TINYINT(1) DEFAULT NULL,
  FOREIGN KEY (`pais_id`)       REFERENCES `paises` (`id`),
  FOREIGN KEY (`moneda_codigo`) REFERENCES `proy_monedas` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `controles` indica por campo si el supervisor puede editarlo: editable | bloqueado | obligatorio.
CREATE TABLE IF NOT EXISTS `proy_plantillas` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`              VARCHAR(100) NOT NULL UNIQUE,
  `descripcion`         VARCHAR(255) DEFAULT NULL,
  `activa`              TINYINT(1) NOT NULL DEFAULT 1,
  `predeterminada`      TINYINT(1) NOT NULL DEFAULT 0,
  `duracion_semanas`    INT NOT NULL DEFAULT 4,
  `articulo_id`         INT DEFAULT NULL,
  `existencia_sugerida` INT DEFAULT NULL,
  `tope_por_asesor`     INT DEFAULT NULL,
  `meta_monto`          DECIMAL(12,2) DEFAULT NULL,
  `meta_moneda`         VARCHAR(3) DEFAULT NULL,
  `controles`           JSON DEFAULT NULL,
  FOREIGN KEY (`articulo_id`)  REFERENCES `proy_articulos` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`meta_moneda`)  REFERENCES `proy_monedas` (`codigo`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_plantilla_etapas` (
  `id`                    INT AUTO_INCREMENT PRIMARY KEY,
  `plantilla_id`          INT NOT NULL,
  `orden`                 INT NOT NULL,
  `nombre`                VARCHAR(100) NOT NULL,
  `descripcion`           VARCHAR(255) DEFAULT NULL,
  `duracion_dias_habiles` INT NOT NULL DEFAULT 5,
  UNIQUE KEY `uq_proy_plantilla_etapa` (`plantilla_id`, `orden`),
  FOREIGN KEY (`plantilla_id`) REFERENCES `proy_plantillas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `nicho_id` NULL = el campo aplica a todos los nichos. `tipo`: texto | numero | lista | si_no | fecha.
CREATE TABLE IF NOT EXISTS `proy_campos` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `nicho_id`         INT DEFAULT NULL,
  `clave`            VARCHAR(60)  NOT NULL UNIQUE,
  `etiqueta`         VARCHAR(100) NOT NULL,
  `tipo`             VARCHAR(20)  NOT NULL,
  `opciones`         JSON DEFAULT NULL,
  `obligatorio`      TINYINT(1) NOT NULL DEFAULT 0,
  `visible_en_lista` TINYINT(1) NOT NULL DEFAULT 0,
  `orden`            INT NOT NULL DEFAULT 0,
  `activo`           TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`nicho_id`) REFERENCES `proy_nichos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Solo guarda excepciones al país de la tienda del usuario. `accion`: agregar | quitar.
CREATE TABLE IF NOT EXISTS `proy_usuario_paises` (
  `usuario_id`  INT NOT NULL,
  `pais_id`     INT NOT NULL,
  `accion`      VARCHAR(10) NOT NULL,
  `creado_por`  INT NOT NULL,
  `creado_en`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`usuario_id`, `pais_id`),
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`pais_id`)    REFERENCES `paises` (`id`),
  FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Una fila solo cambia el valor por defecto del registro de eventos del módulo.
CREATE TABLE IF NOT EXISTS `proy_notificaciones_config` (
  `evento`             VARCHAR(60) NOT NULL,
  `destinatario`       VARCHAR(30) NOT NULL,
  `activo`             TINYINT(1) NOT NULL DEFAULT 1,
  `anticipacion_horas` INT DEFAULT NULL,
  PRIMARY KEY (`evento`, `destinatario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_kits` (
  `id`       INT AUTO_INCREMENT PRIMARY KEY,
  `nicho_id` INT NOT NULL UNIQUE,
  `guion`    TEXT DEFAULT NULL,
  `activo`   TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`nicho_id`) REFERENCES `proy_nichos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_kit_mensajes` (
  `id`        INT AUTO_INCREMENT PRIMARY KEY,
  `kit_id`    INT NOT NULL,
  `canal_id`  INT NOT NULL,
  `titulo`    VARCHAR(100) NOT NULL,
  `texto`     TEXT NOT NULL,
  `activo`    TINYINT(1) NOT NULL DEFAULT 1,
  `orden`     INT NOT NULL DEFAULT 0,
  FOREIGN KEY (`kit_id`)   REFERENCES `proy_kits` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`canal_id`) REFERENCES `proy_canales` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proy_config_historial` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `entidad`    VARCHAR(40) NOT NULL,
  `clave`      VARCHAR(100) NOT NULL,
  `accion`     VARCHAR(20) NOT NULL,
  `antes`      JSON DEFAULT NULL,
  `despues`    JSON DEFAULT NULL,
  `creado_en`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  INDEX `idx_proy_config_historial` (`creado_en`, `entidad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permisos sin rol asignado: nadie ve el módulo hasta asignarlos desde la pantalla Roles.
INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT n.`codigo`, n.`nombre`, 'proyectos', n.`descripcion`
FROM (
  SELECT 'proyectos.ver' AS `codigo`, 'Ver Proyectos' AS `nombre`, 'Permite entrar al módulo Proyectos' AS `descripcion`
  UNION ALL SELECT 'proyectos.clientes.registrar', 'Registrar empresas', 'Permite crear y editar empresas y contactos'
  UNION ALL SELECT 'proyectos.clientes.importar', 'Importar empresas', 'Permite importar listas de empresas desde CSV'
  UNION ALL SELECT 'proyectos.gestionar', 'Gestionar empresas asignadas', 'Permite gestionar las empresas asignadas: gestiones, muestras, cotizaciones y ventas'
  UNION ALL SELECT 'proyectos.activar', 'Crear y activar proyectos', 'Permite crear, activar, cancelar y cerrar proyectos'
  UNION ALL SELECT 'proyectos.reasignar', 'Reasignar empresas', 'Permite pasar empresas de un asesor a otro'
  UNION ALL SELECT 'proyectos.supervisar', 'Supervisar el avance', 'Permite ver el avance del equipo'
  UNION ALL SELECT 'proyectos.ver_gerencia', 'Ver Proyectos como gerencia', 'Permite ver todos los proyectos en solo lectura'
  UNION ALL SELECT 'proyectos.dar_visto_bueno', 'Dar visto bueno al cierre', 'Permite dar o devolver el visto bueno al cierre de un proyecto'
  UNION ALL SELECT 'proyectos.ver_reportes', 'Ver informes de Proyectos', 'Permite ver y exportar informes en PDF'
  UNION ALL SELECT 'proyectos.corregir', 'Corregir registros', 'Permite anular una cotización, venta o gestión equivocada y reabrir una participación'
  UNION ALL SELECT 'proyectos.aprobar_activacion', 'Aprobar la activación', 'Permite aprobar o rechazar la activación de un proyecto'
  UNION ALL SELECT 'proyectos.confirmar_ventas', 'Confirmar ventas', 'Permite confirmar o rechazar ventas por confirmar'
  UNION ALL SELECT 'proyectos.administrar', 'Administrar Proyectos', 'Permite usar todo el centro de configuración del módulo'
) n
WHERE NOT EXISTS (SELECT 1 FROM `permisos` p WHERE p.`codigo` = n.`codigo`);

INSERT INTO `proy_nichos` (`nombre`, `orden`)
SELECT n.`nombre`, n.`orden`
FROM (
  SELECT 'Colegios' AS `nombre`, 1 AS `orden`
  UNION ALL SELECT 'Municipalidades', 2
  UNION ALL SELECT 'Iglesias', 3
  UNION ALL SELECT 'Gasolineras', 4
  UNION ALL SELECT 'Canchas deportivas', 5
  UNION ALL SELECT 'Bancos y cooperativas', 6
  UNION ALL SELECT 'Universidades', 7
  UNION ALL SELECT 'Gimnasios', 8
  UNION ALL SELECT 'Medios de comunicación', 9
  UNION ALL SELECT 'Hostales y hoteles', 10
  UNION ALL SELECT 'Estaciones de bomberos y policía', 11
  UNION ALL SELECT 'Serigrafías', 12
  UNION ALL SELECT 'Funerarias y cementerios', 13
  UNION ALL SELECT 'Librerías', 14
  UNION ALL SELECT 'Restaurantes', 15
  UNION ALL SELECT 'Hospitales', 16
  UNION ALL SELECT 'Farmacias', 17
) n
WHERE NOT EXISTS (SELECT 1 FROM `proy_nichos` x WHERE x.`nombre` = n.`nombre`);

INSERT INTO `proy_articulos` (`nombre`)
SELECT n.`nombre`
FROM (SELECT 'Medalla' AS `nombre` UNION ALL SELECT 'Llavero' UNION ALL SELECT 'Posavasos') n
WHERE NOT EXISTS (SELECT 1 FROM `proy_articulos` x WHERE x.`nombre` = n.`nombre`);

INSERT INTO `proy_areas_contacto` (`nombre`, `orden`)
SELECT n.`nombre`, n.`orden`
FROM (
  SELECT 'Gerencia general' AS `nombre`, 1 AS `orden`
  UNION ALL SELECT 'Mercadeo', 2
  UNION ALL SELECT 'Compras', 3
  UNION ALL SELECT 'Recursos humanos', 4
  UNION ALL SELECT 'Recepción', 5
  UNION ALL SELECT 'Ventas', 6
  UNION ALL SELECT 'Otra', 7
) n
WHERE NOT EXISTS (SELECT 1 FROM `proy_areas_contacto` x WHERE x.`nombre` = n.`nombre`);

INSERT INTO `proy_canales` (`nombre`, `presencial`)
SELECT n.`nombre`, n.`presencial`
FROM (
  SELECT 'Llamada' AS `nombre`, 0 AS `presencial`
  UNION ALL SELECT 'WhatsApp', 0
  UNION ALL SELECT 'Visita', 1
  UNION ALL SELECT 'Correo', 0
) n
WHERE NOT EXISTS (SELECT 1 FROM `proy_canales` x WHERE x.`nombre` = n.`nombre`);

INSERT INTO `proy_resultados_gestion` (`nombre`, `contacto_logrado`, `requiere_proxima`, `efecto_estado`, `orden`)
SELECT n.`nombre`, n.`contacto_logrado`, n.`requiere_proxima`, n.`efecto_estado`, n.`orden`
FROM (
  SELECT 'Sin respuesta' AS `nombre`, 0 AS `contacto_logrado`, 1 AS `requiere_proxima`, 'ninguno' AS `efecto_estado`, 1 AS `orden`
  UNION ALL SELECT 'Número equivocado', 0, 0, 'ninguno', 2
  UNION ALL SELECT 'Pide volver a llamar', 1, 1, 'en_gestion', 3
  UNION ALL SELECT 'Reunión o visita agendada', 1, 1, 'interesada', 4
  UNION ALL SELECT 'Pide cotización', 1, 0, 'interesada', 5
  UNION ALL SELECT 'Pide muestra', 1, 1, 'interesada', 6
  UNION ALL SELECT 'No le interesa por ahora', 1, 0, 'en_gestion', 7
  UNION ALL SELECT 'Muestra entregada', 1, 1, 'en_gestion', 8
) n
WHERE NOT EXISTS (SELECT 1 FROM `proy_resultados_gestion` x WHERE x.`nombre` = n.`nombre`);

INSERT INTO `proy_motivos_perdida` (`nombre`, `orden`)
SELECT n.`nombre`, n.`orden`
FROM (
  SELECT 'Precio muy alto' AS `nombre`, 1 AS `orden`
  UNION ALL SELECT 'Ya tiene proveedor', 2
  UNION ALL SELECT 'Sin presupuesto', 3
  UNION ALL SELECT 'No le interesa', 4
  UNION ALL SELECT 'No respondió', 5
  UNION ALL SELECT 'Otro', 6
) n
WHERE NOT EXISTS (SELECT 1 FROM `proy_motivos_perdida` x WHERE x.`nombre` = n.`nombre`);

INSERT INTO `proy_monedas` (`codigo`, `nombre`, `simbolo`)
SELECT n.`codigo`, n.`nombre`, n.`simbolo`
FROM (
  SELECT 'GTQ' AS `codigo`, 'Quetzal' AS `nombre`, 'Q' AS `simbolo`
  UNION ALL SELECT 'USD', 'Dólar', 'US$'
  UNION ALL SELECT 'HNL', 'Lempira', 'L'
  UNION ALL SELECT 'NIO', 'Córdoba', 'C$'
  UNION ALL SELECT 'CRC', 'Colón', '₡'
) n
WHERE NOT EXISTS (SELECT 1 FROM `proy_monedas` x WHERE x.`codigo` = n.`codigo`);

INSERT INTO `proy_estructuras` (`nombre`, `orden`)
SELECT n.`nombre`, n.`orden`
FROM (
  SELECT 'Una empresa' AS `nombre`, 1 AS `orden`
  UNION ALL SELECT 'Varias empresas', 2
  UNION ALL SELECT 'Varias sucursales', 3
) n
WHERE NOT EXISTS (SELECT 1 FROM `proy_estructuras` x WHERE x.`nombre` = n.`nombre`);

-- Se busca el país por código, no por id. Honduras confirma ventas; Belice no tiene moneda local todavía.
INSERT INTO `proy_pais_config` (`pais_id`, `moneda_codigo`, `prefijo_telefono`, `formato_telefono`, `confirmacion_ventas`)
SELECT p.`id`, n.`moneda`, n.`prefijo`, n.`formato`, n.`confirmacion`
FROM (
  SELECT 'GT' AS `codigo`, 'GTQ' AS `moneda`, '+502' AS `prefijo`, '#### ####' AS `formato`, NULL AS `confirmacion`
  UNION ALL SELECT 'SV', 'USD', '+503', '#### ####', NULL
  UNION ALL SELECT 'HN', 'HNL', '+504', '#### ####', 1
  UNION ALL SELECT 'NI', 'NIO', '+505', '#### ####', NULL
  UNION ALL SELECT 'CR', 'CRC', '+506', '#### ####', NULL
  UNION ALL SELECT 'BZ', NULL, '+501', '### ####', NULL
) n
JOIN `paises` p ON p.`codigo` = n.`codigo`
WHERE NOT EXISTS (SELECT 1 FROM `proy_pais_config` x WHERE x.`pais_id` = p.`id`);

INSERT INTO `proy_plantillas` (`nombre`, `descripcion`, `predeterminada`, `duracion_semanas`, `controles`)
SELECT 'Proyecto mensual estándar', 'Cuatro semanas: preparación, contacto, seguimiento y cierre.', 1, 4,
       JSON_OBJECT('articulo', 'editable', 'existencia', 'editable', 'meta', 'editable', 'tope', 'editable', 'fechas_etapas', 'editable')
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `proy_plantillas` WHERE `nombre` = 'Proyecto mensual estándar');

INSERT INTO `proy_plantilla_etapas` (`plantilla_id`, `orden`, `nombre`, `descripcion`, `duracion_dias_habiles`)
SELECT pl.`id`, n.`orden`, n.`nombre`, n.`descripcion`, 5
FROM (
  SELECT 1 AS `orden`, 'Preparación' AS `nombre`, 'Depurar contactos, revisar guion y muestras' AS `descripcion`
  UNION ALL SELECT 2, 'Contacto', 'Primer contacto a todas las empresas y entrega de muestras'
  UNION ALL SELECT 3, 'Seguimiento', 'Seguimiento de contactos, cotizaciones a interesadas'
  UNION ALL SELECT 4, 'Cierre', 'Cerrar ventas, registrar motivos de pérdida y entregar conclusiones'
) n
JOIN `proy_plantillas` pl ON pl.`nombre` = 'Proyecto mensual estándar'
WHERE NOT EXISTS (SELECT 1 FROM `proy_plantilla_etapas` e WHERE e.`plantilla_id` = pl.`id` AND e.`orden` = n.`orden`);

INSERT INTO `proy_campos` (`nicho_id`, `clave`, `etiqueta`, `tipo`, `orden`)
SELECT NULL, 'ya_es_cliente', '¿Ya es cliente de Premia?', 'si_no', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `proy_campos` WHERE `clave` = 'ya_es_cliente');
