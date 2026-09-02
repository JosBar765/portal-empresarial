-- =========================================================================
-- Schema: Portal Web de Herramientas Empresariales — MundiTrofeos S.A.
-- Motor: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------------------
-- 1. Catálogo de Países
-- -------------------------------------------------------------------------
-- analisis_correcciones_12.md #12: se quitaron `moneda_codigo`/`moneda_simbolo`
-- — se sembraban pero ninguna consulta los seleccionaba jamás (la cotización
-- del vale siempre se muestra en Quetzales, sin importar el país de la tienda).
CREATE TABLE IF NOT EXISTS `paises` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`          VARCHAR(2)   NOT NULL UNIQUE COMMENT 'Código ISO (GT, SV, HN, NI, CR, BZ)',
  `nombre`          VARCHAR(100) NOT NULL,
  `codigo_telefono` VARCHAR(5)  DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 2. Roles
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`         VARCHAR(50)  NOT NULL UNIQUE,
  `descripcion`    VARCHAR(255) DEFAULT NULL,
  -- analisis_correcciones_14.md #5: "eliminar" un rol ahora es desactivarlo,
  -- nunca un DELETE físico (mismo criterio que `usuarios.activo`) — un rol
  -- desactivado se sigue listando (en gris) para poder reactivarlo.
  `activo`         TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 3. Permisos (Control de acceso a nivel de módulos y acciones)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `permisos` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`      VARCHAR(100) NOT NULL UNIQUE COMMENT 'Ej: vales.ver, admin.ver',
  `nombre`      VARCHAR(100) NOT NULL,
  `modulo`      VARCHAR(50)  NOT NULL COMMENT 'Asociado al módulo (vales, admin)',
  `descripcion` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 4. Pivot Rol ↔ Permiso
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `rol_permisos` (
  `rol_id`     INT NOT NULL,
  `permiso_id` INT NOT NULL,
  PRIMARY KEY (`rol_id`, `permiso_id`),
  FOREIGN KEY (`rol_id`)     REFERENCES `roles`    (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`permiso_id`) REFERENCES `permisos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 5. Usuarios
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`            VARCHAR(150) NOT NULL,
  `email`             VARCHAR(150) NOT NULL UNIQUE,
  `telefono`          VARCHAR(30)  DEFAULT NULL,
  `password_hash`     VARCHAR(255) NOT NULL,
  `rol_id`            INT NOT NULL,
  `tienda_id`         INT          DEFAULT NULL COMMENT 'Tienda base del usuario (usada para el correlativo de vales y, para un asesor, para resolver su(s) supervisor(es) vía departamento/subdivisión — analisis_correcciones_12.md #10)',
  `encargado_id`      INT          DEFAULT NULL COMMENT 'Auto-referencia: encargado de taller al mando de este técnico. Desde analisis_correcciones_12.md #10, YA NO se usa para asesor -> supervisor (esa relación es dinámica, vía tienda_id + supervisor_asignaciones); en asesores queda NULL.',
  `activo`            TINYINT(1)   NOT NULL DEFAULT 1,
  `intentos_fallidos` INT          NOT NULL DEFAULT 0,
  `bloqueado_hasta`   DATETIME     DEFAULT NULL,
  -- analisis_correcciones_13.md #6 (Vista Administrador, pestaña "Actividad de
  -- Usuarios"): rastro de presencia. `sesion_iniciada_en` se sella en el login
  -- y se limpia en el logout; `ultima_actividad_en` se refresca desde un
  -- middleware liviano (throttleado) en cada request autenticado.
  `sesion_iniciada_en`  DATETIME     DEFAULT NULL,
  `ultima_actividad_en` DATETIME     DEFAULT NULL,
  `ultima_ip`           VARCHAR(45)  DEFAULT NULL,
  `ultima_ciudad`       VARCHAR(100) DEFAULT NULL,
  `creado_en`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`encargado_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_usuarios_email` (`email`),
  INDEX `idx_usuarios_encargado` (`encargado_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 6. Datos de Semilla (Seeds iniciales)
-- -------------------------------------------------------------------------

-- Países
INSERT INTO `paises` (`codigo`, `nombre`, `codigo_telefono`) VALUES
('GT', 'Guatemala', '+502'),
('SV', 'El Salvador', '+503'),
('HN', 'Honduras', '+504'),
('NI', 'Nicaragua', '+505'),
('CR', 'Costa Rica', '+506'),
('BZ', 'Belice', '+501');

-- Roles
-- analisis_correcciones_12.md #3: descripciones en términos de la FUNCIÓN de la
-- persona, no del flujo de un módulo en particular — antes narraban el flujo de
-- Vales de Arte ("Asigna vales de arte a técnicos..."), lo que envejece mal al
-- sumar más módulos al portal.
-- analisis_correcciones_14.md #14: atomización de roles de encargado — se
-- retiran "Diseñador" (2, legacy) y "Encargado General" (8, ya descontinuado
-- desde correcciones #12 #11) desactivándolos (activo = 0), nunca borrándolos
-- (usuarios con historial los referencian). Los encargados 5/6/9/11 se
-- renombran para reflejar mejor su taller; se agrega el rol 12 nuevo para
-- separar "Diseño Local" (antes compartía el 11 genérico con Protextil).
INSERT INTO `roles` (`id`, `nombre`, `descripcion`, `activo`) VALUES
(1, 'Administrador', 'Acceso total a todos los módulos y configuraciones del portal', 1),
(2, 'Diseñador', 'ROL DESCONTINUADO (analisis_correcciones_14.md #14) — Diseñador gráfico legacy, reemplazado por los roles atomizados de encargado/técnico', 0),
(3, 'Asesor de Ventas', 'Asesor de ventas, encargado de atender clientes y gestionar ventas', 1),
(4, 'Supervisor de Ventas', 'Supervisor de ventas, encargado de supervisar al equipo comercial', 1),
(5, 'Encargado de taller de diseño', 'Encargado del taller de Diseño, responsable de coordinar y fusionar el trabajo del equipo de diseño', 1),
(6, 'Encargado de taller de diseño 3d', 'Encargado del taller de Diseño UV/3D, responsable de coordinar al equipo de diseño UV/3D', 1),
(7, 'Técnicos', 'Técnico, encargado de ejecutar el trabajo de diseño y producción asignado', 1),
-- analisis_correcciones_12.md #11: rol DESCONTINUADO — "el encargado general no
-- existe" (regla de negocio explícita). Se conserva la fila (nunca se borra un
-- rol/usuario con historial referenciado, mismo criterio que usuarios.encargado_id
-- en la Fase 2a) pero sin permisos (ver rol_permisos) y con su usuario semilla
-- desactivado (usuarios.activo = 0, id 10) — no debe poder asignarse a nadie más.
(8, 'Encargado General', 'ROL DESCONTINUADO (analisis_correcciones_12.md #11) — la fusión de vales multi-taller ahora es un permiso atómico del Encargado de Diseño', 0),
-- Recicla el rol 9: clon operativo completo del Encargado de Diseño (mismos
-- permisos atómicos), en vez de un rol propio de "encargado general".
(9, 'Asistente', 'Asistente del Encargado de taller de diseño, con las mismas responsabilidades de coordinación y fusión', 1),
(10, 'Gerente', 'Gerente, encargado de supervisar la operación general y sus métricas', 1),
-- analisis_correcciones_14.md #14: pasa a significar SOLO Protextil — "Diseño
-- Local" se separa al rol 12 nuevo.
(11, 'Encargado de taller de protextil', 'Encargado del taller de Protextil, responsable de asignar técnicos y revisar sus propuestas', 1),
(12, 'Encargado de taller de diseño local', 'Encargado de un taller de Diseño Local (por tienda), responsable de asignar técnicos y revisar sus propuestas', 1);

