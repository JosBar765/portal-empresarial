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
-- Administrador: admin
(1, 1),
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
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `telefono`, `password_hash`, `rol_id`, `tienda_id`, `encargado_id`) VALUES
(1, 'Administrador General', 'admin@munditrofeos.com', '+502 5555-0001', '$2a$10$0.B9xk21MYppfOd4XbtP3u5mJ6NzlaA6eqlu65Fy5G7xb2VnN2Lwu', 1, 1, NULL),
(5, 'Encargado de Diseño', 'encargado.diseno@munditrofeos.com', '+502 5555-0005', '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 4, 1, NULL),
(6, 'Encargado de Diseño UV/3D', 'encargado.uv3d@munditrofeos.com', '+502 5555-0006', '$2a$10$DEPhj4Vnp.cgA6u3w3Leg.FVQ9O3JgKDXizOYCXEbGFlSgEBcb6F6', 5, 1, NULL),
(7, 'Técnico Diseño A', 'tecnico.a@munditrofeos.com', '+502 5555-0007', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 1, 5),
(8, 'Técnico Diseño B', 'tecnico.b@munditrofeos.com', '+502 5555-0008', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 1, 5),
(9, 'Técnico UV/3D C', 'tecnico.c@munditrofeos.com', '+502 5555-0009', '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 1, 6),
(11, 'Asistente de Diseño', 'asistente@munditrofeos.com', '+502 5555-0011', '$2a$10$ivRatQnb0MW3ofhinj2SRu3kzn9Ca3UfHrnyma.gX7rUUtXfcXsVm', 7, 1, NULL),
(12, 'Gerente General', 'gerente@munditrofeos.com', '+502 5555-0012', '$2a$10$yazyTlRjxvs0e/hn5B/UEOoUr6b06lBThNpvUlSOmJr0y1vB8tVXy', 8, NULL, NULL),
-- Supervisores/gerentes reales de la organización — regionales/rotativos,
-- sin tienda propia; su cobertura vive en `supervisor_asignaciones`.
(13, 'Carlos Cornejo', 'ventas1@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL, NULL),
(14, 'Milvia Esquivel', 'gerentesala@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL, NULL),
(15, 'Benjamin Per', 'gerentezona13@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL, NULL),
(16, 'Juan Carlos Paniagua', 'regional@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL, NULL),
(17, 'Victor Tobar', 'regional.ca@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL, NULL),
(18, 'Emilio Morales', 'supervisor1@trofex.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL, NULL),
(19, 'Pablo Orellana', 'supervisor@trofex.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL, NULL),
(20, 'Carla Gonzáles', 'ventassv3@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL, NULL),
(21, 'Brian Medina', 'honduras@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL, NULL),
(22, 'Velky Cuevas', 'tegus@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL, NULL),
(23, 'Stefany Luna', 'gerencianic@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL, NULL),
-- Mismo nombre que el id 17, pero es una cuenta distinta (correo distinto),
-- cubriendo un alcance más puntual.
(24, 'Victor Tobar', 'costarica@grupopremia.com', NULL, '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3, NULL, NULL),
-- Encargados y técnicos de Protextil (toda la empresa) y de un Diseño Local
-- por cada tienda que lo tiene — FK obligatoria de `talleres.encargado_id`.
(25, 'Encargado Protextil', 'encargado.protextil@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 9, NULL, NULL),
(26, 'Técnico Protextil', 'tecnico.protextil@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, NULL, 25),
(27, 'Encargado Diseño Local P13', 'disenolocal.p13@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 3, NULL),
(28, 'Técnico Diseño Local P13', 'tecnico.disenolocal.p13@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 3, 27),
(29, 'Encargado Diseño Local SSV', 'disenolocal.ssv@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 4, NULL),
(30, 'Técnico Diseño Local SSV', 'tecnico.disenolocal.ssv@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 4, 29),
(31, 'Encargado Diseño Local SAA', 'disenolocal.saa@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 5, NULL),
(32, 'Técnico Diseño Local SAA', 'tecnico.disenolocal.saa@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 5, 31),
(33, 'Encargado Diseño Local SMG', 'disenolocal.smg@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 6, NULL),
(34, 'Técnico Diseño Local SMG', 'tecnico.disenolocal.smg@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 6, 33),
(35, 'Encargado Diseño Local ECL', 'disenolocal.ecl@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 7, NULL),
(36, 'Técnico Diseño Local ECL', 'tecnico.disenolocal.ecl@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 7, 35),
(37, 'Encargado Diseño Local CMY', 'disenolocal.cmy@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 8, NULL),
(38, 'Técnico Diseño Local CMY', 'tecnico.disenolocal.cmy@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 8, 37),
(39, 'Encargado Diseño Local TEG', 'disenolocal.teg@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 9, NULL),
(40, 'Técnico Diseño Local TEG', 'tecnico.disenolocal.teg@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 9, 39),
(41, 'Encargado Diseño Local SPS', 'disenolocal.sps@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 10, NULL),
(42, 'Técnico Diseño Local SPS', 'tecnico.disenolocal.sps@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 10, 41),
(43, 'Encargado Diseño Local MAN', 'disenolocal.man@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 11, NULL),
(44, 'Técnico Diseño Local MAN', 'tecnico.disenolocal.man@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 11, 43),
(45, 'Encargado Diseño Local LEO', 'disenolocal.leo@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 12, NULL),
(46, 'Técnico Diseño Local LEO', 'tecnico.disenolocal.leo@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 12, 45),
(47, 'Encargado Diseño Local SJO', 'disenolocal.sjo@munditrofeos.com', NULL, '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', 10, 13, NULL),
(48, 'Técnico Diseño Local SJO', 'tecnico.disenolocal.sjo@munditrofeos.com', NULL, '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', 6, 13, 47),
-- Asesores de ventas reales, uno por tienda.
(49, 'Alejandra Luna', 'ventas2@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 1, NULL),
(50, 'Karla Ordoñez', 'ventas3@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 1, NULL),
(51, 'Melanie Perez', 'ventas4@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 1, NULL),
(52, 'Rosa Ramírez', 'ventas5@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 1, NULL),
(53, 'Luz Carmen Pérez', 'ventas6@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 1, NULL),
(54, 'Alexander Jolón', 'ventas9@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 1, NULL),
(55, 'Lilian Sapon', 'vtsala1@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 2, NULL),
(56, 'Gema Cruz', 'serviciovip2@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 2, NULL),
(57, 'Jamelette Villatoro', 'ventas@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 2, NULL),
(58, 'Maylin Escobar', 'tmk2@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 2, NULL),
(59, 'Nicolle Monterroso', 'vtsala4@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 2, NULL),
(60, 'Carolina Rosales', 'ventasgt1@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 3, NULL),
(61, 'Diana Castaneda', 'tmkpremia1@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 3, NULL),
(62, 'Mary Posada', 'tmkpremia3@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 3, NULL),
(63, 'Eliza Sales', 'tmkpremia13@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 3, NULL),
(64, 'Astrid Ochoa', 'ventas13@grupropremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 3, NULL),
(65, 'Sarah Aleman', 'ventas.premia13@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 3, NULL),
(66, 'Wendy Ramirez', 'sanjuan@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 14, NULL),
(67, 'Angel Gomez', 'zona3@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 15, NULL),
(68, 'Margarita Yoj', 'coban@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 16, NULL),
(69, 'Wendy Recinos', 'peten@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 17, NULL),
(70, 'Yasmin Porras', 'ptobarrios@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 18, NULL),
(71, 'Ingrid Gutierrez', 'chiquimula@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 19, NULL),
(72, 'Yesica Hernandez', 'jutiapa@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 20, NULL),
(73, 'Beberly Santos', 'villanueva@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 26, NULL),
(74, 'Rocio Giron', 'escuintla@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 23, NULL),
(75, 'Sucely Poou', 'chimaltenango@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 22, NULL),
(76, 'Blanca Argueta', 'mazate@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 25, NULL),
(77, 'Dalia Ramirez', 'xela@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 27, NULL),
(78, 'Jose Gonzalez', 'huehue@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 24, NULL),
(79, 'Anderson Cardona', 'sanmarcos@trofex.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 21, NULL),
(80, 'Julio Barahona', 'mercadeosv@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 4, NULL),
(81, 'Sandra Onofre', 'tkmsv@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 4, NULL),
(82, 'Carlos Martinez', 'premiateleventassv@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 4, NULL),
(83, 'Kevin Mendoza', 'ventassv1@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 4, NULL),
(84, 'Karen Herrera', 'ventassv@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 4, NULL),
(85, 'Tania Melara', 'santaana@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 5, NULL),
(86, 'Patricia Diaz', 'sanmiguel@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 6, NULL),
(87, 'Pradi Vareal', 'cobrossps@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 10, NULL),
(88, 'Alexis Martínez', 'ventasps2@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 10, NULL),
(89, 'Jaqueline Sosa', 'comertegus@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 9, NULL),
(90, 'Karen Martinez', 'cobrostg@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 9, NULL),
(91, 'Merary Zavala', 'comayagua@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 8, NULL),
(92, 'Alexander Selva', 'mercadeonic2@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 11, NULL),
(93, 'Magaly Ruiz', 'ventasnic2@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 11, NULL),
(94, 'Alejandra Salazar', 'leon@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 12, NULL),
(95, 'Francisco Zamora', 'costarica@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 13, NULL),
(96, 'Luis Elizondo', 'ventas2cr@grupopremia.com', NULL, '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', 2, 13, NULL);

-- Estructura organizacional: departamento -> subdivisión (opcional) -> tienda.
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

-- `orden` = id (orden inicial del catálogo, editable luego desde la Vista
-- Administrador). `pais_id`: 1=GT, 2=SV, 3=HN, 4=NI, 5=CR (ver `paises`).
INSERT INTO `tiendas` (`id`, `codigo`, `nombre`, `pais_id`, `departamento_id`, `subdivision_id`, `orden`) VALUES
(1,  'MTC', 'Munditrofeos, S.A. Comercialización', 1, 1, 1, 1),
(2,  'MTS', 'Munditrofeos, S.A. Sala de Ventas', 1, 1, 2, 2),
(3,  'P13', 'Premia, S.A.', 1, 2, NULL, 3),
(4,  'SSV', 'Premia San Salvador', 2, 3, 3, 4),
(5,  'SAA', 'Premia Express Santa Ana', 2, 3, 4, 5),
(6,  'SMG', 'Premia Express San Miguel', 2, 3, 5, 6),
(7,  'ECL', 'Premia Express Escalón', 2, 3, 6, 7),
(8,  'CMY', 'Premia Express Comayagua', 3, 3, 7, 8),
(9,  'TEG', 'Premia Tegucigalpa', 3, 3, 8, 9),
(10, 'SPS', 'Premia San Pedro Sula', 3, 3, 9, 10),
(11, 'MAN', 'Premia Express Managua', 4, 3, 10, 11),
(12, 'LEO', 'Premia Express León', 4, 3, 11, 12),
(13, 'SJO', 'Premia San Jose', 5, 3, 12, 13),
(14, 'SJN', 'Trofex San Juan', 1, 4, 13, 14),
(15, 'ZN3', 'Trofex Zona 3', 1, 4, 14, 15),
(16, 'COB', 'Trofex Coban', 1, 4, 15, 16),
(17, 'PET', 'Trofex Petén', 1, 4, 16, 17),
(18, 'PTB', 'Trofex Puerto Barrios', 1, 4, 17, 18),
(19, 'CHQ', 'Trofex Chiquimula', 1, 4, 18, 19),
(20, 'JTP', 'Trofex Jutiapa', 1, 4, 19, 20),
(21, 'SMS', 'Trofex San Marcos', 1, 5, 20, 21),
(22, 'CHM', 'Trofex Chimaltenango', 1, 5, 21, 22),
(23, 'ESC', 'Trofex Escuintla', 1, 5, 22, 23),
(24, 'HUE', 'Trofex Huehuetenango', 1, 5, 23, 24),
(25, 'MAZ', 'Trofex Mazatenango', 1, 5, 24, 25),
(26, 'VLN', 'Trofex Villa Nueva', 1, 5, 25, 26),
(27, 'XEL', 'Trofex Xela', 1, 5, 26, 27);

-- Cobertura de supervisores. Emilio Morales y Pablo Orellana cubren Trofex R2
-- al mismo tiempo (supervisores rotativos) — el documento fuente repetía a
-- Pablo Orellana en dos filas idénticas, se colapsa a una sola.
INSERT INTO `supervisor_asignaciones` (`usuario_id`, `departamento_id`, `subdivision_id`) VALUES
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

-- Un taller por cada encargado existente. `tienda_id` NULL = taller de toda
-- la empresa; los "Diseño Local" están acotados a la tienda que los tiene.
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

INSERT INTO `mantenimiento_config` (`id`, `activo`, `mensaje`) VALUES (1, 0, NULL);

SET FOREIGN_KEY_CHECKS = 1;
