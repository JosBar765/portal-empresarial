-- Datos semilla: catálogos y estructura organizacional reales. Deja la base
-- de datos en un estado inicial funcional sobre un schema.sql creado.
-- No contiene datos de demostración.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO `paises` (`codigo`, `nombre`, `codigo_telefono`) VALUES
('GT', 'Guatemala', '+502'),
('SV', 'El Salvador', '+503'),
('HN', 'Honduras', '+504'),
('NI', 'Nicaragua', '+505'),
('CR', 'Costa Rica', '+506'),
('BZ', 'Belice', '+501');

INSERT INTO `empresas` (`id`, `nombre`, `pais_id`) VALUES
(1,  'Munditrofeos, S.A.', 1),
(2,  'Premia, S.A.', 1),
(3,  'Premia San Salvador', 2),
(4,  'Premia Express Santa Ana', 2),
(5,  'Premia Express San Miguel', 2),
(6,  'Premia Express Escalón', 2),
(7,  'Premia Express Comayagua', 3),
(8,  'Premia Tegucigalpa', 3),
(9,  'Premia San Pedro Sula', 3),
(10, 'Premia Express Managua', 4),
(11, 'Premia Express León', 4),
(12, 'Premia San Jose', 5),
(13, 'Trofex San Juan', 1),
(14, 'Trofex Zona 3', 1),
(15, 'Trofex Coban', 1),
(16, 'Trofex Petén', 1),
(17, 'Trofex Puerto Barrios', 1),
(18, 'Trofex Chiquimula', 1),
(19, 'Trofex Jutiapa', 1),
(20, 'Trofex San Marcos', 1),
(21, 'Trofex Chimaltenango', 1),
(22, 'Trofex Escuintla', 1),
(23, 'Trofex Huehuetenango', 1),
(24, 'Trofex Mazatenango', 1),
(25, 'Trofex Villa Nueva', 1),
(26, 'Trofex Xela', 1);

INSERT INTO `roles` (`id`, `nombre`, `descripcion`, `activo`) VALUES
(1, 'Administrador', 'Acceso total a todos los módulos y configuraciones del portal', 1),
(2, 'Asesor de Ventas', 'Asesor de ventas, encargado de atender clientes y gestionar ventas', 1),
(3, 'Supervisor de Ventas', 'Supervisor de ventas, encargado de supervisar al equipo comercial', 1),
(4, 'Encargado de taller de Diseño', 'Encargado del taller de Diseño, responsable de coordinar y fusionar el trabajo del equipo de diseño', 1),
(5, 'Encargado de taller de Diseño 3d', 'Encargado del taller de Diseño UV/3D, responsable de coordinar al equipo de diseño UV/3D', 1),
(6, 'Técnico', 'Técnico, encargado de ejecutar el trabajo de diseño o producción asignada', 1),
(7, 'Asistente de Diseño', 'Asistente del Encargado de taller de diseño, con las mismas responsabilidades de coordinación y fusión', 1),
(8, 'Gerente', 'Gerente, encargado de supervisar la operación general y sus métricas', 1),
(9, 'Encargado de taller de Protextil', 'Encargado del taller de Protextil, responsable de asignar técnicos y revisar sus propuestas', 1),
(10, 'Diseño Local', 'Encargado de un taller de Diseño Local, responsable de trabajo de diseño y supervisión', 1);