-- Permisos. analisis_correcciones_15.md #9: se eliminaron los permisos MOCK de
-- los módulos "prompts"/"eventos" (ids 4-7) — no existe ningún
-- src/modules/prompts|eventos ni public/modules/prompts|eventos, eran datos de
-- ejemplo sin módulo real detrás. Solo quedan los dos módulos reales: vales y admin.
INSERT INTO `permisos` (`id`, `codigo`, `nombre`, `modulo`, `descripcion`) VALUES
-- Vales
(1, 'vales.ver', 'Ver Vales de Arte', 'vales', 'Permite visualizar la lista/buzón de vales de arte'),
(2, 'vales.crear', 'Crear Vales de Arte', 'vales', 'Permite ingresar nuevos vales de arte'),
(3, 'vales.editar', 'Editar Vales de Arte', 'vales', 'Permite modificar el contenido de un vale de arte (formulario de modificación)'),
(9, 'vales.asignar', 'Asignar Vales de Arte', 'vales', 'Permite asignar/reasignar un vale de arte a un técnico'),
(10, 'vales.revisar', 'Revisar Propuestas', 'vales', 'Permite aprobar o desaprobar la propuesta de un técnico'),
(11, 'vales.trabajar', 'Trabajar Vales de Arte', 'vales', 'Permite a un técnico comenzar, entregar o cancelar un vale asignado'),
(12, 'vales.confirmar', 'Confirmar o Cancelar Venta', 'vales', 'Permite al asesor confirmar la venta o cancelar un vale de arte'),
(13, 'vales.solicitar_modificacion', 'Solicitar Modificación', 'vales', 'Permite al asesor solicitar la modificación de un vale de arte'),
(14, 'vales.aprobar_modificacion', 'Aprobar Modificación', 'vales', 'Permite al supervisor autorizar una modificación solicitada'),
(15, 'vales.supervisar', 'Supervisar Vales de Arte', 'vales', 'Acceso de solo lectura al panel de supervisión de vales de arte'),
(16, 'vales.aprobar_general', 'Aprobar y Fusionar (Multi-taller)', 'vales', 'Permite al encargado general fusionar y aprobar un vale enviado a más de un taller'),
(17, 'vales.ver_gerencia', 'Ver Panel de Gerencia', 'vales', 'Acceso de solo lectura al dashboard de métricas y al listado de vales de arte de todas las tiendas'),
(18, 'vales.autorizar_creacion', 'Autorizar Creación', 'vales', 'Permite al supervisor autorizar el envío a talleres de un vale recién creado por sus asesores (analisis_correcciones_10.md #5)'),
-- Administración
(8, 'admin.ver', 'Ver Panel de Administración', 'admin', 'Permite acceder al módulo de administración central');

-- Asignación de Permisos a Roles (rol_permisos)
-- Administrador: todos
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`) VALUES
(1, 1), (1, 2), (1, 3), (1, 8), (1, 9), (1, 10), (1, 11), (1, 12), (1, 13), (1, 14), (1, 15), (1, 16), (1, 17), (1, 18),
-- Diseñador (legacy, no ligado al flujo de actores de vales): Vales (ver, editar)
(2, 1), (2, 3),
-- Asesor de Ventas: Vales (ver, crear, editar en modificación, confirmar, solicitar modificación)
(3, 1), (3, 2), (3, 3), (3, 12), (3, 13),
-- Supervisor de Ventas: Vales (ver, supervisar, aprobar modificación, autorizar creación)
-- + Panel de Gerencia (analisis_correcciones_12.md #10: comparte el dashboard con el Gerente)
(4, 1), (4, 15), (4, 14), (4, 18), (4, 17),
-- Encargado de taller de diseño: Vales (ver, asignar, revisar) — dueño del taller "Diseño".
-- analisis_correcciones_12.md #11: gana la fusión multi-taller (16) — gerencia
-- decidió que la persona real que fusiona es el Encargado de Diseño, ya no un
-- rol aparte de "encargado general".
-- analisis_correcciones_14.md #1: gana también "trabajar" (11) — un encargado
-- puede autoasignarse un vale de su propio taller y trabajarlo él mismo.
(5, 1), (5, 9), (5, 10), (5, 16), (5, 11),
-- Encargado de taller de diseño 3d: Vales (ver, asignar, revisar, trabajar) — dueño del taller "Diseño UV/3D"
(6, 1), (6, 9), (6, 10), (6, 11),
-- Técnicos: Vales (ver, trabajar)
(7, 1), (7, 11),
-- Rol 8 (Encargado General): DESCONTINUADO — sin permisos (ver comentario en `roles`).
-- Asistente (antes "Asistente de Diseño"/"Asistente Encargado General"): clon
-- operativo COMPLETO del Encargado de taller de diseño — mismos permisos atómicos.
(9, 1), (9, 9), (9, 10), (9, 16), (9, 11),
-- Gerente: solo lectura — ver vales + panel de gerencia (analisis_correcciones_7.md, Vista Gerencia)
(10, 1), (10, 17),
-- Encargado de taller de protextil: Vales (ver, asignar, revisar, trabajar) — SIN fusión.
(11, 1), (11, 9), (11, 10), (11, 11),
-- Encargado de taller de diseño local (analisis_correcciones_14.md #14): mismos
-- permisos atómicos que el 11 (Protextil) — solo cambia CUÁL taller es suyo.
(12, 1), (12, 9), (12, 10), (12, 11);

-- Usuarios (contraseñas hasheadas con bcrypt, 10 rondas)
-- admin@munditrofeos.com          -> admin123
-- diseno@munditrofeos.com         -> diseno123
-- ventas@munditrofeos.com         -> ventas123
-- supervisor@munditrofeos.com     -> supervisor123
-- encargado.diseno@munditrofeos.com -> disenoenc123
-- encargado.uv3d@munditrofeos.com   -> uv3denc123
-- tecnico.a@munditrofeos.com / tecnico.b@munditrofeos.com / tecnico.c@munditrofeos.com -> tecnico123
-- encargado.general@munditrofeos.com -> encgeneral123 (DESACTIVADO, analisis_correcciones_12.md #11)
-- asistente@munditrofeos.com -> asisgeneral123
-- gerente@munditrofeos.com -> gerente123
-- Supervisores/gerentes reales (analisis_correcciones_12.md #10, ids 13-24) reusan
-- la misma contraseña que la cuenta de prueba original de Supervisor: supervisor123
-- Encargados de taller nuevos (Protextil + Diseño Local, ids 25-48, analisis_correcciones_12.md
-- #11) son usuarios mockup: los encargados (rol 11) reusan el hash de
-- encargado.diseno@... (disenoenc123) y los técnicos (rol 7) el de tecnico.a@... (tecnico123).

INSERT INTO `usuarios` (`id`, `nombre`, `email`, `telefono`, `password_hash`, `rol_id`, `tienda_id`, `encargado_id`) VALUES
(1, 'Administrador General', 'admin@munditrofeos.com', '+502 5555-0001', '$2a$10$0.B9xk21MYppfOd4XbtP3u5mJ6NzlaA6eqlu65Fy5G7xb2VnN2Lwu', 1, 1, NULL),
(2, 'Diseñador Creativo', 'diseno@munditrofeos.com', '+502 5555-0002', '$2a$10$SXZEYhhebLnagsNMyFiqFOIn3m4Uwwf45PKHBvEIooMvzfqLXBpaC', 2, 1, NULL),
-- analisis_correcciones_12.md #10: encargado_id ya no es "su supervisor" (ver
-- comentario en la definición de la columna) — queda NULL, su(s) supervisor(es)
-- se resuelven dinámicamente vía tienda_id (1 = MTC) + supervisor_asignaciones.
(3, 'Asesor Comercial', 'ventas@munditrofeos.com', '+502 5555-0003', '$2a$10$KrYwD5jW2ApvSCzeE8r75O4OJViry2yLLHnujyPX4ZGw58IJpSnmW', 3, 1, NULL),
(4, 'Supervisor de Ventas', 'supervisor@munditrofeos.com', '+502 5555-0004', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 4, NULL, NULL),
(5, 'Encargado de Diseño', 'encargado.diseno@munditrofeos.com', '+502 5555-0005', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 5, 1, NULL),
(6, 'Encargado de Diseño UV/3D', 'encargado.uv3d@munditrofeos.com', '+502 5555-0006', '$2a$10$DEPhj4Vnp.cgA6u3w3Leg.FVQ9O3JgKDXizOYCXEbGFlSgEBcb6F6', 6, 1, NULL),
(7, 'Técnico Diseño A', 'tecnico.a@munditrofeos.com', '+502 5555-0007', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 1, 5),
(8, 'Técnico Diseño B', 'tecnico.b@munditrofeos.com', '+502 5555-0008', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 1, 5),
(9, 'Técnico UV/3D C', 'tecnico.c@munditrofeos.com', '+502 5555-0009', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 1, 6),
(10, 'Encargado General', 'encargado.general@munditrofeos.com', '+502 5555-0010', '$2a$10$gxksPVl9V44kqmjlUY3y0uvvnhtzSNX1M7Z1Lbpfy5wzHaQ5Yp6xy', 8, 1, NULL),
(11, 'Asistente de Diseño', 'asistente@munditrofeos.com', '+502 5555-0011', '$2a$10$ivRatQnb0MW3ofhinj2SRu3kzn9Ca3UfHrnyma.gX7rUUtXfcXsVm', 9, 1, NULL),
(12, 'Gerente General', 'gerente@munditrofeos.com', '+502 5555-0012', '$2a$10$yazyTlRjxvs0e/hn5B/UEOoUr6b06lBThNpvUlSOmJr0y1vB8tVXy', 10, NULL, NULL),
-- Supervisores/gerentes reales de la organización (analisis_correcciones_12.md #10).
-- No tienen una tienda "propia" (son regionales/rotativos) — su cobertura vive
-- en `supervisor_asignaciones`, no en `tienda_id`.
(13, 'Carlos Cornejo', 'ventas1@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 4, NULL, NULL),
(14, 'Milvia Esquivel', 'gerentesala@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 4, NULL, NULL),
(15, 'Benjamin Per', 'gerentezona13@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 4, NULL, NULL),
(16, 'Juan Carlos Paniagua', 'regional@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 4, NULL, NULL),
(17, 'Victor Tobar', 'regional.ca@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 4, NULL, NULL),
(18, 'Emilio Morales', 'supervisor1@trofex.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 4, NULL, NULL),
(19, 'Pablo Orellana', 'supervisor@trofex.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 4, NULL, NULL),
(20, 'Carla Gonzáles', 'ventassv3@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 4, NULL, NULL),
(21, 'Brian Medina', 'honduras@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 4, NULL, NULL),
(22, 'Velky Cuevas', 'tegus@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 4, NULL, NULL),
(23, 'Stefany Luna', 'gerencianic@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 4, NULL, NULL),
-- Mismo nombre que el id 17, pero es una cuenta distinta (correo distinto) —
-- así lo lista el documento fuente, cubriendo un alcance más puntual.
(24, 'Victor Tobar', 'costarica@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 4, NULL, NULL);

-- -------------------------------------------------------------------------
-- 7. Estructura organizacional (analisis_correcciones_12.md #10)
-- -------------------------------------------------------------------------
-- Jerarquía real de la empresa: departamento -> subdivisión (opcional) -> tienda.
-- Reemplaza la antigua tabla plana `localidades` (3 filas de demostración,
-- "GUA"/"SAN"/"TEG") por las tiendas reales de la organización, normalizadas
-- en vez de repetir el nombre del departamento/subdivisión en cada fila.

CREATE TABLE IF NOT EXISTS `departamentos` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL UNIQUE,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No todo departamento tiene subdivisiones (Premia Z13 no tiene ninguna) — por
-- eso `tiendas.subdivision_id` es NULL-able en vez de exigir una fila aquí.
CREATE TABLE IF NOT EXISTS `subdivisiones` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `departamento_id` INT NOT NULL,
  `nombre`          VARCHAR(100) NOT NULL,
  `activo`          TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY `uq_subdivision` (`departamento_id`, `nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tiendas/sucursales (antes `localidades`) usadas para el correlativo de vales
