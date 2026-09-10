-- Datos de usuario: inserta los datos reales de los usuarios compartiendo
-- contraseñas comúnes. CAMBIAR estas contraseñas una vez puesto en
-- producción.

-- Usuarios. Contraseñas hasheadas con bcrypt (10 rondas):
--   encargado.diseno@munditrofeos.com       -> disenoenc123
--   encargado.uv3d@munditrofeos.com         -> uv3denc123
--   encargado.protextil@munditrofeos.com    -> protextilenc123
--   TODO los encargados de diseño local     -> disenoenc123
--   asistente@munditrofeos.com              -> asisgeneral123
--   gerente@munditrofeos.com                -> gerente123
--   supervisores                            -> supervisor123
--   asesores de ventas                      -> asesor123
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password_hash`, `rol_id`) VALUES
(1, 'Administrador General', 'admin@munditrofeos.com', '$2a$10$x8YdSB2Dyb/NpGQaHkNCDe0K.tv5z4QRWBPQlCsXJpsrfqWpX17Ia', 1),
-- Encargados de talleres de Munditrofeos
(5, 'Jesus Ramirez', 'encargado.diseno@munditrofeos.com', '$2a$10$Jz0Y4ZY88ys6jFWhAYDfVOSGQwT1Df7.4NmLcDpA.vv1pr17/wxqu', 4),
(6, 'Josue Gomez', 'encargado.uv3d@munditrofeos.com', '$2a$10$GBj8aWQZxf.a6o.eF9k/au46.iNEQdlXN5mlKsDrNVd4FWh.f8uQ2', 5),
(25, 'Leticia Tzún', 'encargado.protextil@munditrofeos.com', '$2a$10$sH7si8ioloM3rOyHiR8uRunHUeMuehv90BJqrvx4VVBPyqWncshqK', 9),
-- Asistente
(11, 'Giancarlo Hernández', 'asistente@munditrofeos.com', '$2a$10$ivRatQnb0MW3ofhinj2SRu3kzn9Ca3UfHrnyma.gX7rUUtXfcXsVm', 7),
-- Rol de gerente
(12, 'Gerente General', 'gerente@munditrofeos.com', '$2a$10$yazyTlRjxvs0e/hn5B/UEOoUr6b06lBThNpvUlSOmJr0y1vB8tVXy', 8),
-- Supervisores
(13, 'Carlos Cornejo', 'ventas1@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3),
(14, 'Milvia Esquivel', 'gerentesala@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3),
(15, 'Benjamin Per', 'gerentezona13@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3),
(16, 'Juan Carlos Paniagua', 'regional@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3),
(17, 'Victor Tobar', 'regional.ca@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3),
(18, 'Emilio Morales', 'supervisor1@trofex.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3),
(19, 'Pablo Orellana', 'supervisor@trofex.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3),
(20, 'Carla Gonzáles', 'ventassv3@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3),
(21, 'Brian Medina', 'honduras@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3),
(22, 'Velky Cuevas', 'tegus@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3),
(23, 'Stefany Luna', 'gerencianic@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3),
-- Mismo nombre que el id 17, pero es una cuenta distinta (correo distinto)
(24, 'Victor Tobar', 'costarica1@grupopremia.com', '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', 3),
-- Encargados de diseño local
(27, 'Jonnathan Aquino', 'disenopremiagt2@grupopremia.com', '$2a$10$Jz0Y4ZY88ys6jFWhAYDfVOSGQwT1Df7.4NmLcDpA.vv1pr17/wxqu', 10),
(29, 'Rodrigo Hernandez', 'disenosalvador@grupopremia.com', '$2a$10$Jz0Y4ZY88ys6jFWhAYDfVOSGQwT1Df7.4NmLcDpA.vv1pr17/wxqu', 10),
(35, 'Oscar Martinez', 'disenolocal.ecl@munditrofeos.com', '$2a$10$Jz0Y4ZY88ys6jFWhAYDfVOSGQwT1Df7.4NmLcDpA.vv1pr17/wxqu', 10),
(39, 'Juan Velazquez', 'disenosps@grupopremia.com', '$2a$10$Jz0Y4ZY88ys6jFWhAYDfVOSGQwT1Df7.4NmLcDpA.vv1pr17/wxqu', 10),
(41, 'Siham Morales', 'disenotegus3@grupopremia.com', '$2a$10$Jz0Y4ZY88ys6jFWhAYDfVOSGQwT1Df7.4NmLcDpA.vv1pr17/wxqu', 10),
(43, 'Álvaro Chamorro', 'disenolocal.man@munditrofeos.com', '$2a$10$Jz0Y4ZY88ys6jFWhAYDfVOSGQwT1Df7.4NmLcDpA.vv1pr17/wxqu', 10),
(47, 'Genesis Ballesteros', 'disenocr@grupopremia.com', '$2a$10$Jz0Y4ZY88ys6jFWhAYDfVOSGQwT1Df7.4NmLcDpA.vv1pr17/wxqu', 10),
-- Asesores de ventas
(49, 'Alejandra Luna', 'ventas2@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(50, 'Karla Ordoñez', 'ventas3@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(51, 'Melanie Perez', 'ventas4@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(52, 'Rosa Ramírez', 'ventas5@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(53, 'Luz Carmen Pérez', 'ventas6@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(54, 'Alexander Jolón', 'ventas9@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(55, 'Lilian Sapon', 'vtsala1@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(56, 'Gema Cruz', 'serviciovip2@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(57, 'Jamelette Villatoro', 'ventas@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(58, 'Maylin Escobar', 'tmk2@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(59, 'Nicolle Monterroso', 'vtsala4@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(60, 'Carolina Rosales', 'ventasgt1@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(61, 'Diana Castaneda', 'tmkpremia1@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(62, 'Mary Posada', 'tmkpremia3@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(63, 'Eliza Sales', 'tmkpremia13@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(64, 'Astrid Ochoa', 'ventas13@grupropremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(65, 'Sarah Aleman', 'ventas.premia13@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(66, 'Wendy Ramirez', 'sanjuan@trofex.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(67, 'Angel Gomez', 'zona3@trofex.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(68, 'Margarita Yoj', 'coban@trofex.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(69, 'Wendy Recinos', 'peten@trofex.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(70, 'Yasmin Porras', 'ptobarrios@trofex.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(71, 'Ingrid Gutierrez', 'chiquimula@trofex.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(72, 'Yesica Hernandez', 'jutiapa@trofex.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(73, 'Beberly Santos', 'villanueva@trofex.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(74, 'Rocio Giron', 'escuintla@trofex.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(75, 'Sucely Poou', 'chimaltenango@trofex.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(76, 'Blanca Argueta', 'mazate@trofex.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(77, 'Dalia Ramirez', 'xela@trofex.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(78, 'Jose Gonzalez', 'huehue@trofex.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(79, 'Anderson Cardona', 'sanmarcos@trofex.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(80, 'Julio Barahona', 'mercadeosv@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(81, 'Sandra Onofre', 'tkmsv@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(82, 'Carlos Martinez', 'premiateleventassv@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(83, 'Kevin Mendoza', 'ventassv1@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(84, 'Karen Herrera', 'ventassv@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(85, 'Tania Melara', 'santaana@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(86, 'Patricia Diaz', 'sanmiguel@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(87, 'Pradi Vareal', 'cobrossps@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(88, 'Alexis Martínez', 'ventasps2@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(89, 'Jaqueline Sosa', 'comertegus@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(90, 'Karen Martinez', 'cobrostg@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(91, 'Merary Zavala', 'comayagua@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(92, 'Alexander Selva', 'mercadeonic2@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(93, 'Magaly Ruiz', 'ventasnic2@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(94, 'Alejandra Salazar', 'leon@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(95, 'Francisco Zamora', 'ventas1cr@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
(96, 'Luis Elizondo', 'ventas2cr@grupopremia.com', '$2a$10$Z6sSKBWpG/5L9jOhx0tbgOaPIPEayY4vZ1DIfVJQ3lMvon50opev.', 2),
-- Tecnicos
(97, 'Alma Boror', 'tecnico1@grupopremia.com', '$2a$10$FXtAxu8qvkDeiUfFuO.b3.2Ws3EWaOMp8n5Arz8xKhZvJM2FGSxk2', 6),
(98, 'Pamela Morales', 'tecnico2@grupopremia.com', '$2a$10$FXtAxu8qvkDeiUfFuO.b3.2Ws3EWaOMp8n5Arz8xKhZvJM2FGSxk2', 6),
(99, 'Victoria Coyoy', 'tecnico3@grupopremia.com', '$2a$10$FXtAxu8qvkDeiUfFuO.b3.2Ws3EWaOMp8n5Arz8xKhZvJM2FGSxk2', 6),
(100, 'Marilyn López', 'tecnico4@grupopremia.com', '$2a$10$FXtAxu8qvkDeiUfFuO.b3.2Ws3EWaOMp8n5Arz8xKhZvJM2FGSxk2', 6),
(101, 'Héctor González', 'tecnico5@grupopremia.com', '$2a$10$FXtAxu8qvkDeiUfFuO.b3.2Ws3EWaOMp8n5Arz8xKhZvJM2FGSxk2', 6),
(102, 'Luis Sanchez', 'tecnico6@grupopremia.com', '$2a$10$FXtAxu8qvkDeiUfFuO.b3.2Ws3EWaOMp8n5Arz8xKhZvJM2FGSxk2', 6),
(103, 'Walter Quiroa', 'tecnico7@grupopremia.com', '$2a$10$FXtAxu8qvkDeiUfFuO.b3.2Ws3EWaOMp8n5Arz8xKhZvJM2FGSxk2', 6),
(104, 'Henry Juárez', 'tecnico8@grupopremia.com', '$2a$10$FXtAxu8qvkDeiUfFuO.b3.2Ws3EWaOMp8n5Arz8xKhZvJM2FGSxk2', 6),
(105, 'Alison Lopez', 'tecnico9@grupopremia.com', '$2a$10$FXtAxu8qvkDeiUfFuO.b3.2Ws3EWaOMp8n5Arz8xKhZvJM2FGSxk2', 6),
(106, 'Jose Alfaro', 'tecnico10@grupopremia.com', '$2a$10$FXtAxu8qvkDeiUfFuO.b3.2Ws3EWaOMp8n5Arz8xKhZvJM2FGSxk2', 6),
(107, 'Jennifer Cifuentes', 'tecnico11@grupopremia.com', '$2a$10$FXtAxu8qvkDeiUfFuO.b3.2Ws3EWaOMp8n5Arz8xKhZvJM2FGSxk2', 6),
(108, 'Sucely Roman', 'tecnico12@grupopremia.com', '$2a$10$FXtAxu8qvkDeiUfFuO.b3.2Ws3EWaOMp8n5Arz8xKhZvJM2FGSxk2', 6),
(109, 'Katherine Recinos', 'tecnico13@grupopremia.com', '$2a$10$FXtAxu8qvkDeiUfFuO.b3.2Ws3EWaOMp8n5Arz8xKhZvJM2FGSxk2', 6);

INSERT INTO `asesores` (`tienda_id`, `usuario_id`) VALUES
(1, 49), (1, 50), (1, 51), (1, 52), (1, 53), (1, 54),
(2, 55), (2, 56), (2, 57), (2, 58), (2, 59),
(3, 60), (3, 61), (3, 62), (3, 63), (3, 64), (3, 65),
(4, 80), (4, 81), (4, 82), (4, 83), (4, 84),
(5, 85),
(6, 86),
(8, 91),
(9, 89), (9, 90),
(10, 87), (10, 88),
(11, 92), (11, 93),
(12, 94),
(13, 95), (13, 96), 
(14, 66),
(15, 67),
(16, 68),
(17, 69),
(18, 70),
(19, 71),
(20, 72),
(21, 79),
(22, 75),
(23, 74),
(24, 78),
(25, 76),
(26, 73),
(27, 77);

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

INSERT INTO `talleres` (`id`, `nombre`, `encargado_id`, `tienda_id`) VALUES
(1, 'Diseño', 5, NULL),
(2, 'Diseño UV/3D', 6, NULL),
(3, 'Protextil', 25, NULL),
(4, 'Diseño Local - P13', 27, 3),
(5, 'Diseño Local - SSV', 29, 4),
(8, 'Diseño Local - ECL', 35, 7),
(10, 'Diseño Local - TEG', 39, 9),
(11, 'Diseño Local - SPS', 41, 10),
(12, 'Diseño Local - MAN', 43, 11),
(14, 'Diseño Local - SJO', 47, 13);

INSERT INTO `taller_tiendas` (`taller_id`, `tienda_id`) VALUES
(1, 1), (1, 2),
(2, 1), (2, 2),
(3, 1), (3, 2),
(4, 3), 
(5, 4), 
(8, 7), 
(10, 9), 
(11, 10), 
(12, 11), 
(14, 13);

INSERT INTO `taller_tecnicos` (`taller_id`, `usuario_id`) VALUES
(1, 97), (1, 98), (1, 99), (1, 100), (1, 101), (1, 102),  (1, 103),
(2, 104), (2, 105), (2, 106), (2, 107),
(3, 108), (3, 109);