INSERT INTO `permisos` (`id`, `codigo`, `nombre`, `modulo`, `descripcion`) VALUES
(1, 'vales.ver', 'Ver Vales de Arte', 'vales', 'Permite visualizar la lista/buzón de vales de arte'),
(2, 'vales.crear', 'Crear Vales de Arte', 'vales', 'Permite ingresar nuevos vales de arte'),
(3, 'vales.editar', 'Editar Vales de Arte', 'vales', 'Permite modificar el contenido de un vale de arte (formulario de modificación)'),
(8, 'admin.ver', 'Ver Panel de Administración', 'admin', 'Permite acceder al módulo de administración central'),
(9, 'vales.asignar', 'Asignar Vales de Arte', 'vales', 'Permite asignar/reasignar un vale de arte a un técnico'),
(10, 'vales.revisar', 'Revisar Propuestas', 'vales', 'Permite aprobar o desaprobar la propuesta de un técnico'),
(11, 'vales.trabajar', 'Trabajar Vales de Arte', 'vales', 'Permite a un técnico comenzar, entregar o cancelar un vale asignado'),
(12, 'vales.confirmar', 'Confirmar de Recibido', 'vales', 'Permite al asesor confirmarde recibido un vale de arte'),
(13, 'vales.solicitar_modificacion', 'Solicitar Modificación', 'vales', 'Permite al asesor solicitar la modificación de un vale de arte'),
(14, 'vales.aprobar_modificacion', 'Aprobar Modificación', 'vales', 'Permite al supervisor autorizar una modificación solicitada'),
(15, 'vales.supervisar', 'Supervisar Vales de Arte', 'vales', 'Acceso de solo lectura al panel de supervisión de vales de arte'),
(16, 'vales.aprobar_general', 'Aprobar y Fusionar (Multi-taller)', 'vales', 'Permite fusionar y aprobar un vale enviado a más de un taller'),
(17, 'vales.ver_gerencia', 'Ver Panel de Gerencia', 'vales', 'Acceso de solo lectura al dashboard de métricas y al listado de vales de arte de todas las tiendas'),
(18, 'vales.autorizar_creacion', 'Autorizar Creación', 'vales', 'Permite al supervisor autorizar el envío a talleres de un vale recién creado por sus asesores');

INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`) VALUES
-- Administrador: acceso al panel + ver vales (analisis_correcciones_17.md #0)
(1, 1), (1, 8),
-- Asesor de Ventas
(2, 1), (2, 2), (2, 3), (2, 12), (2, 13),
-- Supervisor de Ventas
(3, 1), (3, 14), (3, 15), (3, 17), (3, 18),
-- Encargado de taller de diseño: dueño del taller "Diseño", con fusión (16) y "trabajar" (11)
(4, 1), (4, 9), (4, 10), (4, 11), (4, 16),
-- Encargado de taller de diseño 3d: dueño del taller "Diseño UV/3D", sin fusión
(5, 1), (5, 9), (5, 10), (5, 11),
-- Técnicos
(6, 1), (6, 11),
-- Asistente: clon operativo COMPLETO del Encargado de taller de diseño
(7, 1), (7, 9), (7, 10), (7, 11), (7, 16),
-- Gerente: solo lectura
(8, 1), (8, 17),
-- Encargado de taller de protextil: sin fusión
(9, 1), (9, 9), (9, 10),
-- Encargado de taller de diseño local: mismos permisos atómicos que Diseño
(10, 1), (10, 9), (10, 10), (10, 11);

-- Catálogos del módulo de Vales de Arte (antes ENUM en línea en schema.sql,
-- ver analisis_correcciones_24.md #5) — mismos strings que usaban los ENUM,
-- para que el resto del código (que sigue trabajando con estos nombres, no
-- con los ids) no note el cambio.
INSERT INTO `estados_vale` (`id`, `nombre`) VALUES
(1, 'ESPERANDO_AUTORIZACION'), (2, 'CREADO'), (3, 'APROBADO_DEPARTAMENTO'),
(4, 'PENDIENTE_CONFIRMACION'), (5, 'RECIBIDO'), (6, 'SOLICITANDO_MODIFICACION'),
(7, 'MODIFICADO'), (8, 'CONFIRMADO');

INSERT INTO `tipos_autorizacion` (`id`, `nombre`) VALUES
(1, 'CREACION'), (2, 'MODIFICACION');

INSERT INTO `estados_taller` (`id`, `nombre`) VALUES
(1, 'PENDIENTE_ASIGNACION'), (2, 'ASIGNADO'), (3, 'EN_PROCESO'),
(4, 'EN_PAUSA'), (5, 'EN_REVISION'), (6, 'APROBADO');

INSERT INTO `estados_solicitud_modificacion` (`id`, `nombre`) VALUES
(1, 'PENDIENTE'), (2, 'APROBADA'), (3, 'RECHAZADA');

INSERT INTO `tipos_documento` (`id`, `nombre`) VALUES
(1, 'imagen'), (2, 'documento');

INSERT INTO `departamentos` (`id`, `nombre`, `pais_id`) VALUES
(1, 'Ventas Munditrofeos', 1),
(2, 'Ventas Premia Z13', 1),
(3, 'Ventas Centroamérica', NULL),
(4, 'Ventas Trofex R1', 1),
(5, 'Ventas Trofex R2', 1);

INSERT INTO `subdivisiones` (`id`, `departamento_id`, `nombre`, `pais_id`) VALUES
(1, 1, 'Comercialización', 1),
(2, 1, 'Sala de Ventas', 1),
(3, 3, 'Ventas San Salvador', 2),
(4, 3, 'Ventas Santa Ana', 2),
(5, 3, 'Ventas San Miguel', 2),
(6, 3, 'Ventas Escalón', 2),
(7, 3, 'Ventas Comayagua', 3),
(8, 3, 'Ventas Tegucigalpa', 3),
(9, 3, 'Ventas San Pedro Sula', 3),
(10, 3, 'Ventas Managua', 4),
(11, 3, 'Ventas León', 4),
(12, 3, 'Ventas San José', 5),
(13, 4, 'Ventas San Juan', 1),
(14, 4, 'Ventas Zona 3', 1),
(15, 4, 'Ventas Cobán', 1),
(16, 4, 'Ventas Petén', 1),
(17, 4, 'Ventas Puerto Barrios', 1),
(18, 4, 'Ventas Chiquimula', 1),
(19, 4, 'Ventas Jutiapa', 1),
(20, 5, 'Ventas San Marcos', 1),
(21, 5, 'Ventas Chimaltenango', 1),
(22, 5, 'Ventas Escuintla', 1),
(23, 5, 'Ventas Huehuetenango', 1),
(24, 5, 'Ventas Mazatenango', 1),
(25, 5, 'Ventas Villa Nueva', 1),
(26, 5, 'Ventas Xela', 1);

INSERT INTO `tiendas` (`id`, `codigo`, `empresa_id`, `departamento_id`, `subdivision_id`) VALUES
(1,  'MTC', 1,  1, 1),
(2,  'MTS', 1,  1, 2),
(3,  'P13', 2,  2, NULL),
(4,  'SSV', 3,  3, 3),
(5,  'SAA', 4,  3, 4),
(6,  'SMG', 5,  3, 5),
(7,  'ECL', 6,  3, 6),
(8,  'CMY', 7,  3, 7),
(9,  'TEG', 8,  3, 8),
(10, 'SPS', 9,  3, 9),
(11, 'MAN', 10, 3, 10),
(12, 'LEO', 11, 3, 11),
(13, 'SJO', 12, 3, 12),
(14, 'SJN', 13, 4, 13),
(15, 'ZN3', 14, 4, 14),
(16, 'COB', 15, 4, 15),
(17, 'PET', 16, 4, 16),
(18, 'PTB', 17, 4, 17),
(19, 'CHQ', 18, 4, 18),
(20, 'JTP', 19, 4, 19),
(21, 'SMS', 20, 5, 20),
(22, 'CHM', 21, 5, 21),
(23, 'ESC', 22, 5, 22),
(24, 'HUE', 23, 5, 23),
(25, 'MAZ', 24, 5, 24),
(26, 'VLN', 25, 5, 25),
(27, 'XEL', 26, 5, 26);

INSERT INTO `mantenimiento_config` (`id`, `activo`, `mensaje`) VALUES (1, 0, NULL);

SET FOREIGN_KEY_CHECKS = 1;