-- y para resolver, vía departamento/subdivisión, cuál(es) supervisor(es)
-- cubren a un asesor (ver `supervisor_asignaciones` más abajo).
CREATE TABLE IF NOT EXISTS `tiendas` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`          VARCHAR(10)  NOT NULL UNIQUE COMMENT 'Ej: MTC, SSV, XEL',
  `nombre`          VARCHAR(100) NOT NULL,
  `pais_id`         INT DEFAULT NULL,
  `departamento_id` INT NOT NULL,
  `subdivision_id`  INT DEFAULT NULL COMMENT 'NULL si el departamento no tiene subdivisiones (ej. Premia Z13)',
  -- analisis_correcciones_13.md #6: orden manual del catálogo, editable desde
  -- el modal "Ordenar" de la Vista Administrador.
  `orden`           INT NOT NULL DEFAULT 0,
  `activo`          TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`subdivision_id`) REFERENCES `subdivisiones` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cobertura de un Supervisor de Ventas sobre la organización — reemplaza la
-- relación 1:1 `usuarios.encargado_id` que usaba un asesor para apuntar a "su"
-- supervisor (analisis_correcciones_10.md #11). Un supervisor puede cubrir un
-- departamento ENTERO (`subdivision_id NULL`) o solo una subdivisión puntual;
-- los supervisores son rotativos, así que MÁS DE UN supervisor puede cubrir la
-- misma tienda a la vez (ver dos filas para "Ventas Centroamérica, todas las
-- subdivisiones" en la semilla) — todo lo que antes asumía "el supervisor" de
-- un asesor ahora opera sobre el CONJUNTO de supervisores que lo cubren.
-- analisis_correcciones_13.md #6: la Vista Administrador pide asignar un
-- supervisor a "varias tiendas" puntuales, un nivel más fino que
-- departamento/subdivisión. Se agrega `tienda_id` (nullable): una fila cubre
-- POR DEPARTAMENTO (`departamento_id` seteado, `tienda_id` NULL) o POR TIENDA
-- PUNTUAL (`tienda_id` seteado, `departamento_id`/`subdivision_id` NULL) —
-- nunca ambas cosas a la vez. Las filas existentes (todas por departamento)
-- siguen funcionando igual.
CREATE TABLE IF NOT EXISTS `supervisor_asignaciones` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id`      INT NOT NULL,
  `departamento_id` INT DEFAULT NULL COMMENT 'NULL cuando la cobertura es por tienda puntual (ver tienda_id)',
  `subdivision_id`  INT DEFAULT NULL COMMENT 'NULL = cubre todas las subdivisiones de este departamento',
  `tienda_id`       INT DEFAULT NULL COMMENT 'Cobertura de UNA tienda puntual, alternativa a departamento_id/subdivision_id',
  `activo`          TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`subdivision_id`) REFERENCES `subdivisiones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`) REFERENCES `tiendas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY `uq_supervisor_scope` (`usuario_id`, `departamento_id`, `subdivision_id`, `tienda_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 8. Módulo Vales de Arte
-- -------------------------------------------------------------------------

