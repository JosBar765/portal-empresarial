-- Datos semilla: catálogos y estructura organizacional reales. Deja la base
-- de datos en un estado inicial funcional sobre un schema.sql recién creado.
-- No contiene datos de demostración — ver mock.sql.

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
(4, 'Encargado de taller de diseño', 'Encargado del taller de Diseño, responsable de coordinar y fusionar el trabajo del equipo de diseño', 1),
(5, 'Encargado de taller de diseño 3d', 'Encargado del taller de Diseño UV/3D, responsable de coordinar al equipo de diseño UV/3D', 1),
(6, 'Técnicos', 'Técnico, encargado de ejecutar el trabajo de diseño y producción asignado', 1),
(7, 'Asistente', 'Asistente del Encargado de taller de diseño, con las mismas responsabilidades de coordinación y fusión', 1),
(8, 'Gerente', 'Gerente, encargado de supervisar la operación general y sus métricas', 1),
(9, 'Encargado de taller de protextil', 'Encargado del taller de Protextil, responsable de asignar técnicos y revisar sus propuestas', 1),
(10, 'Encargado de taller de diseño local', 'Encargado de un taller de Diseño Local (por tienda), responsable de asignar técnicos y revisar sus propuestas', 1);

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

-- Usuarios. Contraseñas hasheadas con bcrypt (10 rondas):
--   admin@munditrofeos.com            -> admin123
--   encargado.diseno@munditrofeos.com -> disenoenc123
--   encargado.uv3d@munditrofeos.com   -> uv3denc123
--   tecnico.a / tecnico.b / tecnico.c @munditrofeos.com -> tecnico123
--   asistente@munditrofeos.com        -> asisgeneral123
--   gerente@munditrofeos.com          -> gerente123
--   supervisores/gerentes reales (ids 13-24)                 -> supervisor123
--   encargados/técnicos de Protextil y Diseño Local (25-48)  -> disenoenc123 / tecnico123
--   asesores de ventas reales (ids 49-96)                    -> AsesorNuevo15
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password_hash`, `rol_id`, `tienda_id`) VALUES
(1, 'Administrador General', 'admin@munditrofeos.com', '$2a$10$0.B9xk21MYppfOd4XbtP3u5mJ6NzlaA6eqlu65Fy5G7xb2VnN2Lwu', 1, NULL),
(5, 'Encargado de Diseño', 'encargado.diseno@munditrofeos.com', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 4, 1),
(6, 'Encargado de Diseño UV/3D', 'encargado.uv3d@munditrofeos.com', '$2a$10$DEPhj4Vnp.cgA6u3w3Leg.FVQ9O3JgKDXizOYCXEbGFlSgEBcb6F6', 5, 1),
(7, 'Técnico Diseño A', 'tecnico.a@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 1),
(8, 'Técnico Diseño B', 'tecnico.b@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 1),
(9, 'Técnico UV/3D C', 'tecnico.c@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 1),
(11, 'Asistente de Diseño', 'asistente@munditrofeos.com', '$2a$10$ivRatQnb0MW3ofhinj2SRu3kzn9Ca3UfHrnyma.gX7rUUtXfcXsVm', 7, 1),
(12, 'Gerente General', 'gerente@munditrofeos.com', '$2a$10$yazyTlRjxvs0e/hn5B/UEOoUr6b06lBThNpvUlSOmJr0y1vB8tVXy', 8, NULL),
-- Supervisores/gerentes reales de la organización — regionales/rotativos,
-- sin tienda propia; su cobertura vive en `supervisor_tiendas` (ver abajo).
(13, 'Carlos Cornejo', 'ventas1@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL),
(14, 'Milvia Esquivel', 'gerentesala@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL),
(15, 'Benjamin Per', 'gerentezona13@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL),
(16, 'Juan Carlos Paniagua', 'regional@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL),
(17, 'Victor Tobar', 'regional.ca@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL),
(18, 'Emilio Morales', 'supervisor1@trofex.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL),
(19, 'Pablo Orellana', 'supervisor@trofex.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL),
(20, 'Carla Gonzáles', 'ventassv3@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL),
(21, 'Brian Medina', 'honduras@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL),
(22, 'Velky Cuevas', 'tegus@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL),
(23, 'Stefany Luna', 'gerencianic@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL),
-- Mismo nombre que el id 17, pero es una cuenta distinta (correo distinto),
-- cubriendo un alcance más puntual.
(24, 'Victor Tobar', 'costarica@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL),
-- Encargados y técnicos de Protextil (toda la empresa) y de un Diseño Local
-- por cada tienda que lo tiene — FK obligatoria de `talleres.encargado_id`.
(25, 'Encargado Protextil', 'encargado.protextil@munditrofeos.com', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 9, NULL),
(26, 'Técnico Protextil', 'tecnico.protextil@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, NULL),
(27, 'Encargado Diseño Local P13', 'disenolocal.p13@munditrofeos.com', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 3),
(28, 'Técnico Diseño Local P13', 'tecnico.disenolocal.p13@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 3),
(29, 'Encargado Diseño Local SSV', 'disenolocal.ssv@munditrofeos.com', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 4),
(30, 'Técnico Diseño Local SSV', 'tecnico.disenolocal.ssv@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 4),
(31, 'Encargado Diseño Local SAA', 'disenolocal.saa@munditrofeos.com', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 5),
(32, 'Técnico Diseño Local SAA', 'tecnico.disenolocal.saa@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 5),
(33, 'Encargado Diseño Local SMG', 'disenolocal.smg@munditrofeos.com', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 6),
(34, 'Técnico Diseño Local SMG', 'tecnico.disenolocal.smg@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 6),
(35, 'Encargado Diseño Local ECL', 'disenolocal.ecl@munditrofeos.com', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 7),
(36, 'Técnico Diseño Local ECL', 'tecnico.disenolocal.ecl@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 7),
(37, 'Encargado Diseño Local CMY', 'disenolocal.cmy@munditrofeos.com', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 8),
(38, 'Técnico Diseño Local CMY', 'tecnico.disenolocal.cmy@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 8),
(39, 'Encargado Diseño Local TEG', 'disenolocal.teg@munditrofeos.com', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 9),
(40, 'Técnico Diseño Local TEG', 'tecnico.disenolocal.teg@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 9),
(41, 'Encargado Diseño Local SPS', 'disenolocal.sps@munditrofeos.com', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 10),
(42, 'Técnico Diseño Local SPS', 'tecnico.disenolocal.sps@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 10),
(43, 'Encargado Diseño Local MAN', 'disenolocal.man@munditrofeos.com', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 11),
(44, 'Técnico Diseño Local MAN', 'tecnico.disenolocal.man@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 11),
(45, 'Encargado Diseño Local LEO', 'disenolocal.leo@munditrofeos.com', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 12),
(46, 'Técnico Diseño Local LEO', 'tecnico.disenolocal.leo@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 12),
(47, 'Encargado Diseño Local SJO', 'disenolocal.sjo@munditrofeos.com', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 13),
(48, 'Técnico Diseño Local SJO', 'tecnico.disenolocal.sjo@munditrofeos.com', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 13),
-- Asesores de ventas reales, uno por tienda.
(49, 'Alejandra Luna', 'ventas2@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 1),
(50, 'Karla Ordoñez', 'ventas3@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 1),
(51, 'Melanie Perez', 'ventas4@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 1),
(52, 'Rosa Ramírez', 'ventas5@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 1),
(53, 'Luz Carmen Pérez', 'ventas6@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 1),
(54, 'Alexander Jolón', 'ventas9@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 1),
(55, 'Lilian Sapon', 'vtsala1@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 2),
(56, 'Gema Cruz', 'serviciovip2@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 2),
(57, 'Jamelette Villatoro', 'ventas@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 2),
(58, 'Maylin Escobar', 'tmk2@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 2),
(59, 'Nicolle Monterroso', 'vtsala4@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 2),
(60, 'Carolina Rosales', 'ventasgt1@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 3),
(61, 'Diana Castaneda', 'tmkpremia1@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 3),
(62, 'Mary Posada', 'tmkpremia3@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 3),
(63, 'Eliza Sales', 'tmkpremia13@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 3),
(64, 'Astrid Ochoa', 'ventas13@grupropremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 3),
(65, 'Sarah Aleman', 'ventas.premia13@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 3),
(66, 'Wendy Ramirez', 'sanjuan@trofex.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 14),
(67, 'Angel Gomez', 'zona3@trofex.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 15),
(68, 'Margarita Yoj', 'coban@trofex.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 16),
(69, 'Wendy Recinos', 'peten@trofex.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 17),
(70, 'Yasmin Porras', 'ptobarrios@trofex.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 18),
(71, 'Ingrid Gutierrez', 'chiquimula@trofex.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 19),
(72, 'Yesica Hernandez', 'jutiapa@trofex.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 20),
(73, 'Beberly Santos', 'villanueva@trofex.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 26),
(74, 'Rocio Giron', 'escuintla@trofex.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 23),
(75, 'Sucely Poou', 'chimaltenango@trofex.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 22),
(76, 'Blanca Argueta', 'mazate@trofex.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 25),
(77, 'Dalia Ramirez', 'xela@trofex.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 27),
(78, 'Jose Gonzalez', 'huehue@trofex.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 24),
(79, 'Anderson Cardona', 'sanmarcos@trofex.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 21),
(80, 'Julio Barahona', 'mercadeosv@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 4),
(81, 'Sandra Onofre', 'tkmsv@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 4),
(82, 'Carlos Martinez', 'premiateleventassv@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 4),
(83, 'Kevin Mendoza', 'ventassv1@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 4),
(84, 'Karen Herrera', 'ventassv@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 4),
(85, 'Tania Melara', 'santaana@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 5),
(86, 'Patricia Diaz', 'sanmiguel@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 6),
(87, 'Pradi Vareal', 'cobrossps@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 10),
(88, 'Alexis Martínez', 'ventasps2@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 10),
(89, 'Jaqueline Sosa', 'comertegus@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 9),
(90, 'Karen Martinez', 'cobrostg@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 9),
(91, 'Merary Zavala', 'comayagua@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 8),
(92, 'Alexander Selva', 'mercadeonic2@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 11),
(93, 'Magaly Ruiz', 'ventasnic2@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 11),
(94, 'Alejandra Salazar', 'leon@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 12),
(95, 'Francisco Zamora', 'costarica@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 13),
(96, 'Luis Elizondo', 'ventas2cr@grupopremia.com', '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 13);

INSERT INTO `departamentos` (`id`, `nombre`, `pais_id`) VALUES
(1, 'Ventas Munditrofeos', 1),
(2, 'Ventas Premia Z13', 1),
(3, 'Ventas Centroamérica', NULL),
(4, 'Ventas Trofex R1', NULL),
(5, 'Ventas Trofex R2', NULL);

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

INSERT INTO `asesores` (`usuario_id`, `tienda_id`) VALUES
(49, 1), (50, 1), (51, 1), (52, 1), (53, 1), (54, 1),
(55, 2), (56, 2), (57, 2), (58, 2), (59, 2),
(60, 3), (61, 3), (62, 3), (63, 3), (64, 3), (65, 3),
(66, 14), (67, 15), (68, 16), (69, 17), (70, 18), (71, 19), (72, 20),
(73, 26), (74, 23), (75, 22), (76, 25), (77, 27), (78, 24), (79, 21),
(80, 4), (81, 4), (82, 4), (83, 4), (84, 4),
(85, 5), (86, 6), (87, 10), (88, 10), (89, 9), (90, 9), (91, 8),
(92, 11), (93, 11), (94, 12), (95, 13), (96, 13);

INSERT INTO `supervisores` (`usuario_id`) VALUES
(13), (14), (15), (16), (17), (18), (19), (20), (21), (22), (23), (24);

INSERT INTO `supervisor_tiendas` (`usuario_id`, `tienda_id`) VALUES
(13, 1), (13, 2),
(14, 2),
(15, 3),
(16, 4), (16, 5), (16, 6), (16, 7), (16, 8), (16, 9), (16, 10), (16, 11), (16, 12), (16, 13),
(17, 4), (17, 5), (17, 6), (17, 7), (17, 8), (17, 9), (17, 10), (17, 11), (17, 12), (17, 13),
(18, 14), (18, 15), (18, 16), (18, 17), (18, 18), (18, 19), (18, 20),
(18, 21), (18, 22), (18, 23), (18, 24), (18, 25), (18, 26), (18, 27),
(19, 21), (19, 22), (19, 23), (19, 24), (19, 25), (19, 26), (19, 27),
(20, 4), (20, 5), (20, 6),
(21, 10),
(22, 9), (22, 8),
(23, 11), (23, 12),
(24, 13);

INSERT INTO `vale_productos` (`id`, `codigo`, `nombre`) VALUES
(1, 'PRD-TROF', 'Trofeo'),
(2, 'PRD-MED', 'Medalla'),
(3, 'PRD-PLA', 'Placa'),
(4, 'PRD-BAN', 'Banner');

INSERT INTO `vale_materiales` (`id`, `nombre`) VALUES
(1, 'Acrílico'), (2, 'Metal'), (3, 'Madera'), (4, 'Cristal');

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

INSERT INTO `encargado_tienda` (`taller_id`, `tienda_id`) VALUES
(1, 1), (1, 2),
(2, 1), (2, 2),
(3, 1), (3, 2),
(4, 3), (5, 4), (6, 5), (7, 6), (8, 7), (9, 8), (10, 9), (11, 10), (12, 11), (13, 12), (14, 13);

INSERT INTO `taller_tecnicos` (`usuario_id`, `taller_id`) VALUES
(11, 1),
(7, 1), (8, 1), (9, 2), (26, 3),
(28, 4), (30, 5), (32, 6), (34, 7), (36, 8), (38, 9), (40, 10), (42, 11), (44, 12), (46, 13), (48, 14);

INSERT INTO `mantenimiento_config` (`id`, `activo`, `mensaje`) VALUES (1, 0, NULL);

SET FOREIGN_KEY_CHECKS = 1;