-- Catálogos del formulario de vale de arte (combobox)
CREATE TABLE IF NOT EXISTS `vale_productos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo` VARCHAR(20) NOT NULL UNIQUE,
  `nombre` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vale_materiales` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- analisis_correcciones_12.md #12: se quitaron `vale_tecnicas`/`vale_acabados`
-- (desde analisis_correcciones_3.md, "técnica"/"acabado" del formulario son
-- texto libre — ningún código las volvía a consultar, ver
-- catalogoRepository.js) y `asesor_limites` (desde analisis_correcciones_10.md
-- #11 el límite diario es colectivo del Supervisor, calculado en vivo — esta
-- tabla quedó huérfana, ni se lee ni se escribe).

-- Talleres/departamentos a los que un asesor puede dirigir un vale de arte.
-- Cada taller tiene un único encargado dueño (el que asigna técnicos y revisa
-- propuestas de ESE taller — reemplaza el buzón compartido de encargados).
-- analisis_correcciones_12.md #11: `tienda_id` distingue un taller de TODA la
-- empresa (Diseño, Diseño UV/3D, Protextil — NULL) de un "Diseño Local" que
-- solo existe para una tienda puntual (apunta a esa tienda). Un solo campo
-- cubre tanto "¿es local?" (tienda_id IS NOT NULL) como "¿de cuál tienda?" —
-- evita un booleano `es_local` redundante.
CREATE TABLE IF NOT EXISTS `talleres` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`       VARCHAR(100) NOT NULL UNIQUE,
  `encargado_id` INT NOT NULL,
  `tienda_id`    INT DEFAULT NULL COMMENT 'NULL = taller de toda la empresa; NOT NULL = Diseño Local de esa tienda',
  `activo`       TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`encargado_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`) REFERENCES `tiendas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Enum de estados del vale de arte (nivel general, ver analisis_correcciones_3.md,
-- analisis_correcciones_5.md #5 y analisis_correcciones_10.md #5): ESPERANDO_AUTORIZACION,
-- CREADO, APROBADO_DEPARTAMENTO, PENDIENTE_CONFIRMACION, RECIBIDO,
-- SOLICITANDO_MODIFICACION, MODIFICADO. Ya no existe el estado EN_CORRECCION ni una
-- acción de "rechazar" separada — un vale PENDIENTE_CONFIRMACION que el asesor no
-- acepta usa el mismo camino que cualquier otra corrección: solicitar modificación.
-- Desde analisis_correcciones_10.md #5, un vale recién creado NO se reparte a los
-- talleres de inmediato: nace en ESPERANDO_AUTORIZACION y el Supervisor de Ventas
-- (dueño de los asesores que lo crearon) debe autorizarlo antes de que exista
-- ninguna fila en `vale_talleres` (ver `talleres_solicitados` más abajo).
-- El progreso interno por taller (asignación/proceso/revisión) vive en `vale_talleres`,
-- no aquí — un vale con 2+ talleres puede tener uno EN_PROCESO y otro recién CREADO
-- a la vez, algo que una sola columna de estado no puede representar.
-- analisis_correcciones_12.md #12: se quitaron 3 columnas muertas —
-- `descripcion_original` (tenía lector en valePdfService.js pero ningún
-- escritor: nunca se implementó realmente el snapshot "antes/después" en el
-- PDF de una modificación), `tiene_adjuntos` (se escribía al crear pero nunca
-- se leía en ningún lado) y `justificacion_modificacion` (siempre quedaba
-- NULL — la justificación real vive en `vale_solicitudes_modificacion.justificacion`
-- y se copia a `descripcion` del vale MOD- nuevo).
CREATE TABLE IF NOT EXISTS `vales` (
  `id`                          INT AUTO_INCREMENT PRIMARY KEY,
  `correlativo`                 VARCHAR(60) NOT NULL UNIQUE COMMENT 'Estructura: [MOD-]TIENDA-INICIALES-00001 (código de tienda + iniciales del asesor + 5 dígitos: analisis_correcciones_12.md #13). Los correlativos históricos previos a esta fase (ej. GUA-3-0001) no se renumeran.',
  `asesor_id`                   INT NOT NULL,
  `tienda_id`                   INT NOT NULL,
  `vale_original_id`            INT DEFAULT NULL COMMENT 'Solo en vales MODIFICADO: apunta al vale original que se modificó',
  `fecha_creacion`               DATE NOT NULL,
  `hora_creacion`                TIME NOT NULL,
  `fecha_entrega`                DATETIME NOT NULL,
  `fecha_evento`                 DATETIME NOT NULL,
  `urgente`                      TINYINT(1) NOT NULL DEFAULT 0,
  -- Información del cliente (digitada por el asesor)
  `cliente_empresa`              VARCHAR(150) DEFAULT NULL,
  `cliente_nombre`               VARCHAR(150) NOT NULL,
  `cliente_telefono`             VARCHAR(30)  NOT NULL,
  `cliente_correo`               VARCHAR(150) NOT NULL,
  -- Información de venta
  `producto_id`                  INT DEFAULT NULL,
  `material_id`                  INT DEFAULT NULL,
  `tecnica`                      VARCHAR(150) DEFAULT NULL COMMENT 'Texto libre (antes catálogo vale_tecnicas); opcional (analisis_correcciones_5.md #8)',
  `acabado`                      VARCHAR(150) DEFAULT NULL COMMENT 'Texto libre (antes catálogo vale_acabados); opcional (analisis_correcciones_5.md #8)',
  `cantidad`                     INT NOT NULL COMMENT 'Debe ser > 1',
  `cotizacion`                   DECIMAL(10,2) NOT NULL,
  -- Boceto y descripción
  `descripcion`                  TEXT,
  `pdf_url`                      TEXT DEFAULT NULL COMMENT 'URL del PDF generado, nunca se guarda el binario en BD',
  `propuesta_general_url`        TEXT DEFAULT NULL COMMENT 'Documento final "oficial" del vale: la propuesta del único taller si hubo uno solo, o el documento de fusión subido por el Encargado General si hubo varios (analisis_correcciones_4.md #1/#11)',
  -- Control de Modificaciones
  `modificado`                   INT NOT NULL DEFAULT 0 COMMENT 'Máx 1 permitida',
  `atraso_congelado_en`          DATETIME DEFAULT NULL COMMENT 'Snapshot fijado la primera vez que el vale se confirma de recibido o se aprueba su modificación; el atraso deja de recalcularse en vivo aunque el estado luego cambie (ej. SOLICITANDO_MODIFICACION) — analisis_correcciones_8.md #7',
  `atraso_notificado_en`         DATETIME DEFAULT NULL COMMENT 'Sellado por el vigilante de atraso (atrasoWatcher) la primera vez que notifica el atraso de este vale, para no repetir la alerta (analisis_correcciones_10.md #10)',
  -- analisis_correcciones_10.md #5: talleres elegidos por el asesor al crear, en
  -- espera de que el Supervisor autorice el envío (no hay filas en `vale_talleres`
  -- todavía mientras el vale está en ESPERANDO_AUTORIZACION).
  `talleres_solicitados`         VARCHAR(100) DEFAULT NULL COMMENT 'CSV de talleres.id elegidos al crear, pendientes de autorización del Supervisor',
  -- analisis_correcciones_10.md #6/#7: quién y cuándo autorizó este vale (creación,
  -- o si este vale ES un MOD-, su propia modificación) — usado para la firma roja
  -- del PDF y para "Trabajo Realizado" del Supervisor.
  `autorizado_por`               INT DEFAULT NULL COMMENT 'usuarios.id del Supervisor que autorizó la creación/modificación de este vale',
  `autorizado_en`                DATETIME DEFAULT NULL,
  `autorizacion_tipo`            ENUM('CREACION','MODIFICACION') DEFAULT NULL,
  `confirmado_en`                DATETIME DEFAULT NULL COMMENT 'Sellado cuando el asesor confirma de recibido (analisis_correcciones_10.md #7)',
  -- No existe una acción de "rechazar" separada (analisis_correcciones_5.md #5): un
  -- vale PENDIENTE_CONFIRMACION que el asesor no acepta solicita modificación, igual
  -- que cualquier otra corrección — no hay un estado EN_CORRECCION.
  -- analisis_correcciones_15.md #1: CONFIRMADO es el estado final del vale
  -- ORIGINAL una vez aprobada su modificación (antes reciclaba RECIBIDO).
  `estado` ENUM('ESPERANDO_AUTORIZACION','CREADO','APROBADO_DEPARTAMENTO','PENDIENTE_CONFIRMACION','RECIBIDO','SOLICITANDO_MODIFICACION','MODIFICADO','CONFIRMADO') NOT NULL DEFAULT 'ESPERANDO_AUTORIZACION',
  `creado_en`                    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`asesor_id`)         REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`)         REFERENCES `tiendas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`vale_original_id`)  REFERENCES `vales` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`producto_id`)  REFERENCES `vale_productos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`material_id`)  REFERENCES `vale_materiales` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`autorizado_por`)  REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_vales_estado` (`estado`),
  INDEX `idx_vales_asesor` (`asesor_id`),
  INDEX `idx_vales_fecha_entrega` (`fecha_entrega`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Progreso de un vale de arte DENTRO de cada taller al que fue enviado.
-- Una fila por (vale, taller) fan-out en creación; reasignar desactiva la
-- fila activa y crea una nueva (mismo patrón que la vieja vale_asignaciones,
-- que esta tabla reemplaza).
CREATE TABLE IF NOT EXISTS `vale_talleres` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`           INT NOT NULL,
  `taller_id`         INT NOT NULL,
  `tecnico_id`        INT DEFAULT NULL,
  -- analisis_correcciones_14.md #10: EN_PAUSA permite a un técnico pausar su
  -- trabajo en un taller sin entregar propuesta, para tomar otro vale.
  `estado`            ENUM('PENDIENTE_ASIGNACION','ASIGNADO','EN_PROCESO','EN_PAUSA','EN_REVISION','APROBADO') NOT NULL DEFAULT 'PENDIENTE_ASIGNACION',
  `fecha_asignacion`  DATETIME DEFAULT NULL,
  `activo`            TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Determina la asignación vigente para este taller',
  `creado_en`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`taller_id`)  REFERENCES `talleres` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_vale_talleres_vale` (`vale_id`),
  INDEX `idx_vale_talleres_tecnico` (`tecnico_id`, `activo`),
  INDEX `idx_vale_talleres_taller` (`taller_id`, `activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Solicitud de modificación de un vale ya RECIBIDO. Al aprobarla el supervisor,
-- se crea un vale de arte NUEVO (correlativo MOD-..., estado MODIFICADO,
-- vale_original_id apuntando aquí) — la solicitud en sí nunca muta el vale
-- original, solo lo deja en estado SOLICITANDO_MODIFICACION mientras espera.
CREATE TABLE IF NOT EXISTS `vale_solicitudes_modificacion` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `vale_original_id`  INT NOT NULL,
  `asesor_id`         INT NOT NULL,
  `fecha_entrega`     DATETIME NOT NULL,
  `fecha_evento`      DATETIME NOT NULL,
  `urgente`           TINYINT(1) NOT NULL DEFAULT 0,
  `cliente_empresa`   VARCHAR(150) DEFAULT NULL,
  `cliente_nombre`    VARCHAR(150) NOT NULL,
  `cliente_telefono`  VARCHAR(30)  NOT NULL,
  `cliente_correo`    VARCHAR(150) NOT NULL,
  `producto_id`       INT DEFAULT NULL,
  `material_id`       INT DEFAULT NULL,
  `tecnica`           VARCHAR(150) DEFAULT NULL,
  `acabado`           VARCHAR(150) DEFAULT NULL,
  `cantidad`          INT NOT NULL,
  `cotizacion`        DECIMAL(10,2) NOT NULL,
  `talleres_ids`      VARCHAR(100) NOT NULL COMMENT 'CSV de talleres.id elegidos para el vale modificado',
  `justificacion`     TEXT NOT NULL,
  `estado`            ENUM('PENDIENTE','APROBADA','RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
  `creado_en`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_original_id`) REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`asesor_id`)        REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`producto_id`)      REFERENCES `vale_productos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`material_id`)      REFERENCES `vale_materiales` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_solicitudes_vale_original` (`vale_original_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Propuestas entregadas por un técnico para revisión del encargado
-- analisis_correcciones_12.md #12: se quitó `es_cancelacion` — cada cancelación
-- de un técnico (cancelarProcesoTecnico) insertaba una fila "en blanco" solo
-- para dejar constancia, cuando ese evento ya se registra en `vale_historial`
-- (que es justo la tabla de auditoría, no esta). Esta tabla queda reservada
-- solo para propuestas reales con documento. También se quitó `fecha_subida`
-- — la app siempre la llenaba con "ahora mismo" en el momento del INSERT,
-- exactamente lo que ya captura `creado_en` (dependencia transitiva).
CREATE TABLE IF NOT EXISTS `vale_propuestas` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`        INT NOT NULL,
  `tecnico_id`     INT NOT NULL,
  `url`            TEXT DEFAULT NULL COMMENT 'URL del documento de propuesta',
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_propuestas_vale` (`vale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Metadatos de archivos adjuntos (imágenes y documentos); el binario nunca se guarda en BD
CREATE TABLE IF NOT EXISTS `vale_documentos` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`          INT NOT NULL,
  `nombre_original`  VARCHAR(255) NOT NULL,
  `ruta`             VARCHAR(500) NOT NULL,
  `tipo`             ENUM('imagen','documento') NOT NULL,
  `mime_type`        VARCHAR(100) NOT NULL,
  `tamano`           INT NOT NULL COMMENT 'Tamaño en bytes',
  `es_modificacion`  TINYINT(1) NOT NULL DEFAULT 0,
  `subido_por`       INT NOT NULL,
  `creado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`subido_por`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_documentos_vale` (`vale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historial/trazabilidad de cada cambio de estado de un vale.
-- `taller_id` es NULL para eventos de nivel de vale (creación, aprobación general,
-- confirmación, rechazo, modificación — visibles para todos los roles con acceso al
-- vale); se llena con el taller correspondiente para eventos internos de un taller
-- (asignar/comenzar/entregar/revisar) — un encargado o técnico de OTRO taller no debe
-- ver esos eventos (analisis_correcciones_4.md #12).
CREATE TABLE IF NOT EXISTS `vale_historial` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`         INT NOT NULL,
  `usuario_id`      INT NOT NULL,
  `taller_id`       INT DEFAULT NULL,
  -- analisis_correcciones_15.md #7: a qué técnico corresponde el evento, para
  -- que un técnico pueda filtrar SU historial sin depender de parsear el
  -- texto de `accion`. Se llena solo en los eventos donde el actor NO es el
  -- propio técnico (asignación/reasignación/aprobación por el encargado) —
  -- en los eventos que el técnico ejecuta él mismo (comenzar/pausar/entregar/
  -- cancelar) ya es identificable por `usuario_id`.
  `tecnico_id`      INT DEFAULT NULL,
  `estado_anterior` VARCHAR(50) DEFAULT NULL,
  `estado_nuevo`    VARCHAR(50) NOT NULL,
  `accion`          VARCHAR(150) NOT NULL,
  `creado_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`taller_id`)  REFERENCES `talleres` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_historial_vale` (`vale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 9. Semillas del Módulo Vales de Arte
-- -------------------------------------------------------------------------

-- Departamentos y subdivisiones (analisis_correcciones_12.md #10) — jerarquía
-- real de la organización, antes de las tiendas que dependen de ellos.
INSERT INTO `departamentos` (`id`, `nombre`) VALUES
(1, 'Ventas Munditrofeos'),
(2, 'Ventas Premia Z13'),
(3, 'Ventas Centroamérica'),
(4, 'Ventas Trofex R1'),
(5, 'Ventas Trofex R2');

-- Ventas Premia Z13 no tiene subdivisiones (dept 2 no aparece aquí).
INSERT INTO `subdivisiones` (`id`, `departamento_id`, `nombre`) VALUES
(1, 1, 'Comercialización'),
(2, 1, 'Sala de Ventas'),
(3, 3, 'Ventas San Salvador'),
(4, 3, 'Ventas Santa Ana'),
(5, 3, 'Ventas San Miguel'),
(6, 3, 'Ventas Escalón'),
(7, 3, 'Ventas Comayagua'),
(8, 3, 'Ventas Tegucigalpa'),
(9, 3, 'Ventas San Pedro Sula'),
(10, 3, 'Ventas Managua'),
(11, 3, 'Ventas León'),
-- La fila de SJO en el documento fuente vino sin el campo PAÍS (solo 4
-- columnas en vez de 5) y "Costa Rica" ocupaba el lugar de SUBDIVISIÓN; pero
-- la propia tabla de supervisores sí nombra una subdivisión "Ventas San Jose"
-- para esa tienda — se crea aquí para que ambas tablas casen, y "Costa Rica"
-- se interpreta como el país faltante de esa fila.
(12, 3, 'Ventas San José'),
(13, 4, 'Ventas San Juan'),
(14, 4, 'Ventas Zona 3'),
(15, 4, 'Ventas Cobán'),
(16, 4, 'Ventas Petén'),
(17, 4, 'Ventas Puerto Barrios'),
(18, 4, 'Ventas Chiquimula'),
(19, 4, 'Ventas Jutiapa'),
(20, 5, 'Ventas San Marcos'),
(21, 5, 'Ventas Chimaltenango'),
(22, 5, 'Ventas Escuintla'),
(23, 5, 'Ventas Huehuetenango'),
(24, 5, 'Ventas Mazatenango'),
(25, 5, 'Ventas Villa Nueva'),
(26, 5, 'Ventas Xela');

-- Tiendas reales (antes `localidades`, id 1 = MTC hereda el rol de la vieja
-- fila "GUA" para no romper los `tienda_id = 1` de la semilla de vales/usuarios
-- de demostración). `pais_id`: 1=GT, 2=SV, 3=HN, 4=NI, 5=CR (ver `paises`).
INSERT INTO `tiendas` (`id`, `codigo`, `nombre`, `pais_id`, `departamento_id`, `subdivision_id`) VALUES
(1,  'MTC', 'Munditrofeos, S.A.', 1, 1, 1),
(2,  'MTS', 'Munditrofeos, S.A.', 1, 1, 2),
(3,  'P13', 'Premia, S.A.', 1, 2, NULL),
(4,  'SSV', 'Premia San Salvador', 2, 3, 3),
(5,  'SAA', 'Premia Express Santa Ana', 2, 3, 4),
(6,  'SMG', 'Premia Express San Miguel', 2, 3, 5),
(7,  'ECL', 'Premia Express Escalón', 2, 3, 6),
(8,  'CMY', 'Premia Express Comayagua', 3, 3, 7),
(9,  'TEG', 'Premia Tegucigalpa', 3, 3, 8),
(10, 'SPS', 'Premia San Pedro Sula', 3, 3, 9),
(11, 'MAN', 'Premia Express Managua', 4, 3, 10),
(12, 'LEO', 'Premia Express León', 4, 3, 11),
(13, 'SJO', 'Premia San Jose', 5, 3, 12),
(14, 'SJN', 'Trofex San Juan', 1, 4, 13),
(15, 'ZN3', 'Trofex Zona 3', 1, 4, 14),
(16, 'COB', 'Trofex Coban', 1, 4, 15),
(17, 'PET', 'Trofex Petén', 1, 4, 16),
(18, 'PTB', 'Trofex Puerto Barrios', 1, 4, 17),
(19, 'CHQ', 'Trofex Chiquimula', 1, 4, 18),
(20, 'JTP', 'Trofex Jutiapa', 1, 4, 19),
(21, 'SMS', 'Trofex San Marcos', 1, 5, 20),
(22, 'CHM', 'Trofex Chimaltenango', 1, 5, 21),
(23, 'ESC', 'Trofex Escuintla', 1, 5, 22),
(24, 'HUE', 'Trofex Huehuetenango', 1, 5, 23),
(25, 'MAZ', 'Trofex Mazatenango', 1, 5, 24),
(26, 'VLN', 'Trofex Villa Nueva', 1, 5, 25),
(27, 'XEL', 'Trofex Xela', 1, 5, 26);

-- Cobertura de supervisores (analisis_correcciones_12.md #10). El id 4
-- (cuenta de prueba original "Supervisor de Ventas") cubre todo Munditrofeos
-- para seguir supervisando al asesor de demostración (tienda 1 = MTC). Emilio
-- Morales y Pablo Orellana cubren Trofex R2 al mismo tiempo (supervisores
-- rotativos) — el documento fuente repetía a Pablo Orellana en dos filas
-- idénticas, se colapsa a una sola.
INSERT INTO `supervisor_asignaciones` (`usuario_id`, `departamento_id`, `subdivision_id`) VALUES
(4, 1, NULL),
(13, 1, NULL),
(14, 1, 2),
(15, 2, NULL),
(16, 3, NULL),
(17, 3, NULL),
(18, 4, NULL),
(18, 5, NULL),
(19, 5, NULL),
(20, 3, 3),
(20, 3, 4),
(20, 3, 5),
(21, 3, 9),
(22, 3, 8),
(22, 3, 7),
(23, 3, 10),
(23, 3, 11),
(24, 3, 12);

INSERT INTO `vale_productos` (`id`, `codigo`, `nombre`) VALUES
(1, 'PRD-TROF', 'Trofeo'),
(2, 'PRD-MED', 'Medalla'),
(3, 'PRD-PLA', 'Placa'),
(4, 'PRD-BAN', 'Banner');

INSERT INTO `vale_materiales` (`id`, `nombre`) VALUES
(1, 'Acrílico'), (2, 'Metal'), (3, 'Madera'), (4, 'Cristal');

-- Encargados y técnicos mockup de los talleres nuevos (analisis_correcciones_12.md
-- #11): Protextil (toda la empresa) + un Diseño Local por cada tienda que lo
-- tiene (todas menos MTC, MTS y las 14 tiendas Trofex — quedan 11: ids de
-- tienda 3 a 13). Los encargados usan el rol genérico 11 "Encargado de Taller"
-- (evita un rol por cada taller); cada uno tiene al menos un técnico (rol 7)
-- para que el flujo asignar/trabajar/revisar se pueda probar de punta a punta,
-- igual que ya existe para Diseño/Diseño UV3D.
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `telefono`, `password_hash`, `rol_id`, `tienda_id`, `encargado_id`) VALUES
(25, 'Encargado Protextil', 'encargado.protextil@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 11, NULL, NULL),
(26, 'Técnico Protextil', 'tecnico.protextil@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, NULL, 25),
(27, 'Encargado Diseño Local P13', 'disenolocal.p13@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 11, 3, NULL),
(28, 'Técnico Diseño Local P13', 'tecnico.disenolocal.p13@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 3, 27),
(29, 'Encargado Diseño Local SSV', 'disenolocal.ssv@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 11, 4, NULL),
(30, 'Técnico Diseño Local SSV', 'tecnico.disenolocal.ssv@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 4, 29),
(31, 'Encargado Diseño Local SAA', 'disenolocal.saa@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 11, 5, NULL),
(32, 'Técnico Diseño Local SAA', 'tecnico.disenolocal.saa@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 5, 31),
(33, 'Encargado Diseño Local SMG', 'disenolocal.smg@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 11, 6, NULL),
(34, 'Técnico Diseño Local SMG', 'tecnico.disenolocal.smg@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 6, 33),
(35, 'Encargado Diseño Local ECL', 'disenolocal.ecl@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 11, 7, NULL),
(36, 'Técnico Diseño Local ECL', 'tecnico.disenolocal.ecl@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 7, 35),
(37, 'Encargado Diseño Local CMY', 'disenolocal.cmy@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 11, 8, NULL),
(38, 'Técnico Diseño Local CMY', 'tecnico.disenolocal.cmy@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 8, 37),
(39, 'Encargado Diseño Local TEG', 'disenolocal.teg@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 11, 9, NULL),
(40, 'Técnico Diseño Local TEG', 'tecnico.disenolocal.teg@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 9, 39),
(41, 'Encargado Diseño Local SPS', 'disenolocal.sps@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 11, 10, NULL),
(42, 'Técnico Diseño Local SPS', 'tecnico.disenolocal.sps@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 10, 41),
(43, 'Encargado Diseño Local MAN', 'disenolocal.man@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 11, 11, NULL),
(44, 'Técnico Diseño Local MAN', 'tecnico.disenolocal.man@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 11, 43),
(45, 'Encargado Diseño Local LEO', 'disenolocal.leo@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 11, 12, NULL),
(46, 'Técnico Diseño Local LEO', 'tecnico.disenolocal.leo@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 12, 45),
(47, 'Encargado Diseño Local SJO', 'disenolocal.sjo@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 11, 13, NULL),
(48, 'Técnico Diseño Local SJO', 'tecnico.disenolocal.sjo@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 7, 13, 47);

-- analisis_correcciones_15.md: nuevos asesores de ventas (rol 3), uno por
-- tienda según el documento fuente. Todos comparten un hash de prueba
-- (contraseña: AsesorNuevo15) — son datos de asesores reales, no tiene
-- sentido hashear 48 contraseñas de producción para un entorno mock.
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `telefono`, `password_hash`, `rol_id`, `tienda_id`, `encargado_id`) VALUES
(49, 'Alejandra Luna', 'ventas2@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 1, NULL),
(50, 'Karla Ordoñez', 'ventas3@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 1, NULL),
(51, 'Melanie Perez', 'ventas4@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 1, NULL),
(52, 'Rosa Ramírez', 'ventas5@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 1, NULL),
(53, 'Luz Carmen Pérez', 'ventas6@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 1, NULL),
(54, 'Alexander Jolón', 'ventas9@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 1, NULL),
(55, 'Lilian Sapon', 'vtsala1@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 2, NULL),
(56, 'Gema Cruz', 'serviciovip2@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 2, NULL),
(57, 'Jamelette Villatoro', 'ventas@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 2, NULL),
(58, 'Maylin Escobar', 'tmk2@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 2, NULL),
(59, 'Nicolle Monterroso', 'vtsala4@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 2, NULL),
(60, 'Carolina Rosales', 'ventasgt1@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 3, NULL),
(61, 'Diana Castaneda', 'tmkpremia1@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 3, NULL),
(62, 'Mary Posada', 'tmkpremia3@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 3, NULL),
(63, 'Eliza Sales', 'tmkpremia13@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 3, NULL),
(64, 'Astrid Ochoa', 'ventas13@grupropremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 3, NULL),
(65, 'Sarah Aleman', 'ventas.premia13@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 3, NULL),
(66, 'Wendy Ramirez', 'sanjuan@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 14, NULL),
(67, 'Angel Gomez', 'zona3@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 15, NULL),
(68, 'Margarita Yoj', 'coban@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 16, NULL),
(69, 'Wendy Recinos', 'peten@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 17, NULL),
(70, 'Yasmin Porras', 'ptobarrios@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 18, NULL),
(71, 'Ingrid Gutierrez', 'chiquimula@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 19, NULL),
(72, 'Yesica Hernandez', 'jutiapa@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 20, NULL),
(73, 'Beberly Santos', 'villanueva@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 26, NULL),
(74, 'Rocio Giron', 'escuintla@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 23, NULL),
(75, 'Sucely Poou', 'chimaltenango@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 22, NULL),
(76, 'Blanca Argueta', 'mazate@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 25, NULL),
(77, 'Dalia Ramirez', 'xela@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 27, NULL),
(78, 'Jose Gonzalez', 'huehue@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 24, NULL),
(79, 'Anderson Cardona', 'sanmarcos@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 21, NULL),
(80, 'Julio Barahona', 'mercadeosv@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 4, NULL),
(81, 'Sandra Onofre', 'tkmsv@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 4, NULL),
(82, 'Carlos Martinez', 'premiateleventassv@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 4, NULL),
(83, 'Kevin Mendoza', 'ventassv1@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 4, NULL),
(84, 'Karen Herrera', 'ventassv@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 4, NULL),
(85, 'Tania Melara', 'santaana@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 5, NULL),
(86, 'Patricia Diaz', 'sanmiguel@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 6, NULL),
(87, 'Pradi Vareal', 'cobrossps@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 10, NULL),
(88, 'Alexis Martínez', 'ventasps2@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 10, NULL),
(89, 'Jaqueline Sosa', 'comertegus@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 9, NULL),
(90, 'Karen Martinez', 'cobrostg@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 9, NULL),
(91, 'Merary Zavala', 'comayagua@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 8, NULL),
(92, 'Alexander Selva', 'mercadeonic2@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 11, NULL),
(93, 'Magaly Ruiz', 'ventasnic2@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 11, NULL),
(94, 'Alejandra Salazar', 'leon@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 12, NULL),
(95, 'Francisco Zamora', 'costarica@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 13, NULL),
(96, 'Luis Elizondo', 'ventas2cr@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 3, 13, NULL);

-- Talleres/departamentos — uno por cada encargado existente. `tienda_id NULL`
-- = taller de toda la empresa; los "Diseño Local" (analisis_correcciones_12.md
-- #11) están acotados a la tienda que los tiene.
INSERT INTO `talleres` (`id`, `nombre`, `encargado_id`, `tienda_id`) VALUES
(1, 'Diseño', 5, NULL),
(2, 'Diseño UV/3D', 6, NULL),
(3, 'Protextil', 25, NULL),
(4, 'Diseño Local - P13', 27, 3),
(5, 'Diseño Local - SSV', 29, 4),
(6, 'Diseño Local - SAA', 31, 5),
(7, 'Diseño Local - SMG', 33, 6),
(8, 'Diseño Local - ECL', 35, 7),
(9, 'Diseño Local - CMY', 37, 8),
(10, 'Diseño Local - TEG', 39, 9),
(11, 'Diseño Local - SPS', 41, 10),
(12, 'Diseño Local - MAN', 43, 11),
(13, 'Diseño Local - LEO', 45, 12),
(14, 'Diseño Local - SJO', 47, 13);

-- Vales de demostración cubriendo el flujo completo nuevo (usados solo si se
-- corre este schema contra MySQL real; el mock en src/config/database.js
-- tiene su propio seed equivalente).
INSERT INTO `vales` (`id`, `correlativo`, `asesor_id`, `tienda_id`, `vale_original_id`, `fecha_creacion`, `hora_creacion`, `fecha_entrega`, `fecha_evento`, `urgente`, `cliente_empresa`, `cliente_nombre`, `cliente_telefono`, `cliente_correo`, `producto_id`, `material_id`, `tecnica`, `acabado`, `cantidad`, `cotizacion`, `descripcion`, `modificado`, `estado`) VALUES
(1,  'GUA-3-0001', 3, 1, NULL, '2026-08-19', '08:30:00', '2026-08-22 17:00:00', '2026-08-25 09:00:00', 0, 'Corporación Deportiva S.A.', 'Juan Pérez', '+502 5555-1111', 'juan.perez@corpdeportiva.com', 1, 2, 'Grabado Láser', 'Brillante', 50, 1500.00, 'Trofeos para premiación anual de ventas.', 0, 'CREADO'),
(2,  'GUA-3-0002', 3, 1, NULL, '2026-08-18', '09:15:00', '2026-08-20 17:00:00', '2026-08-23 09:00:00', 0, 'Liga Guatemalteca', 'María López', '+502 5555-2222', 'maria.lopez@liga.gt', 2, 1, 'Sublimación', 'Mate', 200, 800.00, 'Medallas para maratón centroamericano.', 0, 'CREADO'),
(3,  'GUA-3-0003', 3, 1, NULL, '2026-08-17', '10:00:00', '2026-08-21 17:00:00', '2026-08-24 09:00:00', 1, 'Club Atlético GUA', 'Carlos Ruiz', '+502 5555-3333', 'carlos.ruiz@clubgua.com', 3, 3, 'Impresión UV', 'Satinado', 30, 950.00, 'Placas conmemorativas grabadas en madera.', 0, 'CREADO'),
(4,  'GUA-3-0004', 3, 1, NULL, '2026-08-14', '11:20:00', '2026-08-18 17:00:00', '2026-08-20 09:00:00', 1, 'MundiEventos', 'Ana Gómez', '+502 5555-4444', 'ana.gomez@mundieventos.com', 1, 4, 'Grabado Láser', 'Brillante', 15, 2200.00, 'Trofeos de cristal para gala anual.', 0, 'CREADO'),
(5,  'GUA-3-0005', 3, 1, NULL, '2026-08-13', '08:45:00', '2026-08-17 17:00:00', '2026-08-19 09:00:00', 0, 'Federación Nacional', 'Luis Herrera', '+502 5555-5555', 'luis.herrera@fednacional.org', 4, 1, 'Impresión UV', 'Mate', 5, 600.00, 'Banners UV + trofeos para evento deportivo (dos talleres).', 0, 'CREADO'),
(6,  'GUA-3-0006', 3, 1, NULL, '2026-08-10', '13:00:00', '2026-08-15 17:00:00', '2026-08-16 09:00:00', 0, 'Copa MundiTrofeos', 'Diego Alvarado', '+502 5555-6666', 'diego.alvarado@copamt.com', 1, 2, 'Grabado Láser', 'Brillante', 100, 3200.00, 'Trofeos + banners UV de premiación Copa MundiTrofeos.', 0, 'APROBADO_DEPARTAMENTO'),
(7,  'GUA-3-0007', 3, 1, NULL, '2026-08-09', '15:30:00', '2026-08-16 17:00:00', '2026-08-17 09:00:00', 0, 'Cliente particular', 'Sofía Ramírez', '+502 5555-7777', 'sofia.ramirez@correo.com', 2, 1, 'Sublimación', 'Mate', 40, 450.00, 'Medallas para evento escolar.', 0, 'PENDIENTE_CONFIRMACION'),
(8,  'GUA-3-0008', 3, 1, NULL, '2026-08-05', '10:00:00', '2026-08-12 17:00:00', '2026-08-13 09:00:00', 0, 'Torneo Regional', 'Pedro Sandoval', '+502 5555-8888', 'pedro.sandoval@torneoreg.com', 1, 3, 'Grabado Láser', 'Satinado', 60, 1800.00, 'Trofeos de torneo regional, entregados.', 1, 'RECIBIDO'),
(9,  'GUA-3-0009', 3, 1, NULL, '2026-08-04', '14:00:00', '2026-08-11 17:00:00', '2026-08-12 09:00:00', 0, 'Cliente particular', 'Elena Castillo', '+502 5555-9999', 'elena.castillo@correo.com', 3, 2, 'Impresión UV', 'Mate', 20, 700.00, 'Placas — el cliente pidió ajustar el grabado, asesor solicitó modificación.', 0, 'SOLICITANDO_MODIFICACION'),
(10, 'GUA-3-0010', 3, 1, NULL, '2026-07-30', '09:00:00', '2026-08-08 17:00:00', '2026-08-09 09:00:00', 0, 'Club Deportivo Antigua', 'Roberto Mejía', '+502 5555-1010', 'roberto.mejia@cdantigua.com', 1, 1, 'Grabado Láser', 'Brillante', 80, 2500.00, 'Trofeos de campeonato — modificación de acabado en curso.', 0, 'SOLICITANDO_MODIFICACION'),
(11, 'GUA-3-0011', 3, 1, NULL, '2026-08-06', '16:00:00', '2026-08-14 17:00:00', '2026-08-15 09:00:00', 0, 'Asociación Escolar', 'Marta Solís', '+502 5555-1111', 'marta.solis@asocescolar.edu', 2, 4, 'Sublimación', 'Satinado', 25, 620.00, 'Medallas — el logo quedó descentrado, asesor solicitó modificación.', 0, 'SOLICITANDO_MODIFICACION'),
(12, 'MOD-GUA-3-0008', 3, 1, 8, '2026-08-20', '11:00:00', '2026-08-27 17:00:00', '2026-08-28 09:00:00', 0, 'Torneo Regional', 'Pedro Sandoval', '+502 5555-8888', 'pedro.sandoval@torneoreg.com', 1, 3, 'Grabado Láser', 'Brillante', 60, 1800.00, 'El cliente solicitó cambiar el acabado de satinado a brillante para hacer juego con el resto del set de premiación.', 0, 'MODIFICADO');

-- vale_talleres: progreso por taller de cada vale (reemplaza vale_asignaciones)
INSERT INTO `vale_talleres` (`vale_id`, `taller_id`, `tecnico_id`, `estado`, `fecha_asignacion`, `activo`) VALUES
(1,  1, NULL, 'PENDIENTE_ASIGNACION', NULL, 1),
(2,  1, 7,    'ASIGNADO',    '2026-08-18 09:30:00', 1),
(3,  1, 7,    'EN_PROCESO',  '2026-08-17 10:30:00', 1),
(4,  1, 8,    'EN_REVISION', '2026-08-14 11:45:00', 1),
(5,  1, 7,    'EN_PROCESO',  '2026-08-13 09:15:00', 1),   -- GUA-3-0005, taller Diseño: aún trabajando
(5,  2, 9,    'APROBADO',    '2026-08-13 09:00:00', 1),   -- GUA-3-0005, taller UV/3D: ya aprobado
(6,  1, 7,    'APROBADO',    '2026-08-10 13:20:00', 1),   -- GUA-3-0006, ambos talleres aprobados -> APROBADO_DEPARTAMENTO
(6,  2, 9,    'APROBADO',    '2026-08-10 13:25:00', 1),
(7,  1, 8,    'APROBADO',    '2026-08-09 16:00:00', 1),
(8,  1, 7,    'APROBADO',    '2026-08-05 12:00:00', 1),
(9,  1, 8,    'APROBADO',    '2026-08-04 15:00:00', 1),
(10, 1, 7,    'APROBADO',    '2026-07-30 10:00:00', 1),
(11, 1, 8,    'APROBADO',    '2026-08-13 15:00:00', 1),   -- GUA-3-0011: el taller no se reabre al solicitar modificación, solo el vale vuelve a SOLICITANDO_MODIFICACION
-- vale 12 (MOD-GUA-3-0008, MODIFICADO): desde analisis_correcciones_12.md #11 el
-- fan-out a talleres es INMEDIATO al aprobar la modificación (ya no hay un paso
-- de "reenvío" aparte) — nace con su fila igual que un vale nuevo autorizado.
(12, 1, NULL, 'PENDIENTE_ASIGNACION', NULL, 1);

INSERT INTO `vale_propuestas` (`vale_id`, `tecnico_id`, `url`) VALUES
(4, 8, NULL),
(5, 9, NULL),
(6, 7, NULL),
(6, 9, NULL),
(7, 8, NULL),
(8, 7, NULL),
(9, 8, NULL),
(10, 7, NULL);

INSERT INTO `vale_solicitudes_modificacion` (`vale_original_id`, `asesor_id`, `fecha_entrega`, `fecha_evento`, `urgente`, `cliente_empresa`, `cliente_nombre`, `cliente_telefono`, `cliente_correo`, `producto_id`, `material_id`, `tecnica`, `acabado`, `cantidad`, `cotizacion`, `talleres_ids`, `justificacion`, `estado`) VALUES
(10, 3, '2026-08-08 17:00:00', '2026-08-09 09:00:00', 0, 'Club Deportivo Antigua', 'Roberto Mejía', '+502 5555-1010', 'roberto.mejia@cdantigua.com', 1, 1, 'Grabado Láser', 'Mate', 80, 2500.00, '1', 'El cliente pidió cambiar el acabado de brillante a mate.', 'PENDIENTE'),
-- Antes representaban vales EN_CORRECCION (estado eliminado — ver
-- analisis_correcciones_5.md #5): ahora, como cualquier otra corrección, el asesor
-- solicita modificación en vez de "rechazar".
(9, 3, '2026-08-11 17:00:00', '2026-08-12 09:00:00', 0, 'Cliente particular', 'Elena Castillo', '+502 5555-9999', 'elena.castillo@correo.com', 3, 2, 'Impresión UV', 'Mate', 20, 700.00, '1', 'El cliente pidió ajustar el grabado.', 'PENDIENTE'),
(11, 3, '2026-08-14 17:00:00', '2026-08-15 09:00:00', 0, 'Asociación Escolar', 'Marta Solís', '+502 5555-1111', 'marta.solis@asocescolar.edu', 2, 4, 'Sublimación', 'Satinado', 25, 620.00, '1', 'El logo quedó descentrado.', 'PENDIENTE');

INSERT INTO `vale_historial` (`vale_id`, `usuario_id`, `taller_id`, `estado_anterior`, `estado_nuevo`, `accion`) VALUES
(1, 3, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(2, 3, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(2, 5, 1, 'PENDIENTE_ASIGNACION', 'ASIGNADO', 'Encargado de Diseño asignó a Técnico Diseño A'),
(3, 3, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(3, 5, 1, 'PENDIENTE_ASIGNACION', 'ASIGNADO', 'Encargado de Diseño asignó a Técnico Diseño A'),
(3, 7, 1, 'ASIGNADO', 'EN_PROCESO', 'Técnico marcó el vale como en proceso'),
(4, 3, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(4, 5, 1, 'PENDIENTE_ASIGNACION', 'ASIGNADO', 'Encargado de Diseño asignó a Técnico Diseño B'),
(4, 8, 1, 'ASIGNADO', 'EN_PROCESO', 'Técnico marcó el vale como en proceso'),
(4, 8, 1, 'EN_PROCESO', 'EN_REVISION', 'Técnico entregó propuesta'),
(5, 3, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (talleres: Diseño, Diseño UV/3D)'),
(5, 6, 2, 'PENDIENTE_ASIGNACION', 'ASIGNADO', 'Encargado UV/3D asignó a Técnico UV/3D C'),
(5, 9, 2, 'EN_PROCESO', 'EN_REVISION', 'Técnico UV/3D entregó propuesta'),
(5, 6, 2, 'EN_REVISION', 'APROBADO', 'Encargado UV/3D aprobó la propuesta de su taller'),
(6, 3, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (talleres: Diseño, Diseño UV/3D)'),
(6, 5, 1, 'EN_REVISION', 'APROBADO', 'Encargado de Diseño aprobó la propuesta de su taller'),
(6, 6, 2, 'EN_REVISION', 'APROBADO', 'Encargado UV/3D aprobó la propuesta de su taller'),
(6, 3, NULL, 'CREADO', 'APROBADO_DEPARTAMENTO', 'Ambos talleres aprobaron — pendiente de fusión por Encargado General'),
(7, 3, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(7, 5, 1, 'EN_REVISION', 'APROBADO', 'Encargado de Diseño aprobó la propuesta'),
(7, 3, NULL, 'CREADO', 'PENDIENTE_CONFIRMACION', 'Único taller aprobado — pasa directo a confirmación del asesor'),
(8, 3, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(8, 5, 1, 'EN_REVISION', 'APROBADO', 'Encargado de Diseño aprobó la propuesta'),
(8, 3, NULL, 'CREADO', 'PENDIENTE_CONFIRMACION', 'Único taller aprobado — pasa directo a confirmación del asesor'),
(8, 3, NULL, 'PENDIENTE_CONFIRMACION', 'RECIBIDO', 'Asesor confirmó de recibido el vale de arte'),
(9, 3, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(9, 5, 1, 'EN_REVISION', 'APROBADO', 'Encargado de Diseño aprobó la propuesta'),
(9, 3, NULL, 'CREADO', 'PENDIENTE_CONFIRMACION', 'Único taller aprobado — pasa directo a confirmación del asesor'),
(9, 3, NULL, 'PENDIENTE_CONFIRMACION', 'SOLICITANDO_MODIFICACION', 'Asesor solicitó modificación'),
(10, 3, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(10, 5, 1, 'EN_REVISION', 'APROBADO', 'Encargado de Diseño aprobó la propuesta'),
(10, 3, NULL, 'CREADO', 'PENDIENTE_CONFIRMACION', 'Único taller aprobado — pasa directo a confirmación del asesor'),
(10, 3, NULL, 'PENDIENTE_CONFIRMACION', 'RECIBIDO', 'Asesor confirmó de recibido el vale de arte'),
(10, 3, NULL, 'RECIBIDO', 'SOLICITANDO_MODIFICACION', 'Asesor solicitó modificación de acabado'),
(11, 3, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(11, 5, 1, 'EN_REVISION', 'APROBADO', 'Encargado de Diseño aprobó la propuesta'),
(11, 3, NULL, 'CREADO', 'PENDIENTE_CONFIRMACION', 'Único taller aprobado — pasa directo a confirmación del asesor'),
(11, 3, NULL, 'PENDIENTE_CONFIRMACION', 'SOLICITANDO_MODIFICACION', 'Asesor solicitó modificación'),
(12, 4, NULL, NULL, 'MODIFICADO', 'Supervisor aprobó la solicitud de modificación — se creó el vale MOD-GUA-3-0008');

-- analisis_correcciones_10.md #5: vale de demostración recién creado, esperando
-- que el Supervisor lo autorice — sin filas en vale_talleres todavía.
INSERT INTO `vales` (`id`, `correlativo`, `asesor_id`, `tienda_id`, `vale_original_id`, `fecha_creacion`, `hora_creacion`, `fecha_entrega`, `fecha_evento`, `urgente`, `cliente_empresa`, `cliente_nombre`, `cliente_telefono`, `cliente_correo`, `producto_id`, `material_id`, `tecnica`, `acabado`, `cantidad`, `cotizacion`, `descripcion`, `talleres_solicitados`, `modificado`, `estado`) VALUES
(13, 'GUA-3-0012', 3, 1, NULL, '2026-08-26', '08:00:00', '2026-08-30 17:00:00', '2026-08-31 09:00:00', 0, 'Cliente particular', 'Fernando Ixchop', '+502 5555-1212', 'fernando.ixchop@correo.com', 1, 1, 'Grabado Láser', 'Brillante', 10, 900.00, 'Trofeos recién creados, esperando autorización del Supervisor.', '1', 0, 'ESPERANDO_AUTORIZACION');

INSERT INTO `vale_historial` (`vale_id`, `usuario_id`, `taller_id`, `estado_anterior`, `estado_nuevo`, `accion`) VALUES
(13, 3, NULL, NULL, 'ESPERANDO_AUTORIZACION', 'Vale de arte creado por el asesor — esperando autorización del Supervisor (taller solicitado: Diseño)');

-- Backfill de demostración: sella la autorización/confirmación de un par de vales
-- ya cerrados para poblar "Trabajo Realizado" del Supervisor (analisis_correcciones_10.md #7).
UPDATE `vales` SET `autorizado_por` = 4, `autorizado_en` = '2026-08-05 09:30:00', `autorizacion_tipo` = 'CREACION' WHERE `id` = 8;
UPDATE `vales` SET `confirmado_en` = '2026-08-12 17:00:00' WHERE `id` = 8;
UPDATE `vales` SET `autorizado_por` = 4, `autorizado_en` = '2026-08-20 11:00:00', `autorizacion_tipo` = 'MODIFICACION' WHERE `id` = 12;

-- analisis_correcciones_12.md #11: "el encargado general no existe" — se
-- desactiva el usuario semilla (rol 8, ya sin permisos) en vez de borrarlo,
-- para no romper las FKs de `vale_historial` que ya lo referencian.
UPDATE `usuarios` SET `activo` = 0 WHERE `id` = 10;

-- analisis_correcciones_14.md #14: el rol 2 "Diseñador" (legacy) se
-- desactiva junto con su único usuario semilla — mismo criterio de arriba.
UPDATE `usuarios` SET `activo` = 0 WHERE `id` = 2;

-- analisis_correcciones_14.md #14: los encargados de "Diseño Local" migran
-- del rol genérico 11 (ahora solo Protextil) al rol 12 nuevo. `talleres.encargado_id`
-- no cambia (sigue siendo el mismo usuario) — solo su rol.
UPDATE `usuarios` SET `rol_id` = 12 WHERE `id` IN (27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47);

-- Orden inicial del catálogo de tiendas = orden de sus ids (analisis_correcciones_13.md #6).
UPDATE `tiendas` SET `orden` = `id`;

-- -------------------------------------------------------------------------
-- 10. Vista Administrador (analisis_correcciones_13.md #6)
-- -------------------------------------------------------------------------
-- Fila única (id fijo = 1) con el estado del Modo Mantenimiento del portal.
CREATE TABLE IF NOT EXISTS `mantenimiento_config` (
  `id`           TINYINT PRIMARY KEY DEFAULT 1,
  `activo`       TINYINT(1) NOT NULL DEFAULT 0,
  `mensaje`      VARCHAR(500) DEFAULT NULL,
  `activado_por` INT DEFAULT NULL,
  `activado_en`  DATETIME DEFAULT NULL,
  FOREIGN KEY (`activado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `mantenimiento_config` (`id`, `activo`, `mensaje`) VALUES (1, 0, NULL);

SET FOREIGN_KEY_CHECKS = 1;
