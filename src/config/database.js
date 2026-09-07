// src/config/database.js
const mysql = require('mysql2/promise');
const config = require('./env');

let pool = null;
let useMock = false;

// -------------------------------------------------------------------------
// Mock de base de datos en memoria si la conexión física falla.
// Refleja 1:1 la estructura de database/schema.sql y los datos de
// database/seed.sql + database/mock.sql.
// -------------------------------------------------------------------------
const mockDatabase = {
  usuarios: [
    // analisis_correcciones_18.md #1: el Administrador administra el sistema
    // completo, no una tienda puntual — tienda_id siempre null para este rol.
    { id: 1, nombre: 'Administrador General', email: 'admin@munditrofeos.com', password_hash: '$2a$10$0.B9xk21MYppfOd4XbtP3u5mJ6NzlaA6eqlu65Fy5G7xb2VnN2Lwu', rol_id: 1, tienda_id: null, activo: 1 },
    // analisis_correcciones_16.md #8: se eliminaron los usuarios de prueba
    // "Diseñador Creativo" (id 2), "Asesor Comercial" (id 3), "Supervisor de
    // Ventas" (id 4) y "Encargado General" (id 10) — ya no son necesarios con
    // usuarios reales de asesor/supervisor. Los vales/historial que
    // referenciaban al id 3 pasaron a la asesora real de su misma tienda
    // (id 49) y los del id 4 al supervisor real de su mismo departamento
    // (id 13) — ver `vales`/`valeHistorial`/`supervisorTiendas` abajo.
    { id: 5, nombre: 'Encargado de Diseño', email: 'encargado.diseno@munditrofeos.com', password_hash: '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', rol_id: 4, tienda_id: 1, activo: 1 },
    { id: 6, nombre: 'Encargado de Diseño UV/3D', email: 'encargado.uv3d@munditrofeos.com', password_hash: '$2a$10$DEPhj4Vnp.cgA6u3w3Leg.FVQ9O3JgKDXizOYCXEbGFlSgEBcb6F6', rol_id: 5, tienda_id: 1, activo: 1 },
    { id: 7, nombre: 'Técnico Diseño A', email: 'tecnico.a@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: 1, activo: 1 },
    { id: 8, nombre: 'Técnico Diseño B', email: 'tecnico.b@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: 1, activo: 1 },
    { id: 9, nombre: 'Técnico UV/3D C', email: 'tecnico.c@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: 1, activo: 1 },
    { id: 11, nombre: 'Asistente de Diseño', email: 'asistente@munditrofeos.com', password_hash: '$2a$10$ivRatQnb0MW3ofhinj2SRu3kzn9Ca3UfHrnyma.gX7rUUtXfcXsVm', rol_id: 7, tienda_id: 1, activo: 1 },
    { id: 12, nombre: 'Gerente General', email: 'gerente@munditrofeos.com', password_hash: '$2a$10$yazyTlRjxvs0e/hn5B/UEOoUr6b06lBThNpvUlSOmJr0y1vB8tVXy', rol_id: 8, tienda_id: null, activo: 1 },
    // Supervisores/gerentes reales de la organización (analisis_correcciones_12.md
    // #10) — regionales/rotativos, sin tienda propia; su cobertura vive en
    // `supervisorTiendas` (analisis_correcciones_18.md #5). Reusan la
    // contraseña de la cuenta de prueba original de Supervisor (supervisor123).
    { id: 13, nombre: 'Carlos Cornejo', email: 'ventas1@grupopremia.com', password_hash: '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', rol_id: 3, tienda_id: null, activo: 1 },
    { id: 14, nombre: 'Milvia Esquivel', email: 'gerentesala@grupopremia.com', password_hash: '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', rol_id: 3, tienda_id: null, activo: 1 },
    { id: 15, nombre: 'Benjamin Per', email: 'gerentezona13@grupopremia.com', password_hash: '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', rol_id: 3, tienda_id: null, activo: 1 },
    { id: 16, nombre: 'Juan Carlos Paniagua', email: 'regional@grupopremia.com', password_hash: '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', rol_id: 3, tienda_id: null, activo: 1 },
    { id: 17, nombre: 'Victor Tobar', email: 'regional.ca@grupopremia.com', password_hash: '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', rol_id: 3, tienda_id: null, activo: 1 },
    { id: 18, nombre: 'Emilio Morales', email: 'supervisor1@trofex.com', password_hash: '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', rol_id: 3, tienda_id: null, activo: 1 },
    { id: 19, nombre: 'Pablo Orellana', email: 'supervisor@trofex.com', password_hash: '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', rol_id: 3, tienda_id: null, activo: 1 },
    { id: 20, nombre: 'Carla Gonzáles', email: 'ventassv3@grupopremia.com', password_hash: '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', rol_id: 3, tienda_id: null, activo: 1 },
    { id: 21, nombre: 'Brian Medina', email: 'honduras@grupopremia.com', password_hash: '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', rol_id: 3, tienda_id: null, activo: 1 },
    { id: 22, nombre: 'Velky Cuevas', email: 'tegus@grupopremia.com', password_hash: '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', rol_id: 3, tienda_id: null, activo: 1 },
    { id: 23, nombre: 'Stefany Luna', email: 'gerencianic@grupopremia.com', password_hash: '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', rol_id: 3, tienda_id: null, activo: 1 },
    // Mismo nombre que el id 17, pero es una cuenta distinta (correo distinto)
    // — así lo lista el documento fuente, cubriendo un alcance más puntual.
    { id: 24, nombre: 'Victor Tobar', email: 'costarica@grupopremia.com', password_hash: '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', rol_id: 3, tienda_id: null, activo: 1 },
    // Encargados/técnicos mockup de los talleres nuevos (analisis_correcciones_12.md
    // #11): Protextil (toda la empresa) + un Diseño Local por cada una de las 11
    // tiendas que lo tienen. Encargados con el rol genérico 11 "Encargado de
    // Taller" (reusan el hash de encargado.diseno@..., disenoenc123); técnicos
    // con rol 7 (reusan el hash de tecnico.a@..., tecnico123).
    { id: 25, nombre: 'Encargado Protextil', email: 'encargado.protextil@munditrofeos.com', password_hash: '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', rol_id: 9, tienda_id: null, activo: 1 },
    { id: 26, nombre: 'Técnico Protextil', email: 'tecnico.protextil@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: null, activo: 1 },
    { id: 27, nombre: 'Encargado Diseño Local P13', email: 'disenolocal.p13@munditrofeos.com', password_hash: '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', rol_id: 10, tienda_id: 3, activo: 1 },
    { id: 28, nombre: 'Técnico Diseño Local P13', email: 'tecnico.disenolocal.p13@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: 3, activo: 1 },
    { id: 29, nombre: 'Encargado Diseño Local SSV', email: 'disenolocal.ssv@munditrofeos.com', password_hash: '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', rol_id: 10, tienda_id: 4, activo: 1 },
    { id: 30, nombre: 'Técnico Diseño Local SSV', email: 'tecnico.disenolocal.ssv@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: 4, activo: 1 },
    { id: 31, nombre: 'Encargado Diseño Local SAA', email: 'disenolocal.saa@munditrofeos.com', password_hash: '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', rol_id: 10, tienda_id: 5, activo: 1 },
    { id: 32, nombre: 'Técnico Diseño Local SAA', email: 'tecnico.disenolocal.saa@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: 5, activo: 1 },
    { id: 33, nombre: 'Encargado Diseño Local SMG', email: 'disenolocal.smg@munditrofeos.com', password_hash: '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', rol_id: 10, tienda_id: 6, activo: 1 },
    { id: 34, nombre: 'Técnico Diseño Local SMG', email: 'tecnico.disenolocal.smg@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: 6, activo: 1 },
    { id: 35, nombre: 'Encargado Diseño Local ECL', email: 'disenolocal.ecl@munditrofeos.com', password_hash: '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', rol_id: 10, tienda_id: 7, activo: 1 },
    { id: 36, nombre: 'Técnico Diseño Local ECL', email: 'tecnico.disenolocal.ecl@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: 7, activo: 1 },
    { id: 37, nombre: 'Encargado Diseño Local CMY', email: 'disenolocal.cmy@munditrofeos.com', password_hash: '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', rol_id: 10, tienda_id: 8, activo: 1 },
    { id: 38, nombre: 'Técnico Diseño Local CMY', email: 'tecnico.disenolocal.cmy@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: 8, activo: 1 },
    { id: 39, nombre: 'Encargado Diseño Local TEG', email: 'disenolocal.teg@munditrofeos.com', password_hash: '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', rol_id: 10, tienda_id: 9, activo: 1 },
    { id: 40, nombre: 'Técnico Diseño Local TEG', email: 'tecnico.disenolocal.teg@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: 9, activo: 1 },
    { id: 41, nombre: 'Encargado Diseño Local SPS', email: 'disenolocal.sps@munditrofeos.com', password_hash: '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', rol_id: 10, tienda_id: 10, activo: 1 },
    { id: 42, nombre: 'Técnico Diseño Local SPS', email: 'tecnico.disenolocal.sps@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: 10, activo: 1 },
    { id: 43, nombre: 'Encargado Diseño Local MAN', email: 'disenolocal.man@munditrofeos.com', password_hash: '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', rol_id: 10, tienda_id: 11, activo: 1 },
    { id: 44, nombre: 'Técnico Diseño Local MAN', email: 'tecnico.disenolocal.man@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: 11, activo: 1 },
    { id: 45, nombre: 'Encargado Diseño Local LEO', email: 'disenolocal.leo@munditrofeos.com', password_hash: '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', rol_id: 10, tienda_id: 12, activo: 1 },
    { id: 46, nombre: 'Técnico Diseño Local LEO', email: 'tecnico.disenolocal.leo@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: 12, activo: 1 },
    { id: 47, nombre: 'Encargado Diseño Local SJO', email: 'disenolocal.sjo@munditrofeos.com', password_hash: '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', rol_id: 10, tienda_id: 13, activo: 1 },
    { id: 48, nombre: 'Técnico Diseño Local SJO', email: 'tecnico.disenolocal.sjo@munditrofeos.com', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 6, tienda_id: 13, activo: 1 },
    // analisis_correcciones_15.md: nuevos asesores de ventas, uno por tienda,
    // según el documento fuente (todos comparten un hash de prueba: AsesorNuevo15).
    { id: 49, nombre: 'Alejandra Luna', email: 'ventas2@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 1, activo: 1 },
    { id: 50, nombre: 'Karla Ordoñez', email: 'ventas3@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 1, activo: 1 },
    { id: 51, nombre: 'Melanie Perez', email: 'ventas4@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 1, activo: 1 },
    { id: 52, nombre: 'Rosa Ramírez', email: 'ventas5@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 1, activo: 1 },
    { id: 53, nombre: 'Luz Carmen Pérez', email: 'ventas6@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 1, activo: 1 },
    { id: 54, nombre: 'Alexander Jolón', email: 'ventas9@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 1, activo: 1 },
    { id: 55, nombre: 'Lilian Sapon', email: 'vtsala1@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 2, activo: 1 },
    { id: 56, nombre: 'Gema Cruz', email: 'serviciovip2@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 2, activo: 1 },
    { id: 57, nombre: 'Jamelette Villatoro', email: 'ventas@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 2, activo: 1 },
    { id: 58, nombre: 'Maylin Escobar', email: 'tmk2@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 2, activo: 1 },
    { id: 59, nombre: 'Nicolle Monterroso', email: 'vtsala4@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 2, activo: 1 },
    { id: 60, nombre: 'Carolina Rosales', email: 'ventasgt1@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 3, activo: 1 },
    { id: 61, nombre: 'Diana Castaneda', email: 'tmkpremia1@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 3, activo: 1 },
    { id: 62, nombre: 'Mary Posada', email: 'tmkpremia3@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 3, activo: 1 },
    { id: 63, nombre: 'Eliza Sales', email: 'tmkpremia13@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 3, activo: 1 },
    { id: 64, nombre: 'Astrid Ochoa', email: 'ventas13@grupropremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 3, activo: 1 },
    { id: 65, nombre: 'Sarah Aleman', email: 'ventas.premia13@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 3, activo: 1 },
    { id: 66, nombre: 'Wendy Ramirez', email: 'sanjuan@trofex.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 14, activo: 1 },
    { id: 67, nombre: 'Angel Gomez', email: 'zona3@trofex.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 15, activo: 1 },
    { id: 68, nombre: 'Margarita Yoj', email: 'coban@trofex.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 16, activo: 1 },
    { id: 69, nombre: 'Wendy Recinos', email: 'peten@trofex.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 17, activo: 1 },
    { id: 70, nombre: 'Yasmin Porras', email: 'ptobarrios@trofex.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 18, activo: 1 },
    { id: 71, nombre: 'Ingrid Gutierrez', email: 'chiquimula@trofex.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 19, activo: 1 },
    { id: 72, nombre: 'Yesica Hernandez', email: 'jutiapa@trofex.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 20, activo: 1 },
    { id: 73, nombre: 'Beberly Santos', email: 'villanueva@trofex.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 26, activo: 1 },
    { id: 74, nombre: 'Rocio Giron', email: 'escuintla@trofex.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 23, activo: 1 },
    { id: 75, nombre: 'Sucely Poou', email: 'chimaltenango@trofex.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 22, activo: 1 },
    { id: 76, nombre: 'Blanca Argueta', email: 'mazate@trofex.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 25, activo: 1 },
    { id: 77, nombre: 'Dalia Ramirez', email: 'xela@trofex.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 27, activo: 1 },
    { id: 78, nombre: 'Jose Gonzalez', email: 'huehue@trofex.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 24, activo: 1 },
    { id: 79, nombre: 'Anderson Cardona', email: 'sanmarcos@trofex.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 21, activo: 1 },
    { id: 80, nombre: 'Julio Barahona', email: 'mercadeosv@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 4, activo: 1 },
    { id: 81, nombre: 'Sandra Onofre', email: 'tkmsv@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 4, activo: 1 },
    { id: 82, nombre: 'Carlos Martinez', email: 'premiateleventassv@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 4, activo: 1 },
    { id: 83, nombre: 'Kevin Mendoza', email: 'ventassv1@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 4, activo: 1 },
    { id: 84, nombre: 'Karen Herrera', email: 'ventassv@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 4, activo: 1 },
    { id: 85, nombre: 'Tania Melara', email: 'santaana@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 5, activo: 1 },
    { id: 86, nombre: 'Patricia Diaz', email: 'sanmiguel@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 6, activo: 1 },
    { id: 87, nombre: 'Pradi Vareal', email: 'cobrossps@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 10, activo: 1 },
    { id: 88, nombre: 'Alexis Martínez', email: 'ventasps2@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 10, activo: 1 },
    { id: 89, nombre: 'Jaqueline Sosa', email: 'comertegus@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 9, activo: 1 },
    { id: 90, nombre: 'Karen Martinez', email: 'cobrostg@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 9, activo: 1 },
    { id: 91, nombre: 'Merary Zavala', email: 'comayagua@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 8, activo: 1 },
    { id: 92, nombre: 'Alexander Selva', email: 'mercadeonic2@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 11, activo: 1 },
    { id: 93, nombre: 'Magaly Ruiz', email: 'ventasnic2@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 11, activo: 1 },
    { id: 94, nombre: 'Alejandra Salazar', email: 'leon@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 12, activo: 1 },
    { id: 95, nombre: 'Francisco Zamora', email: 'costarica@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 13, activo: 1 },
    { id: 96, nombre: 'Luis Elizondo', email: 'ventas2cr@grupopremia.com', password_hash: '$2a$10$21B6L04MpNZC6SSbPu4Rg.idst9ZyVS.u84Y/JDZppSV7ukb6FSUW', rol_id: 2, tienda_id: 13, activo: 1 },
  ],
  // Descripciones por función, no por flujo de Vales de Arte — deben quedar
  // idénticas a las de database/seed.sql.
  // analisis_correcciones_16.md #7: se eliminaron los roles descontinuados
  // "Diseñador" (antes id 2) y "Encargado General" (antes id 8) — ya no
  // tenían usuarios ni permisos activos — y se renumeró la secuencia sin
  // huecos. Cualquier `rolId`/`rol_id` literal en el código refleja esta
  // numeración nueva.
  roles: [
    { id: 1, nombre: 'Administrador', descripcion: 'Acceso total a todos los módulos y configuraciones del portal', activo: 1 },
    { id: 2, nombre: 'Asesor de Ventas', descripcion: 'Asesor de ventas, encargado de atender clientes y gestionar ventas', activo: 1 },
    { id: 3, nombre: 'Supervisor de Ventas', descripcion: 'Supervisor de ventas, encargado de supervisar al equipo comercial', activo: 1 },
    { id: 4, nombre: 'Encargado de taller de diseño', descripcion: 'Encargado del taller de Diseño, responsable de coordinar y fusionar el trabajo del equipo de diseño', activo: 1 },
    { id: 5, nombre: 'Encargado de taller de diseño 3d', descripcion: 'Encargado del taller de Diseño UV/3D, responsable de coordinar al equipo de diseño UV/3D', activo: 1 },
    { id: 6, nombre: 'Técnicos', descripcion: 'Técnico, encargado de ejecutar el trabajo de diseño y producción asignado', activo: 1 },
    { id: 7, nombre: 'Asistente', descripcion: 'Asistente del Encargado de taller de diseño, con las mismas responsabilidades de coordinación y fusión', activo: 1 },
    { id: 8, nombre: 'Gerente', descripcion: 'Gerente, encargado de supervisar la operación general y sus métricas', activo: 1 },
    { id: 9, nombre: 'Encargado de taller de protextil', descripcion: 'Encargado del taller de Protextil, responsable de asignar técnicos y revisar sus propuestas', activo: 1 },
    // Separa "Diseño Local" del genérico 9 (Protextil) — se distinguen por
    // CUÁL taller es su encargado_id, no por su rol.
    { id: 10, nombre: 'Encargado de taller de diseño local', descripcion: 'Encargado de un taller de Diseño Local (por tienda), responsable de asignar técnicos y revisar sus propuestas', activo: 1 }
  ],
  // analisis_correcciones_15.md #9: se eliminaron los permisos MOCK de los
  // módulos "prompts"/"eventos" (antes ids 4-7) — no existe ningún
  // src/modules/prompts|eventos ni public/modules/prompts|eventos detrás,
  // eran datos de ejemplo sin módulo real. Solo quedan vales y admin.
  permisos: [
    { id: 1, codigo: 'vales.ver', nombre: 'Ver Vales', modulo: 'vales' },
    { id: 2, codigo: 'vales.crear', nombre: 'Crear Vales', modulo: 'vales' },
    { id: 3, codigo: 'vales.editar', nombre: 'Editar Vales', modulo: 'vales' },
    { id: 8, codigo: 'admin.ver', nombre: 'Ver Admin', modulo: 'admin' },
    { id: 9, codigo: 'vales.asignar', nombre: 'Asignar Vales', modulo: 'vales' },
    { id: 10, codigo: 'vales.revisar', nombre: 'Revisar Propuestas', modulo: 'vales' },
    { id: 11, codigo: 'vales.trabajar', nombre: 'Trabajar Vales', modulo: 'vales' },
    { id: 12, codigo: 'vales.confirmar', nombre: 'Confirmar o Cancelar Venta', modulo: 'vales' },
    { id: 13, codigo: 'vales.solicitar_modificacion', nombre: 'Solicitar Modificación', modulo: 'vales' },
    { id: 14, codigo: 'vales.aprobar_modificacion', nombre: 'Aprobar Modificación', modulo: 'vales' },
    { id: 15, codigo: 'vales.supervisar', nombre: 'Supervisar Vales', modulo: 'vales' },
    { id: 16, codigo: 'vales.aprobar_general', nombre: 'Aprobar y Fusionar (Multi-taller)', modulo: 'vales' },
    { id: 17, codigo: 'vales.ver_gerencia', nombre: 'Ver Panel de Gerencia', modulo: 'vales' },
    { id: 18, codigo: 'vales.autorizar_creacion', nombre: 'Autorizar Creación', modulo: 'vales' }
  ],
  // Numeración de rol_id renumerada tras analisis_correcciones_16.md #7
  // (roles "Diseñador" y "Encargado General" eliminados).
  rol_permisos: [
    // Administrador: acceso al panel + ver vales (analisis_correcciones_17.md #0)
    { rol_id: 1, permiso_id: 1 }, { rol_id: 1, permiso_id: 8 },
    // Asesor de Ventas (2)
    { rol_id: 2, permiso_id: 1 }, { rol_id: 2, permiso_id: 2 }, { rol_id: 2, permiso_id: 3 },
    { rol_id: 2, permiso_id: 12 }, { rol_id: 2, permiso_id: 13 },
    // Supervisor de Ventas (3)
    { rol_id: 3, permiso_id: 1 }, { rol_id: 3, permiso_id: 15 }, { rol_id: 3, permiso_id: 14 }, { rol_id: 3, permiso_id: 18 }, { rol_id: 3, permiso_id: 17 },
    // Encargado de taller de diseño (4): gana la fusión (16) y "trabajar" (11) — autoasignación.
    { rol_id: 4, permiso_id: 1 }, { rol_id: 4, permiso_id: 9 }, { rol_id: 4, permiso_id: 10 }, { rol_id: 4, permiso_id: 16 }, { rol_id: 4, permiso_id: 11 },
    // Encargado de taller de diseño 3d (5)
    { rol_id: 5, permiso_id: 1 }, { rol_id: 5, permiso_id: 9 }, { rol_id: 5, permiso_id: 10 }, { rol_id: 5, permiso_id: 11 },
    // Técnicos (6)
    { rol_id: 6, permiso_id: 1 }, { rol_id: 6, permiso_id: 11 },
    // Asistente (7): clon operativo COMPLETO del Encargado de taller de diseño.
    { rol_id: 7, permiso_id: 1 }, { rol_id: 7, permiso_id: 9 }, { rol_id: 7, permiso_id: 10 }, { rol_id: 7, permiso_id: 16 }, { rol_id: 7, permiso_id: 11 },
    // Gerente (8)
    { rol_id: 8, permiso_id: 1 }, { rol_id: 8, permiso_id: 17 },
    // Encargado de taller de protextil (9) — sin fusión, sin "trabajar" (analisis_correcciones_17.md #0).
    { rol_id: 9, permiso_id: 1 }, { rol_id: 9, permiso_id: 9 }, { rol_id: 9, permiso_id: 10 },
    // Encargado de taller de diseño local (10): mismos permisos atómicos que Diseño (4), incluye "trabajar" (11).
    { rol_id: 10, permiso_id: 1 }, { rol_id: 10, permiso_id: 9 }, { rol_id: 10, permiso_id: 10 }, { rol_id: 10, permiso_id: 11 }
  ],
  // Estructura organizacional (analisis_correcciones_12.md #10) — reemplaza la
  // vieja `localidades` (3 filas placeholder "GUA"/"SAN"/"TEG") por la
  // jerarquía real departamento -> subdivisión (opcional) -> tienda. La tienda
  // id 1 (MTC) hereda el rol de la vieja fila "GUA" para no romper los
  // `tienda_id = 1` de la semilla de vales/usuarios de demostración.
  // analisis_correcciones_18.md #3: `pais_id` en el departamento solo aplica
  // cuando no tiene subdivisiones propias (Munditrofeos y Premia Z13, ambos
  // exclusivos de Guatemala); "Ventas Centroamérica" y los Trofex quedan en
  // null porque el país real vive en cada subdivisión (ver abajo).
  departamentos: [
    { id: 1, nombre: 'Ventas Munditrofeos', pais_id: 1, activo: 1 },
    { id: 2, nombre: 'Ventas Premia Z13', pais_id: 1, activo: 1 },
    { id: 3, nombre: 'Ventas Centroamérica', pais_id: null, activo: 1 },
    { id: 4, nombre: 'Ventas Trofex R1', pais_id: null, activo: 1 },
    { id: 5, nombre: 'Ventas Trofex R2', pais_id: null, activo: 1 }
  ],
  // Ventas Premia Z13 (departamento 2) no tiene subdivisiones.
  // `pais_id`: 1=GT, 2=SV, 3=HN, 4=NI, 5=CR (ver `paises` abajo).
  subdivisiones: [
    { id: 1, departamento_id: 1, nombre: 'Comercialización', pais_id: 1, activo: 1 },
    { id: 2, departamento_id: 1, nombre: 'Sala de Ventas', pais_id: 1, activo: 1 },
    { id: 3, departamento_id: 3, nombre: 'Ventas San Salvador', pais_id: 2, activo: 1 },
    { id: 4, departamento_id: 3, nombre: 'Ventas Santa Ana', pais_id: 2, activo: 1 },
    { id: 5, departamento_id: 3, nombre: 'Ventas San Miguel', pais_id: 2, activo: 1 },
    { id: 6, departamento_id: 3, nombre: 'Ventas Escalón', pais_id: 2, activo: 1 },
    { id: 7, departamento_id: 3, nombre: 'Ventas Comayagua', pais_id: 3, activo: 1 },
    { id: 8, departamento_id: 3, nombre: 'Ventas Tegucigalpa', pais_id: 3, activo: 1 },
    { id: 9, departamento_id: 3, nombre: 'Ventas San Pedro Sula', pais_id: 3, activo: 1 },
    { id: 10, departamento_id: 3, nombre: 'Ventas Managua', pais_id: 4, activo: 1 },
    { id: 11, departamento_id: 3, nombre: 'Ventas León', pais_id: 4, activo: 1 },
    // La fila de SJO en el documento fuente vino sin el campo PAÍS y "Costa
    // Rica" ocupaba el lugar de SUBDIVISIÓN, pero la tabla de supervisores sí
    // nombra "Ventas San Jose" para esa tienda — se crea para que ambas casen.
    { id: 12, departamento_id: 3, nombre: 'Ventas San José', pais_id: 5, activo: 1 },
    { id: 13, departamento_id: 4, nombre: 'Ventas San Juan', pais_id: 1, activo: 1 },
    { id: 14, departamento_id: 4, nombre: 'Ventas Zona 3', pais_id: 1, activo: 1 },
    { id: 15, departamento_id: 4, nombre: 'Ventas Cobán', pais_id: 1, activo: 1 },
    { id: 16, departamento_id: 4, nombre: 'Ventas Petén', pais_id: 1, activo: 1 },
    { id: 17, departamento_id: 4, nombre: 'Ventas Puerto Barrios', pais_id: 1, activo: 1 },
    { id: 18, departamento_id: 4, nombre: 'Ventas Chiquimula', pais_id: 1, activo: 1 },
    { id: 19, departamento_id: 4, nombre: 'Ventas Jutiapa', pais_id: 1, activo: 1 },
    { id: 20, departamento_id: 5, nombre: 'Ventas San Marcos', pais_id: 1, activo: 1 },
    { id: 21, departamento_id: 5, nombre: 'Ventas Chimaltenango', pais_id: 1, activo: 1 },
    { id: 22, departamento_id: 5, nombre: 'Ventas Escuintla', pais_id: 1, activo: 1 },
    { id: 23, departamento_id: 5, nombre: 'Ventas Huehuetenango', pais_id: 1, activo: 1 },
    { id: 24, departamento_id: 5, nombre: 'Ventas Mazatenango', pais_id: 1, activo: 1 },
    { id: 25, departamento_id: 5, nombre: 'Ventas Villa Nueva', pais_id: 1, activo: 1 },
    { id: 26, departamento_id: 5, nombre: 'Ventas Xela', pais_id: 1, activo: 1 }
  ],
  // analisis_correcciones_18.md #5: empresa dueña de la tienda (MTC y MTS
  // comparten "Munditrofeos, S.A."). El país de una tienda se resuelve vía
  // `empresas.pais_id`, ya no con `tiendas.pais_id` (eliminado); su nombre
  // ya no es un campo propio — se deriva como "{EMPRESA}, {SUBDIVISIÓN}" (o
  // solo "{EMPRESA}" sin subdivisión) en `tiendaAdminRepository`.
  empresas: [
    { id: 1, nombre: 'Munditrofeos, S.A.', pais_id: 1 },
    { id: 2, nombre: 'Premia, S.A.', pais_id: 1 },
    { id: 3, nombre: 'Premia San Salvador', pais_id: 2 },
    { id: 4, nombre: 'Premia Express Santa Ana', pais_id: 2 },
    { id: 5, nombre: 'Premia Express San Miguel', pais_id: 2 },
    { id: 6, nombre: 'Premia Express Escalón', pais_id: 2 },
    { id: 7, nombre: 'Premia Express Comayagua', pais_id: 3 },
    { id: 8, nombre: 'Premia Tegucigalpa', pais_id: 3 },
    { id: 9, nombre: 'Premia San Pedro Sula', pais_id: 3 },
    { id: 10, nombre: 'Premia Express Managua', pais_id: 4 },
    { id: 11, nombre: 'Premia Express León', pais_id: 4 },
    { id: 12, nombre: 'Premia San Jose', pais_id: 5 },
    { id: 13, nombre: 'Trofex San Juan', pais_id: 1 },
    { id: 14, nombre: 'Trofex Zona 3', pais_id: 1 },
    { id: 15, nombre: 'Trofex Coban', pais_id: 1 },
    { id: 16, nombre: 'Trofex Petén', pais_id: 1 },
    { id: 17, nombre: 'Trofex Puerto Barrios', pais_id: 1 },
    { id: 18, nombre: 'Trofex Chiquimula', pais_id: 1 },
    { id: 19, nombre: 'Trofex Jutiapa', pais_id: 1 },
    { id: 20, nombre: 'Trofex San Marcos', pais_id: 1 },
    { id: 21, nombre: 'Trofex Chimaltenango', pais_id: 1 },
    { id: 22, nombre: 'Trofex Escuintla', pais_id: 1 },
    { id: 23, nombre: 'Trofex Huehuetenango', pais_id: 1 },
    { id: 24, nombre: 'Trofex Mazatenango', pais_id: 1 },
    { id: 25, nombre: 'Trofex Villa Nueva', pais_id: 1 },
    { id: 26, nombre: 'Trofex Xela', pais_id: 1 }
  ],
  tiendas: [
    { id: 1, codigo: 'MTC', empresa_id: 1, departamento_id: 1, subdivision_id: 1, orden: 1, activo: 1 },
    { id: 2, codigo: 'MTS', empresa_id: 1, departamento_id: 1, subdivision_id: 2, orden: 2, activo: 1 },
    { id: 3, codigo: 'P13', empresa_id: 2, departamento_id: 2, subdivision_id: null, orden: 3, activo: 1 },
    { id: 4, codigo: 'SSV', empresa_id: 3, departamento_id: 3, subdivision_id: 3, orden: 4, activo: 1 },
    { id: 5, codigo: 'SAA', empresa_id: 4, departamento_id: 3, subdivision_id: 4, orden: 5, activo: 1 },
    { id: 6, codigo: 'SMG', empresa_id: 5, departamento_id: 3, subdivision_id: 5, orden: 6, activo: 1 },
    { id: 7, codigo: 'ECL', empresa_id: 6, departamento_id: 3, subdivision_id: 6, orden: 7, activo: 1 },
    { id: 8, codigo: 'CMY', empresa_id: 7, departamento_id: 3, subdivision_id: 7, orden: 8, activo: 1 },
    { id: 9, codigo: 'TEG', empresa_id: 8, departamento_id: 3, subdivision_id: 8, orden: 9, activo: 1 },
    { id: 10, codigo: 'SPS', empresa_id: 9, departamento_id: 3, subdivision_id: 9, orden: 10, activo: 1 },
    { id: 11, codigo: 'MAN', empresa_id: 10, departamento_id: 3, subdivision_id: 10, orden: 11, activo: 1 },
    { id: 12, codigo: 'LEO', empresa_id: 11, departamento_id: 3, subdivision_id: 11, orden: 12, activo: 1 },
    { id: 13, codigo: 'SJO', empresa_id: 12, departamento_id: 3, subdivision_id: 12, orden: 13, activo: 1 },
    { id: 14, codigo: 'SJN', empresa_id: 13, departamento_id: 4, subdivision_id: 13, orden: 14, activo: 1 },
    { id: 15, codigo: 'ZN3', empresa_id: 14, departamento_id: 4, subdivision_id: 14, orden: 15, activo: 1 },
    { id: 16, codigo: 'COB', empresa_id: 15, departamento_id: 4, subdivision_id: 15, orden: 16, activo: 1 },
    { id: 17, codigo: 'PET', empresa_id: 16, departamento_id: 4, subdivision_id: 16, orden: 17, activo: 1 },
    { id: 18, codigo: 'PTB', empresa_id: 17, departamento_id: 4, subdivision_id: 17, orden: 18, activo: 1 },
    { id: 19, codigo: 'CHQ', empresa_id: 18, departamento_id: 4, subdivision_id: 18, orden: 19, activo: 1 },
    { id: 20, codigo: 'JTP', empresa_id: 19, departamento_id: 4, subdivision_id: 19, orden: 20, activo: 1 },
    { id: 21, codigo: 'SMS', empresa_id: 20, departamento_id: 5, subdivision_id: 20, orden: 21, activo: 1 },
    { id: 22, codigo: 'CHM', empresa_id: 21, departamento_id: 5, subdivision_id: 21, orden: 22, activo: 1 },
    { id: 23, codigo: 'ESC', empresa_id: 22, departamento_id: 5, subdivision_id: 22, orden: 23, activo: 1 },
    { id: 24, codigo: 'HUE', empresa_id: 23, departamento_id: 5, subdivision_id: 23, orden: 24, activo: 1 },
    { id: 25, codigo: 'MAZ', empresa_id: 24, departamento_id: 5, subdivision_id: 24, orden: 25, activo: 1 },
    { id: 26, codigo: 'VLN', empresa_id: 25, departamento_id: 5, subdivision_id: 25, orden: 26, activo: 1 },
    { id: 27, codigo: 'XEL', empresa_id: 26, departamento_id: 5, subdivision_id: 26, orden: 27, activo: 1 }
  ],
  // analisis_correcciones_18.md #5: un Asesor de Ventas es su propia entidad
  // — su tienda migra 1:1 desde el viejo `usuarios.tienda_id`.
  asesores: [
    { id: 1, usuario_id: 49, tienda_id: 1, telefono: null },
    { id: 2, usuario_id: 50, tienda_id: 1, telefono: null },
    { id: 3, usuario_id: 51, tienda_id: 1, telefono: null },
    { id: 4, usuario_id: 52, tienda_id: 1, telefono: null },
    { id: 5, usuario_id: 53, tienda_id: 1, telefono: null },
    { id: 6, usuario_id: 54, tienda_id: 1, telefono: null },
    { id: 7, usuario_id: 55, tienda_id: 2, telefono: null },
    { id: 8, usuario_id: 56, tienda_id: 2, telefono: null },
    { id: 9, usuario_id: 57, tienda_id: 2, telefono: null },
    { id: 10, usuario_id: 58, tienda_id: 2, telefono: null },
    { id: 11, usuario_id: 59, tienda_id: 2, telefono: null },
    { id: 12, usuario_id: 60, tienda_id: 3, telefono: null },
    { id: 13, usuario_id: 61, tienda_id: 3, telefono: null },
    { id: 14, usuario_id: 62, tienda_id: 3, telefono: null },
    { id: 15, usuario_id: 63, tienda_id: 3, telefono: null },
    { id: 16, usuario_id: 64, tienda_id: 3, telefono: null },
    { id: 17, usuario_id: 65, tienda_id: 3, telefono: null },
    { id: 18, usuario_id: 66, tienda_id: 14, telefono: null },
    { id: 19, usuario_id: 67, tienda_id: 15, telefono: null },
    { id: 20, usuario_id: 68, tienda_id: 16, telefono: null },
    { id: 21, usuario_id: 69, tienda_id: 17, telefono: null },
    { id: 22, usuario_id: 70, tienda_id: 18, telefono: null },
    { id: 23, usuario_id: 71, tienda_id: 19, telefono: null },
    { id: 24, usuario_id: 72, tienda_id: 20, telefono: null },
    { id: 25, usuario_id: 73, tienda_id: 26, telefono: null },
    { id: 26, usuario_id: 74, tienda_id: 23, telefono: null },
    { id: 27, usuario_id: 75, tienda_id: 22, telefono: null },
    { id: 28, usuario_id: 76, tienda_id: 25, telefono: null },
    { id: 29, usuario_id: 77, tienda_id: 27, telefono: null },
    { id: 30, usuario_id: 78, tienda_id: 24, telefono: null },
    { id: 31, usuario_id: 79, tienda_id: 21, telefono: null },
    { id: 32, usuario_id: 80, tienda_id: 4, telefono: null },
    { id: 33, usuario_id: 81, tienda_id: 4, telefono: null },
    { id: 34, usuario_id: 82, tienda_id: 4, telefono: null },
    { id: 35, usuario_id: 83, tienda_id: 4, telefono: null },
    { id: 36, usuario_id: 84, tienda_id: 4, telefono: null },
    { id: 37, usuario_id: 85, tienda_id: 5, telefono: null },
    { id: 38, usuario_id: 86, tienda_id: 6, telefono: null },
    { id: 39, usuario_id: 87, tienda_id: 10, telefono: null },
    { id: 40, usuario_id: 88, tienda_id: 10, telefono: null },
    { id: 41, usuario_id: 89, tienda_id: 9, telefono: null },
    { id: 42, usuario_id: 90, tienda_id: 9, telefono: null },
    { id: 43, usuario_id: 91, tienda_id: 8, telefono: null },
    { id: 44, usuario_id: 92, tienda_id: 11, telefono: null },
    { id: 45, usuario_id: 93, tienda_id: 11, telefono: null },
    { id: 46, usuario_id: 94, tienda_id: 12, telefono: null },
    { id: 47, usuario_id: 95, tienda_id: 13, telefono: null },
    { id: 48, usuario_id: 96, tienda_id: 13, telefono: null }
  ],
  // Un Supervisor de Ventas también es su propia entidad, sin tienda propia
  // — su cobertura vive en `supervisorTiendas` (siguiente).
  supervisores: [
    { id: 1, usuario_id: 13, telefono: null },
    { id: 2, usuario_id: 14, telefono: null },
    { id: 3, usuario_id: 15, telefono: null },
    { id: 4, usuario_id: 16, telefono: null },
    { id: 5, usuario_id: 17, telefono: null },
    { id: 6, usuario_id: 18, telefono: null },
    { id: 7, usuario_id: 19, telefono: null },
    { id: 8, usuario_id: 20, telefono: null },
    { id: 9, usuario_id: 21, telefono: null },
    { id: 10, usuario_id: 22, telefono: null },
    { id: 11, usuario_id: 23, telefono: null },
    { id: 12, usuario_id: 24, telefono: null }
  ],
  // Cobertura de supervisores, por TIENDA (analisis_correcciones_18.md #5:
  // reemplaza `supervisorAsignaciones`, que cubría por departamento/
  // subdivisión — esta es esa cobertura ya EXPANDIDA a tiendas concretas,
  // congelada al momento de la migración). Emilio Morales y Pablo Orellana
  // cubren Trofex R2 al mismo tiempo (supervisores rotativos).
  supervisorTiendas: [
    { id: 1, usuario_id: 13, tienda_id: 1 },
    { id: 2, usuario_id: 13, tienda_id: 2 },
    { id: 3, usuario_id: 14, tienda_id: 2 },
    { id: 4, usuario_id: 15, tienda_id: 3 },
    { id: 5, usuario_id: 16, tienda_id: 4 },
    { id: 6, usuario_id: 16, tienda_id: 5 },
    { id: 7, usuario_id: 16, tienda_id: 6 },
    { id: 8, usuario_id: 16, tienda_id: 7 },
    { id: 9, usuario_id: 16, tienda_id: 8 },
    { id: 10, usuario_id: 16, tienda_id: 9 },
    { id: 11, usuario_id: 16, tienda_id: 10 },
    { id: 12, usuario_id: 16, tienda_id: 11 },
    { id: 13, usuario_id: 16, tienda_id: 12 },
    { id: 14, usuario_id: 16, tienda_id: 13 },
    { id: 15, usuario_id: 17, tienda_id: 4 },
    { id: 16, usuario_id: 17, tienda_id: 5 },
    { id: 17, usuario_id: 17, tienda_id: 6 },
    { id: 18, usuario_id: 17, tienda_id: 7 },
    { id: 19, usuario_id: 17, tienda_id: 8 },
    { id: 20, usuario_id: 17, tienda_id: 9 },
    { id: 21, usuario_id: 17, tienda_id: 10 },
    { id: 22, usuario_id: 17, tienda_id: 11 },
    { id: 23, usuario_id: 17, tienda_id: 12 },
    { id: 24, usuario_id: 17, tienda_id: 13 },
    { id: 25, usuario_id: 18, tienda_id: 14 },
    { id: 26, usuario_id: 18, tienda_id: 15 },
    { id: 27, usuario_id: 18, tienda_id: 16 },
    { id: 28, usuario_id: 18, tienda_id: 17 },
    { id: 29, usuario_id: 18, tienda_id: 18 },
    { id: 30, usuario_id: 18, tienda_id: 19 },
    { id: 31, usuario_id: 18, tienda_id: 20 },
    { id: 32, usuario_id: 18, tienda_id: 21 },
    { id: 33, usuario_id: 18, tienda_id: 22 },
    { id: 34, usuario_id: 18, tienda_id: 23 },
    { id: 35, usuario_id: 18, tienda_id: 24 },
    { id: 36, usuario_id: 18, tienda_id: 25 },
    { id: 37, usuario_id: 18, tienda_id: 26 },
    { id: 38, usuario_id: 18, tienda_id: 27 },
    { id: 39, usuario_id: 19, tienda_id: 21 },
    { id: 40, usuario_id: 19, tienda_id: 22 },
    { id: 41, usuario_id: 19, tienda_id: 23 },
    { id: 42, usuario_id: 19, tienda_id: 24 },
    { id: 43, usuario_id: 19, tienda_id: 25 },
    { id: 44, usuario_id: 19, tienda_id: 26 },
    { id: 45, usuario_id: 19, tienda_id: 27 },
    { id: 46, usuario_id: 20, tienda_id: 4 },
    { id: 47, usuario_id: 20, tienda_id: 5 },
    { id: 48, usuario_id: 20, tienda_id: 6 },
    { id: 49, usuario_id: 21, tienda_id: 10 },
    { id: 50, usuario_id: 22, tienda_id: 9 },
    { id: 51, usuario_id: 22, tienda_id: 8 },
    { id: 52, usuario_id: 23, tienda_id: 11 },
    { id: 53, usuario_id: 23, tienda_id: 12 },
    { id: 54, usuario_id: 24, tienda_id: 13 }
  ],
  // analisis_correcciones_12.md #12: se quitaron moneda_codigo/moneda_simbolo
  // — se sembraban pero ninguna consulta los seleccionaba jamás.
  paises: [
    { id: 1, codigo: 'GT', nombre: 'Guatemala', codigo_telefono: '+502' },
    { id: 2, codigo: 'SV', nombre: 'El Salvador', codigo_telefono: '+503' },
    { id: 3, codigo: 'HN', nombre: 'Honduras', codigo_telefono: '+504' },
    { id: 4, codigo: 'NI', nombre: 'Nicaragua', codigo_telefono: '+505' },
    { id: 5, codigo: 'CR', nombre: 'Costa Rica', codigo_telefono: '+506' },
    { id: 6, codigo: 'BZ', nombre: 'Belice', codigo_telefono: '+501' }
  ],
  valeProductos: [
    { id: 1, codigo: 'PRD-TROF', nombre: 'Trofeo', activo: 1 },
    { id: 2, codigo: 'PRD-MED', nombre: 'Medalla', activo: 1 },
    { id: 3, codigo: 'PRD-PLA', nombre: 'Placa', activo: 1 },
    { id: 4, codigo: 'PRD-BAN', nombre: 'Banner', activo: 1 }
  ],
  valeMateriales: [
    { id: 1, nombre: 'Acrílico', activo: 1 },
    { id: 2, nombre: 'Metal', activo: 1 },
    { id: 3, nombre: 'Madera', activo: 1 },
    { id: 4, nombre: 'Cristal', activo: 1 }
  ],
  // analisis_correcciones_12.md #12: se quitaron vale_tecnicas/vale_acabados
  // (huérfanas desde analisis_correcciones_3.md #1: Técnica/Acabado son
  // textbox libre, ningún código las volvía a consultar) y asesor_limites
  // (el límite diario es colectivo del Supervisor, calculado en vivo).
  // Talleres/departamentos — cada uno con su propio encargado dueño. `tienda_id
  // NULL` = taller de toda la empresa; los "Diseño Local" (analisis_correcciones_12.md
  // #11) están acotados a la tienda que los tiene.
  talleres: [
    { id: 1, nombre: 'Diseño', encargado_id: 5, tienda_id: null, activo: 1 },
    { id: 2, nombre: 'Diseño UV/3D', encargado_id: 6, tienda_id: null, activo: 1 },
    { id: 3, nombre: 'Protextil', encargado_id: 25, tienda_id: null, activo: 1 },
    { id: 4, nombre: 'Diseño Local - P13', encargado_id: 27, tienda_id: 3, activo: 1 },
    { id: 5, nombre: 'Diseño Local - SSV', encargado_id: 29, tienda_id: 4, activo: 1 },
    { id: 6, nombre: 'Diseño Local - SAA', encargado_id: 31, tienda_id: 5, activo: 1 },
    { id: 7, nombre: 'Diseño Local - SMG', encargado_id: 33, tienda_id: 6, activo: 1 },
    { id: 8, nombre: 'Diseño Local - ECL', encargado_id: 35, tienda_id: 7, activo: 1 },
    { id: 9, nombre: 'Diseño Local - CMY', encargado_id: 37, tienda_id: 8, activo: 1 },
    { id: 10, nombre: 'Diseño Local - TEG', encargado_id: 39, tienda_id: 9, activo: 1 },
    { id: 11, nombre: 'Diseño Local - SPS', encargado_id: 41, tienda_id: 10, activo: 1 },
    { id: 12, nombre: 'Diseño Local - MAN', encargado_id: 43, tienda_id: 11, activo: 1 },
    { id: 13, nombre: 'Diseño Local - LEO', encargado_id: 45, tienda_id: 12, activo: 1 },
    { id: 14, nombre: 'Diseño Local - SJO', encargado_id: 47, tienda_id: 13, activo: 1 }
  ],
  // analisis_correcciones_18.md #5: SOLO para "Gestionar personal" — Diseño,
  // Diseño UV/3D y Protextil son compartidos por MTC (1) y MTS (2); cada
  // Diseño Local cubre únicamente su propia tienda. El enrutamiento de vales
  // (a qué taller puede enviar un asesor) sigue gobernado por
  // `talleres.tienda_id`, sin cambios.
  encargadoTienda: [
    { taller_id: 1, tienda_id: 1 }, { taller_id: 1, tienda_id: 2 },
    { taller_id: 2, tienda_id: 1 }, { taller_id: 2, tienda_id: 2 },
    { taller_id: 3, tienda_id: 1 }, { taller_id: 3, tienda_id: 2 },
    { taller_id: 4, tienda_id: 3 }, { taller_id: 5, tienda_id: 4 }, { taller_id: 6, tienda_id: 5 },
    { taller_id: 7, tienda_id: 6 }, { taller_id: 8, tienda_id: 7 }, { taller_id: 9, tienda_id: 8 },
    { taller_id: 10, tienda_id: 9 }, { taller_id: 11, tienda_id: 10 }, { taller_id: 12, tienda_id: 11 },
    { taller_id: 13, tienda_id: 12 }, { taller_id: 14, tienda_id: 13 }
  ],
  // Reemplaza `usuarios.encargado_id` — mismo mapeo técnico→taller de antes.
  tallerTecnicos: [
    // analisis_correcciones_19.md #10: el Asistente (id 11) "clona" Diseño
    // (taller 1) por defecto — configurable desde Editar usuario.
    { usuario_id: 11, taller_id: 1 },
    { usuario_id: 7, taller_id: 1 }, { usuario_id: 8, taller_id: 1 }, { usuario_id: 9, taller_id: 2 },
    { usuario_id: 26, taller_id: 3 },
    { usuario_id: 28, taller_id: 4 }, { usuario_id: 30, taller_id: 5 }, { usuario_id: 32, taller_id: 6 },
    { usuario_id: 34, taller_id: 7 }, { usuario_id: 36, taller_id: 8 }, { usuario_id: 38, taller_id: 9 },
    { usuario_id: 40, taller_id: 10 }, { usuario_id: 42, taller_id: 11 }, { usuario_id: 44, taller_id: 12 },
    { usuario_id: 46, taller_id: 13 }, { usuario_id: 48, taller_id: 14 }
  ],
  vales: [
    { id: 1, correlativo: 'GUA-3-0001', asesor_id: 49, tienda_id: 1, vale_original_id: null, fecha_creacion: '2026-08-19', hora_creacion: '08:30:00', fecha_entrega: '2026-08-22 17:00:00', fecha_evento: '2026-08-25 09:00:00', urgente: 0, cliente_empresa: 'Corporación Deportiva S.A.', cliente_nombre: 'Juan Pérez', cliente_telefono: '+502 5555-1111', cliente_correo: 'juan.perez@corpdeportiva.com', producto_id: 1, material_id: 2, tecnica: 'Grabado Láser', acabado: 'Brillante', cantidad: 50, cotizacion: 1500.00, descripcion: 'Trofeos para premiación anual de ventas.', pdf_url: null, modificado: 0, estado: 'CREADO', creado_en: '2026-08-19 08:30:00', actualizado_en: '2026-08-19 08:30:00' },
    { id: 2, correlativo: 'GUA-3-0002', asesor_id: 49, tienda_id: 1, vale_original_id: null, fecha_creacion: '2026-08-18', hora_creacion: '09:15:00', fecha_entrega: '2026-08-20 17:00:00', fecha_evento: '2026-08-23 09:00:00', urgente: 0, cliente_empresa: 'Liga Guatemalteca', cliente_nombre: 'María López', cliente_telefono: '+502 5555-2222', cliente_correo: 'maria.lopez@liga.gt', producto_id: 2, material_id: 1, tecnica: 'Sublimación', acabado: 'Mate', cantidad: 200, cotizacion: 800.00, descripcion: 'Medallas para maratón centroamericano.', pdf_url: null, modificado: 0, estado: 'CREADO', creado_en: '2026-08-18 09:15:00', actualizado_en: '2026-08-18 09:30:00' },
    { id: 3, correlativo: 'GUA-3-0003', asesor_id: 49, tienda_id: 1, vale_original_id: null, fecha_creacion: '2026-08-17', hora_creacion: '10:00:00', fecha_entrega: '2026-08-21 17:00:00', fecha_evento: '2026-08-24 09:00:00', urgente: 1, cliente_empresa: 'Club Atlético GUA', cliente_nombre: 'Carlos Ruiz', cliente_telefono: '+502 5555-3333', cliente_correo: 'carlos.ruiz@clubgua.com', producto_id: 3, material_id: 3, tecnica: 'Impresión UV', acabado: 'Satinado', cantidad: 30, cotizacion: 950.00, descripcion: 'Placas conmemorativas grabadas en madera.', pdf_url: null, modificado: 0, estado: 'CREADO', creado_en: '2026-08-17 10:00:00', actualizado_en: '2026-08-17 10:30:00' },
    { id: 4, correlativo: 'GUA-3-0004', asesor_id: 49, tienda_id: 1, vale_original_id: null, fecha_creacion: '2026-08-14', hora_creacion: '11:20:00', fecha_entrega: '2026-08-18 17:00:00', fecha_evento: '2026-08-20 09:00:00', urgente: 1, cliente_empresa: 'MundiEventos', cliente_nombre: 'Ana Gómez', cliente_telefono: '+502 5555-4444', cliente_correo: 'ana.gomez@mundieventos.com', producto_id: 1, material_id: 4, tecnica: 'Grabado Láser', acabado: 'Brillante', cantidad: 15, cotizacion: 2200.00, descripcion: 'Trofeos de cristal para gala anual.', pdf_url: null, modificado: 0, estado: 'CREADO', creado_en: '2026-08-14 11:20:00', actualizado_en: '2026-08-17 16:00:00' },
    { id: 5, correlativo: 'GUA-3-0005', asesor_id: 49, tienda_id: 1, vale_original_id: null, fecha_creacion: '2026-08-13', hora_creacion: '08:45:00', fecha_entrega: '2026-08-17 17:00:00', fecha_evento: '2026-08-19 09:00:00', urgente: 0, cliente_empresa: 'Federación Nacional', cliente_nombre: 'Luis Herrera', cliente_telefono: '+502 5555-5555', cliente_correo: 'luis.herrera@fednacional.org', producto_id: 4, material_id: 1, tecnica: 'Impresión UV', acabado: 'Mate', cantidad: 5, cotizacion: 600.00, descripcion: 'Banners UV + trofeos para evento deportivo (dos talleres).', pdf_url: null, modificado: 0, estado: 'CREADO', creado_en: '2026-08-13 08:45:00', actualizado_en: '2026-08-15 12:00:00' },
    { id: 6, correlativo: 'GUA-3-0006', asesor_id: 49, tienda_id: 1, vale_original_id: null, fecha_creacion: '2026-08-10', hora_creacion: '13:00:00', fecha_entrega: '2026-08-15 17:00:00', fecha_evento: '2026-08-16 09:00:00', urgente: 0, cliente_empresa: 'Copa MundiTrofeos', cliente_nombre: 'Diego Alvarado', cliente_telefono: '+502 5555-6666', cliente_correo: 'diego.alvarado@copamt.com', producto_id: 1, material_id: 2, tecnica: 'Grabado Láser', acabado: 'Brillante', cantidad: 100, cotizacion: 3200.00, descripcion: 'Trofeos + banners UV de premiación Copa MundiTrofeos.', pdf_url: null, modificado: 0, estado: 'APROBADO_DEPARTAMENTO', creado_en: '2026-08-10 13:00:00', actualizado_en: '2026-08-12 10:30:00' },
    { id: 7, correlativo: 'GUA-3-0007', asesor_id: 49, tienda_id: 1, vale_original_id: null, fecha_creacion: '2026-08-09', hora_creacion: '15:30:00', fecha_entrega: '2026-08-16 17:00:00', fecha_evento: '2026-08-17 09:00:00', urgente: 0, cliente_empresa: 'Cliente particular', cliente_nombre: 'Sofía Ramírez', cliente_telefono: '+502 5555-7777', cliente_correo: 'sofia.ramirez@correo.com', producto_id: 2, material_id: 1, tecnica: 'Sublimación', acabado: 'Mate', cantidad: 40, cotizacion: 450.00, descripcion: 'Medallas para evento escolar.', pdf_url: null, modificado: 0, estado: 'PENDIENTE_CONFIRMACION', creado_en: '2026-08-09 15:30:00', actualizado_en: '2026-08-15 10:30:00' },
    { id: 8, correlativo: 'GUA-3-0008', asesor_id: 49, tienda_id: 1, vale_original_id: null, fecha_creacion: '2026-08-05', hora_creacion: '10:00:00', fecha_entrega: '2026-08-12 17:00:00', fecha_evento: '2026-08-13 09:00:00', urgente: 0, cliente_empresa: 'Torneo Regional', cliente_nombre: 'Pedro Sandoval', cliente_telefono: '+502 5555-8888', cliente_correo: 'pedro.sandoval@torneoreg.com', producto_id: 1, material_id: 3, tecnica: 'Grabado Láser', acabado: 'Satinado', cantidad: 60, cotizacion: 1800.00, descripcion: 'Trofeos de torneo regional, entregados.', pdf_url: null, modificado: 1, estado: 'RECIBIDO', creado_en: '2026-08-05 10:00:00', actualizado_en: '2026-08-11 12:00:00', autorizado_por: 13, autorizado_en: '2026-08-05 09:30:00', autorizacion_tipo: 'CREACION', confirmado_en: '2026-08-11 12:00:00' },
    { id: 9, correlativo: 'GUA-3-0009', asesor_id: 49, tienda_id: 1, vale_original_id: null, fecha_creacion: '2026-08-04', hora_creacion: '14:00:00', fecha_entrega: '2026-08-11 17:00:00', fecha_evento: '2026-08-12 09:00:00', urgente: 0, cliente_empresa: 'Cliente particular', cliente_nombre: 'Elena Castillo', cliente_telefono: '+502 5555-9999', cliente_correo: 'elena.castillo@correo.com', producto_id: 3, material_id: 2, tecnica: 'Impresión UV', acabado: 'Mate', cantidad: 20, cotizacion: 700.00, descripcion: 'Placas — el cliente pidió ajustar el grabado, asesor solicitó modificación.', pdf_url: null, propuesta_general_url: null, modificado: 0, estado: 'SOLICITANDO_MODIFICACION', creado_en: '2026-08-04 14:00:00', actualizado_en: '2026-08-10 09:30:00' },
    { id: 10, correlativo: 'GUA-3-0010', asesor_id: 49, tienda_id: 1, vale_original_id: null, fecha_creacion: '2026-07-30', hora_creacion: '09:00:00', fecha_entrega: '2026-08-08 17:00:00', fecha_evento: '2026-08-09 09:00:00', urgente: 0, cliente_empresa: 'Club Deportivo Antigua', cliente_nombre: 'Roberto Mejía', cliente_telefono: '+502 5555-1010', cliente_correo: 'roberto.mejia@cdantigua.com', producto_id: 1, material_id: 1, tecnica: 'Grabado Láser', acabado: 'Brillante', cantidad: 80, cotizacion: 2500.00, descripcion: 'Trofeos de campeonato — modificación de acabado en curso.', pdf_url: null, modificado: 0, estado: 'SOLICITANDO_MODIFICACION', creado_en: '2026-07-30 09:00:00', actualizado_en: '2026-08-13 09:00:00' },
    { id: 11, correlativo: 'GUA-3-0011', asesor_id: 49, tienda_id: 1, vale_original_id: null, fecha_creacion: '2026-08-06', hora_creacion: '16:00:00', fecha_entrega: '2026-08-14 17:00:00', fecha_evento: '2026-08-15 09:00:00', urgente: 0, cliente_empresa: 'Asociación Escolar', cliente_nombre: 'Marta Solís', cliente_telefono: '+502 5555-1111', cliente_correo: 'marta.solis@asocescolar.edu', producto_id: 2, material_id: 4, tecnica: 'Sublimación', acabado: 'Satinado', cantidad: 25, cotizacion: 620.00, descripcion: 'Medallas — el logo quedó descentrado, asesor solicitó modificación.', pdf_url: null, modificado: 0, estado: 'SOLICITANDO_MODIFICACION', creado_en: '2026-08-06 16:00:00', actualizado_en: '2026-08-14 09:00:00' },
    { id: 12, correlativo: 'MOD-GUA-3-0008', asesor_id: 49, tienda_id: 1, vale_original_id: 8, fecha_creacion: '2026-08-20', hora_creacion: '11:00:00', fecha_entrega: '2026-08-27 17:00:00', fecha_evento: '2026-08-28 09:00:00', urgente: 0, cliente_empresa: 'Torneo Regional', cliente_nombre: 'Pedro Sandoval', cliente_telefono: '+502 5555-8888', cliente_correo: 'pedro.sandoval@torneoreg.com', producto_id: 1, material_id: 3, tecnica: 'Grabado Láser', acabado: 'Brillante', cantidad: 60, cotizacion: 1800.00, descripcion: 'El cliente solicitó cambiar el acabado de satinado a brillante para hacer juego con el resto del set de premiación.', pdf_url: null, modificado: 0, estado: 'MODIFICADO', creado_en: '2026-08-20 11:00:00', actualizado_en: '2026-08-20 11:00:00', autorizado_por: 13, autorizado_en: '2026-08-20 11:00:00', autorizacion_tipo: 'MODIFICACION' },
    // analisis_correcciones_10.md #5: vale de demostración recién creado,
    // esperando que el Supervisor lo autorice — sin filas en valeTalleres todavía.
    { id: 13, correlativo: 'GUA-3-0012', asesor_id: 49, tienda_id: 1, vale_original_id: null, fecha_creacion: '2026-08-26', hora_creacion: '08:00:00', fecha_entrega: '2026-08-30 17:00:00', fecha_evento: '2026-08-31 09:00:00', urgente: 0, cliente_empresa: 'Cliente particular', cliente_nombre: 'Fernando Ixchop', cliente_telefono: '+502 5555-1212', cliente_correo: 'fernando.ixchop@correo.com', producto_id: 1, material_id: 1, tecnica: 'Grabado Láser', acabado: 'Brillante', cantidad: 10, cotizacion: 900.00, descripcion: 'Trofeos recién creados, esperando autorización del Supervisor.', pdf_url: null, modificado: 0, talleres_solicitados: '1', estado: 'ESPERANDO_AUTORIZACION', creado_en: '2026-08-26 08:00:00', actualizado_en: '2026-08-26 08:00:00' }
  ].map(v => ({
    ...v,
    propuesta_general_url: v.propuesta_general_url ?? null,
    talleres_solicitados: v.talleres_solicitados ?? null,
    autorizado_por: v.autorizado_por ?? null,
    autorizado_en: v.autorizado_en ?? null,
    autorizacion_tipo: v.autorizacion_tipo ?? null,
    confirmado_en: v.confirmado_en ?? null,
    atraso_notificado_en: v.atraso_notificado_en ?? null,
    fusionado_por: v.fusionado_por ?? null,
    fusionado_en: v.fusionado_en ?? null
  })),
  // vale_talleres reemplaza a la vieja vale_asignaciones: una fila por
  // (vale, taller), es el progreso real de cada taller dentro de un vale.
  valeTalleres: [
    { id: 1, vale_id: 1, taller_id: 1, tecnico_id: null, estado: 'PENDIENTE_ASIGNACION', fecha_asignacion: null, activo: 1 },
    { id: 2, vale_id: 2, taller_id: 1, tecnico_id: 7, estado: 'ASIGNADO', fecha_asignacion: '2026-08-18 09:30:00', activo: 1 },
    { id: 3, vale_id: 3, taller_id: 1, tecnico_id: 7, estado: 'EN_PROCESO', fecha_asignacion: '2026-08-17 10:30:00', activo: 1 },
    { id: 4, vale_id: 4, taller_id: 1, tecnico_id: 8, estado: 'EN_REVISION', fecha_asignacion: '2026-08-14 11:45:00', activo: 1 },
    { id: 5, vale_id: 5, taller_id: 1, tecnico_id: 7, estado: 'EN_PROCESO', fecha_asignacion: '2026-08-13 09:15:00', activo: 1 },
    { id: 6, vale_id: 5, taller_id: 2, tecnico_id: 9, estado: 'APROBADO', fecha_asignacion: '2026-08-13 09:00:00', activo: 1 },
    { id: 7, vale_id: 6, taller_id: 1, tecnico_id: 7, estado: 'APROBADO', fecha_asignacion: '2026-08-10 13:20:00', activo: 1 },
    { id: 8, vale_id: 6, taller_id: 2, tecnico_id: 9, estado: 'APROBADO', fecha_asignacion: '2026-08-10 13:25:00', activo: 1 },
    { id: 9, vale_id: 7, taller_id: 1, tecnico_id: 8, estado: 'APROBADO', fecha_asignacion: '2026-08-09 16:00:00', activo: 1 },
    { id: 10, vale_id: 8, taller_id: 1, tecnico_id: 7, estado: 'APROBADO', fecha_asignacion: '2026-08-05 12:00:00', activo: 1 },
    { id: 11, vale_id: 9, taller_id: 1, tecnico_id: 8, estado: 'APROBADO', fecha_asignacion: '2026-08-04 15:00:00', activo: 1 },
    { id: 12, vale_id: 10, taller_id: 1, tecnico_id: 7, estado: 'APROBADO', fecha_asignacion: '2026-07-30 10:00:00', activo: 1 },
    { id: 13, vale_id: 11, taller_id: 1, tecnico_id: 8, estado: 'APROBADO', fecha_asignacion: '2026-08-13 15:00:00', activo: 1 },
    // vale 12 (MOD-GUA-3-0008, MODIFICADO): desde analisis_correcciones_12.md
    // #11 el fan-out a talleres es INMEDIATO al aprobar la modificación (ya no
    // hay un paso de "reenvío" aparte) — nace con su fila igual que un vale
    // nuevo autorizado.
    { id: 14, vale_id: 12, taller_id: 1, tecnico_id: null, estado: 'PENDIENTE_ASIGNACION', fecha_asignacion: null, activo: 1 }
  ],
  // analisis_correcciones_12.md #12: se quitaron es_cancelacion (la cancelación
  // ahora solo se registra en valeHistorial, sin fila "en blanco" en esta tabla)
  // y fecha_subida (redundante con creado_en).
  valePropuestas: [
    { id: 1, vale_id: 4, tecnico_id: 8, url: null },
    { id: 2, vale_id: 5, tecnico_id: 9, url: null },
    { id: 3, vale_id: 6, tecnico_id: 7, url: null },
    { id: 4, vale_id: 6, tecnico_id: 9, url: null },
    { id: 5, vale_id: 7, tecnico_id: 8, url: null },
    { id: 6, vale_id: 8, tecnico_id: 7, url: null },
    { id: 7, vale_id: 9, tecnico_id: 8, url: null },
    { id: 8, vale_id: 10, tecnico_id: 7, url: null }
  ],
  valeDocumentos: [],
  valeSolicitudesModificacion: [
    { id: 1, vale_original_id: 10, asesor_id: 49, fecha_entrega: '2026-08-08 17:00:00', fecha_evento: '2026-08-09 09:00:00', urgente: 0, cliente_empresa: 'Club Deportivo Antigua', cliente_nombre: 'Roberto Mejía', cliente_telefono: '+502 5555-1010', cliente_correo: 'roberto.mejia@cdantigua.com', producto_id: 1, material_id: 1, tecnica: 'Grabado Láser', acabado: 'Mate', cantidad: 80, cotizacion: 2500.00, talleres_ids: '1', justificacion: 'El cliente pidió cambiar el acabado de brillante a mate.', estado: 'PENDIENTE', creado_en: '2026-08-13 09:00:00' },
    // Antes representaban vales EN_CORRECCION (estado eliminado — ver
    // analisis_correcciones_5.md #5): ahora, como cualquier otra corrección,
    // el asesor solicita modificación en vez de "rechazar".
    { id: 2, vale_original_id: 9, asesor_id: 49, fecha_entrega: '2026-08-11 17:00:00', fecha_evento: '2026-08-12 09:00:00', urgente: 0, cliente_empresa: 'Cliente particular', cliente_nombre: 'Elena Castillo', cliente_telefono: '+502 5555-9999', cliente_correo: 'elena.castillo@correo.com', producto_id: 3, material_id: 2, tecnica: 'Impresión UV', acabado: 'Mate', cantidad: 20, cotizacion: 700.00, talleres_ids: '1', justificacion: 'El cliente pidió ajustar el grabado.', estado: 'PENDIENTE', creado_en: '2026-08-10 09:30:00' },
    { id: 3, vale_original_id: 11, asesor_id: 49, fecha_entrega: '2026-08-14 17:00:00', fecha_evento: '2026-08-15 09:00:00', urgente: 0, cliente_empresa: 'Asociación Escolar', cliente_nombre: 'Marta Solís', cliente_telefono: '+502 5555-1111', cliente_correo: 'marta.solis@asocescolar.edu', producto_id: 2, material_id: 4, tecnica: 'Sublimación', acabado: 'Satinado', cantidad: 25, cotizacion: 620.00, talleres_ids: '1', justificacion: 'El logo quedó descentrado.', estado: 'PENDIENTE', creado_en: '2026-08-14 08:00:00' }
  ],
  // `taller_id` es NULL en eventos de nivel de vale (visibles para todos los roles
  // con acceso al vale) y apunta al taller correspondiente en eventos internos de
  // un taller (analisis_correcciones_4.md #12: un encargado/técnico de OTRO taller
  // no debe ver estos últimos).
  valeHistorial: [
    { id: 1, vale_id: 1, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor (taller: Diseño)', creado_en: '2026-08-19 08:30:00' },
    { id: 2, vale_id: 2, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor (taller: Diseño)', creado_en: '2026-08-18 09:15:00' },
    { id: 3, vale_id: 2, usuario_id: 5, taller_id: 1, tecnico_id: null, estado_anterior: 'PENDIENTE_ASIGNACION', estado_nuevo: 'ASIGNADO', accion: 'Encargado de Diseño asignó a Técnico Diseño A', creado_en: '2026-08-18 09:30:00' },
    { id: 4, vale_id: 3, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor (taller: Diseño)', creado_en: '2026-08-17 10:00:00' },
    { id: 5, vale_id: 3, usuario_id: 5, taller_id: 1, tecnico_id: null, estado_anterior: 'PENDIENTE_ASIGNACION', estado_nuevo: 'ASIGNADO', accion: 'Encargado de Diseño asignó a Técnico Diseño A', creado_en: '2026-08-17 10:30:00' },
    { id: 6, vale_id: 3, usuario_id: 7, taller_id: 1, tecnico_id: null, estado_anterior: 'ASIGNADO', estado_nuevo: 'EN_PROCESO', accion: 'Técnico marcó el vale como en proceso', creado_en: '2026-08-17 11:00:00' },
    { id: 7, vale_id: 4, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor (taller: Diseño)', creado_en: '2026-08-14 11:20:00' },
    { id: 8, vale_id: 4, usuario_id: 5, taller_id: 1, tecnico_id: null, estado_anterior: 'PENDIENTE_ASIGNACION', estado_nuevo: 'ASIGNADO', accion: 'Encargado de Diseño asignó a Técnico Diseño B', creado_en: '2026-08-14 11:45:00' },
    { id: 9, vale_id: 4, usuario_id: 8, taller_id: 1, tecnico_id: null, estado_anterior: 'ASIGNADO', estado_nuevo: 'EN_REVISION', accion: 'Técnico entregó propuesta', creado_en: '2026-08-17 16:00:00' },
    { id: 10, vale_id: 5, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor (talleres: Diseño, Diseño UV/3D)', creado_en: '2026-08-13 08:45:00' },
    { id: 11, vale_id: 5, usuario_id: 6, taller_id: 2, tecnico_id: null, estado_anterior: 'PENDIENTE_ASIGNACION', estado_nuevo: 'ASIGNADO', accion: 'Encargado UV/3D asignó a Técnico UV/3D C', creado_en: '2026-08-13 09:00:00' },
    { id: 12, vale_id: 5, usuario_id: 9, taller_id: 2, tecnico_id: null, estado_anterior: 'EN_PROCESO', estado_nuevo: 'EN_REVISION', accion: 'Técnico UV/3D entregó propuesta', creado_en: '2026-08-15 12:00:00' },
    { id: 13, vale_id: 5, usuario_id: 6, taller_id: 2, tecnico_id: null, estado_anterior: 'EN_REVISION', estado_nuevo: 'APROBADO', accion: 'Encargado UV/3D aprobó la propuesta de su taller', creado_en: '2026-08-15 12:30:00' },
    { id: 14, vale_id: 6, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor (talleres: Diseño, Diseño UV/3D)', creado_en: '2026-08-10 13:00:00' },
    { id: 15, vale_id: 6, usuario_id: 5, taller_id: 1, tecnico_id: null, estado_anterior: 'EN_REVISION', estado_nuevo: 'APROBADO', accion: 'Encargado de Diseño aprobó la propuesta de su taller', creado_en: '2026-08-12 10:00:00' },
    { id: 16, vale_id: 6, usuario_id: 6, taller_id: 2, tecnico_id: null, estado_anterior: 'EN_REVISION', estado_nuevo: 'APROBADO', accion: 'Encargado UV/3D aprobó la propuesta de su taller', creado_en: '2026-08-12 10:20:00' },
    { id: 17, vale_id: 6, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: 'CREADO', estado_nuevo: 'APROBADO_DEPARTAMENTO', accion: 'Ambos talleres aprobaron — pendiente de fusión por Encargado General', creado_en: '2026-08-12 10:30:00' },
    { id: 18, vale_id: 7, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor (taller: Diseño)', creado_en: '2026-08-09 15:30:00' },
    { id: 19, vale_id: 7, usuario_id: 5, taller_id: 1, tecnico_id: null, estado_anterior: 'EN_REVISION', estado_nuevo: 'APROBADO', accion: 'Encargado de Diseño aprobó la propuesta', creado_en: '2026-08-15 10:00:00' },
    { id: 20, vale_id: 7, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: 'CREADO', estado_nuevo: 'PENDIENTE_CONFIRMACION', accion: 'Único taller aprobado — pasa directo a confirmación del asesor', creado_en: '2026-08-15 10:30:00' },
    { id: 21, vale_id: 8, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor (taller: Diseño)', creado_en: '2026-08-05 10:00:00' },
    { id: 22, vale_id: 8, usuario_id: 5, taller_id: 1, tecnico_id: null, estado_anterior: 'EN_REVISION', estado_nuevo: 'APROBADO', accion: 'Encargado de Diseño aprobó la propuesta', creado_en: '2026-08-11 09:00:00' },
    { id: 23, vale_id: 8, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: 'CREADO', estado_nuevo: 'PENDIENTE_CONFIRMACION', accion: 'Único taller aprobado — pasa directo a confirmación del asesor', creado_en: '2026-08-11 09:30:00' },
    { id: 24, vale_id: 8, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: 'PENDIENTE_CONFIRMACION', estado_nuevo: 'RECIBIDO', accion: 'Asesor confirmó de recibido el vale de arte', creado_en: '2026-08-11 12:00:00' },
    { id: 25, vale_id: 9, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor (taller: Diseño)', creado_en: '2026-08-04 14:00:00' },
    { id: 26, vale_id: 9, usuario_id: 5, taller_id: 1, tecnico_id: null, estado_anterior: 'EN_REVISION', estado_nuevo: 'APROBADO', accion: 'Encargado de Diseño aprobó la propuesta', creado_en: '2026-08-10 09:00:00' },
    { id: 27, vale_id: 9, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: 'CREADO', estado_nuevo: 'PENDIENTE_CONFIRMACION', accion: 'Único taller aprobado — pasa directo a confirmación del asesor', creado_en: '2026-08-10 09:15:00' },
    { id: 28, vale_id: 9, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: 'PENDIENTE_CONFIRMACION', estado_nuevo: 'SOLICITANDO_MODIFICACION', accion: 'Asesor solicitó modificación', creado_en: '2026-08-10 09:30:00' },
    { id: 29, vale_id: 10, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor (taller: Diseño)', creado_en: '2026-07-30 09:00:00' },
    { id: 30, vale_id: 10, usuario_id: 5, taller_id: 1, tecnico_id: null, estado_anterior: 'EN_REVISION', estado_nuevo: 'APROBADO', accion: 'Encargado de Diseño aprobó la propuesta', creado_en: '2026-08-06 09:00:00' },
    { id: 31, vale_id: 10, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: 'CREADO', estado_nuevo: 'PENDIENTE_CONFIRMACION', accion: 'Único taller aprobado — pasa directo a confirmación del asesor', creado_en: '2026-08-06 09:30:00' },
    { id: 32, vale_id: 10, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: 'PENDIENTE_CONFIRMACION', estado_nuevo: 'RECIBIDO', accion: 'Asesor confirmó de recibido el vale de arte', creado_en: '2026-08-06 10:00:00' },
    { id: 33, vale_id: 10, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: 'RECIBIDO', estado_nuevo: 'SOLICITANDO_MODIFICACION', accion: 'Asesor solicitó modificación de acabado', creado_en: '2026-08-13 09:00:00' },
    { id: 34, vale_id: 11, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor (taller: Diseño)', creado_en: '2026-08-06 16:00:00' },
    { id: 35, vale_id: 11, usuario_id: 5, taller_id: 1, tecnico_id: null, estado_anterior: 'EN_REVISION', estado_nuevo: 'APROBADO', accion: 'Encargado de Diseño aprobó la propuesta', creado_en: '2026-08-13 15:00:00' },
    { id: 36, vale_id: 11, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: 'CREADO', estado_nuevo: 'PENDIENTE_CONFIRMACION', accion: 'Único taller aprobado — pasa directo a confirmación del asesor', creado_en: '2026-08-13 15:30:00' },
    { id: 37, vale_id: 11, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: 'PENDIENTE_CONFIRMACION', estado_nuevo: 'SOLICITANDO_MODIFICACION', accion: 'Asesor solicitó modificación', creado_en: '2026-08-14 08:00:00' },
    { id: 38, vale_id: 12, usuario_id: 13, taller_id: null, tecnico_id: null, estado_anterior: null, estado_nuevo: 'MODIFICADO', accion: 'Supervisor aprobó la solicitud de modificación — se creó el vale MOD-GUA-3-0008', creado_en: '2026-08-20 11:00:00' },
    { id: 39, vale_id: 13, usuario_id: 49, taller_id: null, tecnico_id: null, estado_anterior: null, estado_nuevo: 'ESPERANDO_AUTORIZACION', accion: 'Vale de arte creado por el asesor — esperando autorización del Supervisor (taller solicitado: Diseño)', creado_en: '2026-08-26 08:00:00' }
  ],
  // analisis_correcciones_13.md #6: fila única (id fijo = 1) con el estado del
  // Modo Mantenimiento del panel de Administrador.
  mantenimientoConfig: [
    { id: 1, activo: 0, mensaje: null, activado_por: null, activado_en: null }
  ]
};

function nextId(collection) {
  return collection.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

// Timestamp local 'YYYY-MM-DD HH:MM:SS' (consistente con horaActual() del servicio,
// que también usa hora local) — evita mezclar UTC y hora local en el mismo registro.
function sinPasswordHash(usuario) {
  const { password_hash, ...resto } = usuario;
  return resto;
}

// analisis_correcciones_18.md #5: una tienda ya no tiene `pais_id`/`nombre`
// propios — el país se resuelve vía su empresa, y el nombre a mostrar se
// deriva como "{EMPRESA}, {SUBDIVISIÓN}" (o solo "{EMPRESA}" si no tiene
// subdivisión). Factorizado aquí porque lo necesitan el mock de tiendas, el
// listado de usuarios (tienda_nombre) y el catálogo de vales.
function empresaDeTienda(tienda) {
  return tienda ? mockDatabase.empresas.find(e => e.id === tienda.empresa_id) : null;
}

function paisIdDeTienda(tienda) {
  const empresa = empresaDeTienda(tienda);
  return empresa ? empresa.pais_id : null;
}

function nombreTienda(tienda) {
  if (!tienda) return null;
  const empresa = empresaDeTienda(tienda);
  const nombreEmpresa = empresa ? empresa.nombre : '';
  const subdivision = tienda.subdivision_id ? mockDatabase.subdivisiones.find(s => s.id === tienda.subdivision_id) : null;
  return subdivision ? `${nombreEmpresa}, ${subdivision.nombre}` : nombreEmpresa;
}

// analisis_correcciones_18.md #5: un Asesor de Ventas (rol 2) o Supervisor de
// Ventas (rol 3) ya no guarda `tienda_id`/`telefono` en `usuarios` — vive en
// su fila satélite (`asesores`/`supervisores`). Expone esos campos sobre el
// usuario genérico para que el resto del código (que sigue leyendo
// `usuario.tienda_id`/`usuario.telefono`) no tenga que saber de dónde salen.
function enriquecerUsuario(u) {
  if (!u) return u;
  if (u.rol_id === 2) {
    const asesor = mockDatabase.asesores.find(a => a.usuario_id === u.id);
    return { ...u, tienda_id: asesor ? asesor.tienda_id : null, telefono: asesor ? asesor.telefono : null };
  }
  if (u.rol_id === 3) {
    const supervisor = mockDatabase.supervisores.find(s => s.usuario_id === u.id);
    return { ...u, tienda_id: null, telefono: supervisor ? supervisor.telefono : null };
  }
  // analisis_correcciones_19.md #10: el Asistente (rol 7) reutiliza la misma
  // relación usuario→taller que un Técnico — el suyo es el taller que "clona".
  if (u.rol_id === 6 || u.rol_id === 7) {
    const rel = mockDatabase.tallerTecnicos.find(tt => tt.usuario_id === u.id);
    return { ...u, taller_id: rel ? rel.taller_id : null };
  }
  // analisis_correcciones_19.md #8/#12: encargados de taller (fijo por rol en
  // 4/5/9, elegible en 10) — su taller sale de `talleres.encargado_id`, para
  // que "Editar usuario" pueda preseleccionarlo/mostrarlo.
  if ([4, 5, 9, 10].includes(u.rol_id)) {
    const taller = mockDatabase.talleres.find(t => t.encargado_id === u.id);
    return { ...u, taller_id: taller ? taller.id : null };
  }
  return u;
}

// analisis_correcciones_18.md #5: tiendas que cubre un supervisor — ahora una
// relación directa por tienda (`supervisorTiendas`), sin departamento ni
// subdivisión de por medio. Misma regla que los handlers
// `usuario:find_*_by_supervisor`, factorizada porque el panel de
// Administrador la necesita también (personal de una tienda, países
// asignados de un supervisor).
function tiendasCubiertasPorSupervisor(supervisorId) {
  const tiendaIds = new Set(mockDatabase.supervisorTiendas.filter(st => st.usuario_id === supervisorId).map(st => st.tienda_id));
  return mockDatabase.tiendas.filter(t => tiendaIds.has(t.id));
}

function ahoraLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function initializeDatabase() {
  try {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Probar conexión rápida
    const conn = await pool.getConnection();
    console.log(`[Database] Conectado exitosamente a la base de datos MySQL en ${config.db.host}:${config.db.port}`);
    conn.release();
  } catch (error) {
    console.warn(`[Database] [WARNING] No se pudo conectar a la base de datos física: ${error.message}`);
    console.warn('[Database] [INFO] Activando fallback de base de datos en memoria (Modo Mock).');
    useMock = true;
  }
}

/**
 * Métodos de consulta compatibles para abstraer consultas SQL o Mock.
 * `tag` es un identificador corto y explícito de la operación (ej. 'vale:insert').
 * MySQL real lo ignora por completo (el SQL parametrizado corre tal cual);
 * el modo Mock lo usa para saber exactamente qué operación in-memory ejecutar,
 * evitando parsear/adivinar el SQL dinámico de cada repositorio.
 */
async function query(sql, params = [], tag = null) {
  if (useMock) {
    return handleMockQuery(sql, params, tag);
  }
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error(`[Database] Error ejecutando consulta SQL: ${sql}`, error);
    throw error;
  }
}

// -------------------------------------------------------------------------
// Handlers de operaciones "taggeadas" (módulo Vales de Arte y catálogos)
// -------------------------------------------------------------------------
const taggedHandlers = {
  'catalog:tiendas': () => mockDatabase.tiendas.filter(t => t.activo)
    .map(t => ({ id: t.id, codigo: t.codigo, pais_id: paisIdDeTienda(t), departamento_id: t.departamento_id, subdivision_id: t.subdivision_id, nombre: nombreTienda(t) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  'catalog:productos': () => mockDatabase.valeProductos.filter(p => p.activo),
  'catalog:materiales': () => mockDatabase.valeMateriales.filter(m => m.activo),
  'catalog:paises': () => mockDatabase.paises,

  // Estas consultas nunca deben exponer password_hash: a diferencia de MySQL real (que
  // solo devuelve las columnas listadas en el SELECT), el mock ignora el SQL, así que
  // hay que despojar el hash explícitamente antes de regresar los objetos.
  'usuario:find_by_id': (params) => {
    const u = mockDatabase.usuarios.find(x => x.id === Number(params[0]));
    return u ? [sinPasswordHash(enriquecerUsuario(u))] : [];
  },
  // analisis_correcciones_18.md #5: reemplaza `usuarios.encargado_id` — el
  // taller de este encargado sale de `talleres.encargado_id` (sin cambios) y
  // sus técnicos, de `tallerTecnicos` (antes: técnicos con ese mismo
  // encargado_id).
  'usuario:find_tecnicos_by_encargado': (params) => {
    const encargadoId = Number(params[0]);
    const taller = mockDatabase.talleres.find(t => t.encargado_id === encargadoId);
    if (!taller) return [];
    const tecnicoIds = new Set(mockDatabase.tallerTecnicos.filter(tt => tt.taller_id === taller.id).map(tt => tt.usuario_id));
    return mockDatabase.usuarios
      .filter(u => u.rol_id === 6 && u.activo && tecnicoIds.has(u.id))
      .map(u => sinPasswordHash(enriquecerUsuario(u)));
  },
  'usuario:find_encargados': () => {
    return mockDatabase.usuarios.filter(u => (u.rol_id === 4 || u.rol_id === 5) && u.activo).map(sinPasswordHash);
  },
  'usuario:find_by_rol': (params) => {
    return mockDatabase.usuarios.filter(u => u.rol_id === Number(params[0]) && u.activo).map(u => sinPasswordHash(enriquecerUsuario(u)));
  },
  // analisis_correcciones_10.md #11: asesores (rol 2) a cargo de un Supervisor.
  // analisis_correcciones_18.md #5: un asesor está cubierto por un supervisor
  // si su tienda (`asesores.tienda_id`) aparece en `supervisorTiendas` para
  // ese supervisor — relación directa por tienda, sin departamento/
  // subdivisión de por medio.
  'usuario:find_asesores_by_supervisor': (params) => {
    const supervisorId = Number(params[0]);
    const tiendaIds = new Set(mockDatabase.supervisorTiendas.filter(st => st.usuario_id === supervisorId).map(st => st.tienda_id));
    return mockDatabase.usuarios
      .filter(u => u.rol_id === 2 && u.activo)
      .map(enriquecerUsuario)
      .filter(u => u.tienda_id != null && tiendaIds.has(u.tienda_id))
      .map(sinPasswordHash);
  },
  // Inverso: todos los supervisores que cubren la tienda de un asesor dado
  // (puede haber más de uno — supervisores rotativos).
  'usuario:find_supervisores_by_asesor': (params) => {
    const asesor = mockDatabase.asesores.find(a => a.usuario_id === Number(params[0]));
    if (!asesor || asesor.tienda_id == null) return [];
    return mockDatabase.usuarios
      .filter(u => u.rol_id === 3 && u.activo)
      .filter(u => mockDatabase.supervisorTiendas.some(st => st.usuario_id === u.id && st.tienda_id === asesor.tienda_id))
      .map(sinPasswordHash);
  },

  // Talleres — catálogo simple usado por el selector de tags de creación.
  'taller:list': () => mockDatabase.talleres.filter(t => t.activo),
  'taller:find_by_id': (params) => {
    const t = mockDatabase.talleres.find(x => x.id === Number(params[0]));
    return t ? [t] : [];
  },

  // analisis_correcciones_19.md #8/#10/#12: asignación de talleres desde
  // "Editar usuario" — antes nada escribía encargado_id/taller_tecnicos
  // fuera del seed.
  'taller_admin:list': () => mockDatabase.talleres.filter(t => t.activo),
  'taller_admin:find_by_id': (params) => {
    const t = mockDatabase.talleres.find(x => x.id === Number(params[0]));
    return t ? [t] : [];
  },
  'taller_admin:asignar_encargado': (params) => {
    const [usuarioId, tallerId] = params;
    const t = mockDatabase.talleres.find(x => x.id === Number(tallerId));
    if (!t) return { affectedRows: 0 };
    t.encargado_id = Number(usuarioId);
    return { affectedRows: 1 };
  },
  'taller_admin:quitar_encargado_de': (params) => {
    const usuarioId = Number(params[0]);
    let afectados = 0;
    mockDatabase.talleres.forEach(t => {
      if (t.encargado_id === usuarioId) { t.encargado_id = null; afectados++; }
    });
    return { affectedRows: afectados };
  },
  'taller_tecnico:asignar': (params) => {
    const [usuarioId, tallerId] = params;
    const uId = Number(usuarioId);
    const existente = mockDatabase.tallerTecnicos.find(tt => tt.usuario_id === uId);
    if (existente) { existente.taller_id = Number(tallerId); }
    else { mockDatabase.tallerTecnicos.push({ usuario_id: uId, taller_id: Number(tallerId) }); }
    return { affectedRows: 1 };
  },
  'taller_tecnico:quitar': (params) => {
    const uId = Number(params[0]);
    const antes = mockDatabase.tallerTecnicos.length;
    mockDatabase.tallerTecnicos = mockDatabase.tallerTecnicos.filter(tt => tt.usuario_id !== uId);
    return { affectedRows: antes - mockDatabase.tallerTecnicos.length };
  },

  'vale:insert': (params) => {
    const [correlativo, asesorId, tiendaId, valeOriginalId, fechaCreacion, horaCreacion, fechaEntrega, fechaEvento,
      urgente, clienteEmpresa, clienteNombre, clienteTelefono, clienteCorreo, productoId, materialId, tecnica, acabado,
      cantidad, cotizacion, descripcion, estado, talleresSolicitados, autorizadoPor, autorizadoEn, autorizacionTipo] = params;
    const now = ahoraLocal();
    const row = {
      id: nextId(mockDatabase.vales), correlativo, asesor_id: Number(asesorId), tienda_id: Number(tiendaId),
      vale_original_id: valeOriginalId ? Number(valeOriginalId) : null,
      fecha_creacion: fechaCreacion, hora_creacion: horaCreacion, fecha_entrega: fechaEntrega, fecha_evento: fechaEvento,
      urgente: urgente ? 1 : 0, cliente_empresa: clienteEmpresa || null, cliente_nombre: clienteNombre,
      cliente_telefono: clienteTelefono, cliente_correo: clienteCorreo, producto_id: productoId || null,
      material_id: materialId || null, tecnica, acabado,
      cantidad: Number(cantidad), cotizacion: Number(cotizacion), descripcion: descripcion || null,
      pdf_url: null, propuesta_general_url: null, modificado: 0,
      fusionado_por: null, fusionado_en: null,
      atraso_congelado_en: null, atraso_notificado_en: null,
      talleres_solicitados: talleresSolicitados || null,
      autorizado_por: autorizadoPor ? Number(autorizadoPor) : null,
      autorizado_en: autorizadoEn || null,
      autorizacion_tipo: autorizacionTipo || null,
      confirmado_en: null,
      estado: estado || 'CREADO', creado_en: now, actualizado_en: now
    };
    mockDatabase.vales.push(row);
    return { insertId: row.id };
  },
  'vale:find_by_id': (params) => {
    // Copia superficial: si devolviéramos la referencia viva, mutaciones posteriores
    // (p. ej. actualizarEstado) alterarían retroactivamente un `vale` ya leído antes
    // en el mismo flujo (por eso a veces estado_anterior == estado_nuevo en historial).
    const v = mockDatabase.vales.find(x => x.id === Number(params[0]));
    return v ? [{ ...v }] : [];
  },
  'vale:list_all': () => mockDatabase.vales,
  // Vale MOD- que reemplaza a este original, si ya fue aprobada su modificación
  // (analisis_correcciones_5.md #4 — "Ver PDF" resuelve al vale vigente).
  'vale:find_by_original_id': (params) => {
    const v = mockDatabase.vales.find(x => x.vale_original_id === Number(params[0]));
    return v ? [{ ...v }] : [];
  },
  'vale:count_por_asesor': (params) => {
    const count = mockDatabase.vales.filter(v => v.asesor_id === Number(params[0])).length;
    return [{ total: count }];
  },
  'vale:update_estado': (params) => {
    const [estado, id] = params;
    const v = mockDatabase.vales.find(x => x.id === Number(id));
    if (v) {
      v.estado = estado;
      v.actualizado_en = ahoraLocal();
    }
    return { affectedRows: v ? 1 : 0 };
  },
  'vale:update_pdf_url': (params) => {
    const [pdfUrl, id] = params;
    const v = mockDatabase.vales.find(x => x.id === Number(id));
    if (v) v.pdf_url = pdfUrl;
    return { affectedRows: v ? 1 : 0 };
  },
  'vale:marcar_modificado': (params) => {
    const id = Number(params[0]);
    const v = mockDatabase.vales.find(x => x.id === id);
    if (v) v.modificado = 1;
    return { affectedRows: v ? 1 : 0 };
  },
  'vale:congelar_atraso': (params) => {
    const [fechaHora, id] = params;
    const v = mockDatabase.vales.find(x => x.id === Number(id));
    const yaEstabaCongelado = !v || !!v.atraso_congelado_en;
    if (v && !v.atraso_congelado_en) v.atraso_congelado_en = fechaHora;
    return { affectedRows: yaEstabaCongelado ? 0 : 1 };
  },
  'vale:update_propuesta_general': (params) => {
    const [url, id] = params;
    const v = mockDatabase.vales.find(x => x.id === Number(id));
    if (v) v.propuesta_general_url = url;
    return { affectedRows: v ? 1 : 0 };
  },
  // analisis_correcciones_10.md #5/#6: sella quién/cuándo autorizó.
  'vale:sellar_autorizacion': (params) => {
    const [autorizadoPor, autorizadoEn, autorizacionTipo, id] = params;
    const v = mockDatabase.vales.find(x => x.id === Number(id));
    if (v) {
      v.autorizado_por = autorizadoPor ? Number(autorizadoPor) : null;
      v.autorizado_en = autorizadoEn || null;
      v.autorizacion_tipo = autorizacionTipo || null;
    }
    return { affectedRows: v ? 1 : 0 };
  },
  // analisis_correcciones_16.md #4/#5: sella quién/cuándo fusionó.
  'vale:sellar_fusion': (params) => {
    const [fusionadoPor, fusionadoEn, id] = params;
    const v = mockDatabase.vales.find(x => x.id === Number(id));
    if (v) {
      v.fusionado_por = fusionadoPor ? Number(fusionadoPor) : null;
      v.fusionado_en = fusionadoEn || null;
    }
    return { affectedRows: v ? 1 : 0 };
  },
  // analisis_correcciones_10.md #7: sella cuándo se confirmó de recibido.
  'vale:sellar_confirmacion': (params) => {
    const [fechaHora, id] = params;
    const v = mockDatabase.vales.find(x => x.id === Number(id));
    if (v) v.confirmado_en = fechaHora;
    return { affectedRows: v ? 1 : 0 };
  },
  // analisis_correcciones_10.md #11: cuenta autorizaciones de CREACIÓN de este
  // Supervisor en el día indicado (comparando solo la parte de fecha, como haría
  // DATE(autorizado_en) en MySQL real).
  'vale:count_autorizaciones_creacion_por_supervisor': (params) => {
    const [supervisorId, fecha] = params;
    const count = mockDatabase.vales.filter(v =>
      v.autorizado_por === Number(supervisorId) &&
      v.autorizacion_tipo === 'CREACION' &&
      String(v.autorizado_en || '').slice(0, 10) === fecha
    ).length;
    return [{ total: count }];
  },
  // analisis_correcciones_10.md #10: vigilante de atraso.
  // analisis_correcciones_12.md #1: mismo umbral de >= 1 día que la consulta SQL real.
  'vale:list_atrasados_sin_notificar': () => {
    const haceUnDia = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return mockDatabase.vales.filter(v =>
      !v.atraso_notificado_en && !v.atraso_congelado_en && v.estado !== 'RECIBIDO' && v.estado !== 'CONFIRMADO' &&
      new Date(String(v.fecha_entrega).replace(' ', 'T')) < haceUnDia
    );
  },
  'vale:marcar_atraso_notificado': (params) => {
    const [fechaHora, id] = params;
    const v = mockDatabase.vales.find(x => x.id === Number(id));
    if (v) v.atraso_notificado_en = fechaHora;
    return { affectedRows: v ? 1 : 0 };
  },

  // vale_talleres — progreso de un vale DENTRO de un taller (reemplaza asignacion:*)
  'vale_taller:insert': (params) => {
    const [valeId, tallerId] = params;
    const now = ahoraLocal();
    const row = {
      id: nextId(mockDatabase.valeTalleres), vale_id: Number(valeId), taller_id: Number(tallerId),
      tecnico_id: null, estado: 'PENDIENTE_ASIGNACION', fecha_asignacion: null, activo: 1,
      creado_en: now, actualizado_en: now
    };
    mockDatabase.valeTalleres.push(row);
    return { insertId: row.id };
  },
  'vale_taller:find_by_id': (params) => {
    const t = mockDatabase.valeTalleres.find(x => x.id === Number(params[0]));
    return t ? [{ ...t }] : [];
  },
  'vale_taller:list_all': () => mockDatabase.valeTalleres.filter(t => t.activo),
  'vale_taller:list_by_vale': (params) => {
    return mockDatabase.valeTalleres
      .filter(t => t.vale_id === Number(params[0]) && t.activo)
      .sort((a, b) => a.id - b.id);
  },
  'vale_taller:list_activas_by_tecnico': (params) => {
    return mockDatabase.valeTalleres.filter(t => t.tecnico_id === Number(params[0]) && t.activo);
  },
  'vale_taller:list_activas_by_taller': (params) => {
    return mockDatabase.valeTalleres.filter(t => t.taller_id === Number(params[0]) && t.activo);
  },
  'vale_taller:asignar': (params) => {
    const [tecnicoId, fechaAsignacion, id] = params;
    const t = mockDatabase.valeTalleres.find(x => x.id === Number(id));
    if (t) {
      t.tecnico_id = Number(tecnicoId);
      t.estado = 'ASIGNADO';
      t.fecha_asignacion = fechaAsignacion;
      t.actualizado_en = ahoraLocal();
    }
    return { affectedRows: t ? 1 : 0 };
  },
  'vale_taller:update_estado': (params) => {
    const [estado, id] = params;
    const t = mockDatabase.valeTalleres.find(x => x.id === Number(id));
    if (t) { t.estado = estado; t.actualizado_en = ahoraLocal(); }
    return { affectedRows: t ? 1 : 0 };
  },
  'propuesta:insert': (params) => {
    const [valeId, tecnicoId, url] = params;
    const row = {
      id: nextId(mockDatabase.valePropuestas), vale_id: Number(valeId), tecnico_id: Number(tecnicoId),
      url: url || null, creado_en: ahoraLocal()
    };
    mockDatabase.valePropuestas.push(row);
    return { insertId: row.id };
  },
  'propuesta:list_by_vale': (params) => {
    return mockDatabase.valePropuestas
      .filter(p => p.vale_id === Number(params[0]))
      .sort((a, b) => a.id - b.id);
  },
  'propuesta:latest_by_vale': (params) => {
    const rows = mockDatabase.valePropuestas
      .filter(p => p.vale_id === Number(params[0]))
      .sort((a, b) => b.id - a.id);
    return rows.length ? [rows[0]] : [];
  },
  'propuesta:latest_by_vale_tecnico': (params) => {
    const [valeId, tecnicoId] = params;
    const rows = mockDatabase.valePropuestas
      .filter(p => p.vale_id === Number(valeId) && p.tecnico_id === Number(tecnicoId))
      .sort((a, b) => b.id - a.id);
    return rows.length ? [rows[0]] : [];
  },

  'documento:insert': (params) => {
    const [valeId, nombreOriginal, ruta, tipo, mimeType, tamano, esModificacion, subidoPor] = params;
    const row = {
      id: nextId(mockDatabase.valeDocumentos), vale_id: Number(valeId), nombre_original: nombreOriginal,
      ruta, tipo, mime_type: mimeType, tamano: Number(tamano), es_modificacion: esModificacion ? 1 : 0,
      subido_por: Number(subidoPor), creado_en: ahoraLocal()
    };
    mockDatabase.valeDocumentos.push(row);
    return { insertId: row.id };
  },
  'documento:list_by_vale': (params) => {
    return mockDatabase.valeDocumentos.filter(d => d.vale_id === Number(params[0]));
  },
  'documento:delete': (params) => {
    const id = Number(params[0]);
    const idx = mockDatabase.valeDocumentos.findIndex(d => d.id === id);
    if (idx !== -1) mockDatabase.valeDocumentos.splice(idx, 1);
    return { affectedRows: idx !== -1 ? 1 : 0 };
  },

  // Solicitudes de modificación (staging) — al aprobar, valeService crea el
  // vale MOD- nuevo y marca esta solicitud como APROBADA.
  'solicitud_modificacion:insert': (params) => {
    const [valeOriginalId, asesorId, fechaEntrega, fechaEvento, urgente, clienteEmpresa, clienteNombre,
      clienteTelefono, clienteCorreo, productoId, materialId, tecnica, acabado, cantidad, cotizacion,
      talleresIds, justificacion] = params;
    const row = {
      id: nextId(mockDatabase.valeSolicitudesModificacion), vale_original_id: Number(valeOriginalId),
      asesor_id: Number(asesorId), fecha_entrega: fechaEntrega, fecha_evento: fechaEvento, urgente: urgente ? 1 : 0,
      cliente_empresa: clienteEmpresa || null, cliente_nombre: clienteNombre, cliente_telefono: clienteTelefono,
      cliente_correo: clienteCorreo, producto_id: productoId || null, material_id: materialId || null,
      tecnica, acabado, cantidad: Number(cantidad), cotizacion: Number(cotizacion), talleres_ids: talleresIds,
      justificacion, estado: 'PENDIENTE', creado_en: ahoraLocal()
    };
    mockDatabase.valeSolicitudesModificacion.push(row);
    return { insertId: row.id };
  },
  'solicitud_modificacion:find_pendiente_by_vale': (params) => {
    const rows = mockDatabase.valeSolicitudesModificacion
      .filter(s => s.vale_original_id === Number(params[0]) && s.estado === 'PENDIENTE')
      .sort((a, b) => b.id - a.id);
    return rows.length ? [rows[0]] : [];
  },
  'solicitud_modificacion:marcar_estado': (params) => {
    const [estado, id] = params;
    const s = mockDatabase.valeSolicitudesModificacion.find(x => x.id === Number(id));
    if (s) s.estado = estado;
    return { affectedRows: s ? 1 : 0 };
  },

  // analisis_correcciones_15.md #7: tecnicoId es el último parámetro (nuevo)
  // — se agrega al final a propósito para no reordenar los ya existentes.
  'historial:insert': (params) => {
    const [valeId, usuarioId, tallerId, estadoAnterior, estadoNuevo, accion, tecnicoId] = params;
    const row = {
      id: nextId(mockDatabase.valeHistorial), vale_id: Number(valeId), usuario_id: Number(usuarioId),
      taller_id: tallerId ? Number(tallerId) : null,
      tecnico_id: tecnicoId ? Number(tecnicoId) : null,
      estado_anterior: estadoAnterior || null, estado_nuevo: estadoNuevo, accion,
      creado_en: ahoraLocal()
    };
    mockDatabase.valeHistorial.push(row);
    return { insertId: row.id };
  },
  'historial:list_by_vale': (params) => {
    return mockDatabase.valeHistorial
      .filter(h => h.vale_id === Number(params[0]))
      .sort((a, b) => a.id - b.id);
  },

  // -----------------------------------------------------------------------
  // Vista Administrador (analisis_correcciones_13.md #6)
  // -----------------------------------------------------------------------

  // Pestaña "Gestionar Usuarios".
  'usuario_admin:list': () => {
    return mockDatabase.usuarios.map(u => {
      const rol = mockDatabase.roles.find(r => r.id === u.rol_id);
      const enriquecido = enriquecerUsuario(u);
      const tienda = enriquecido.tienda_id ? mockDatabase.tiendas.find(t => t.id === enriquecido.tienda_id) : null;
      let paises = null;
      if (u.rol_id === 3) {
        const nombresPaises = [...new Set(
          tiendasCubiertasPorSupervisor(u.id)
            .map(t => { const p = mockDatabase.paises.find(pa => pa.id === paisIdDeTienda(t)); return p ? p.nombre : null; })
            .filter(Boolean)
        )];
        paises = nombresPaises.join(', ') || null;
      } else if (tienda) {
        const p = mockDatabase.paises.find(pa => pa.id === paisIdDeTienda(tienda));
        paises = p ? p.nombre : null;
      }
      return { ...sinPasswordHash(enriquecido), rol_nombre: rol ? rol.nombre : null, tienda_nombre: tienda ? nombreTienda(tienda) : null, paises_asignados: paises };
    });
  },
  'usuario_admin:find_by_email': (params) => {
    const u = mockDatabase.usuarios.find(x => x.email === params[0]);
    return u ? [sinPasswordHash(u)] : [];
  },
  // analisis_correcciones_18.md #5: sin `telefono` — Asesor/Supervisor lo
  // guardan en su fila satélite (ver `asesor:insert`/`supervisor:insert`).
  'usuario_admin:insert': (params) => {
    const [nombre, email, passwordHash, rolId, tiendaId] = params;
    const row = {
      id: nextId(mockDatabase.usuarios), nombre, email, password_hash: passwordHash,
      rol_id: Number(rolId), tienda_id: tiendaId ? Number(tiendaId) : null, activo: 1
    };
    mockDatabase.usuarios.push(row);
    return { insertId: row.id };
  },
  'usuario_admin:update': (params) => {
    const [nombre, email, rolId, tiendaId, id] = params;
    const u = mockDatabase.usuarios.find(x => x.id === Number(id));
    if (!u) return { affectedRows: 0 };
    u.nombre = nombre; u.email = email;
    u.rol_id = Number(rolId); u.tienda_id = tiendaId ? Number(tiendaId) : null;
    return { affectedRows: 1 };
  },
  'usuario_admin:update_password': (params) => {
    const [passwordHash, id] = params;
    const u = mockDatabase.usuarios.find(x => x.id === Number(id));
    if (!u) return { affectedRows: 0 };
    u.password_hash = passwordHash;
    return { affectedRows: 1 };
  },
  'usuario_admin:set_activo': (params) => {
    const [activo, id] = params;
    const u = mockDatabase.usuarios.find(x => x.id === Number(id));
    if (!u) return { affectedRows: 0 };
    u.activo = activo ? 1 : 0;
    return { affectedRows: 1 };
  },

  // Pestaña "Roles y Permisos".
  'rol:list': () => mockDatabase.roles.map(r => ({
    ...r,
    usuarios_count: mockDatabase.usuarios.filter(u => u.rol_id === r.id && u.activo).length,
    permisos_count: mockDatabase.rol_permisos.filter(rp => rp.rol_id === r.id).length
  })),
  'rol:insert': (params) => {
    const [nombre, descripcion] = params;
    const row = { id: nextId(mockDatabase.roles), nombre, descripcion: descripcion || null, activo: 1 };
    mockDatabase.roles.push(row);
    return { insertId: row.id };
  },
  'rol:update': (params) => {
    const [nombre, descripcion, id] = params;
    const r = mockDatabase.roles.find(x => x.id === Number(id));
    if (!r) return { affectedRows: 0 };
    r.nombre = nombre; r.descripcion = descripcion || null;
    return { affectedRows: 1 };
  },
  // analisis_correcciones_14.md #5: ya no se borra físicamente un rol, se desactiva.
  'rol:set_activo': (params) => {
    const [activo, id] = params;
    const r = mockDatabase.roles.find(x => x.id === Number(id));
    if (!r) return { affectedRows: 0 };
    r.activo = activo ? 1 : 0;
    return { affectedRows: 1 };
  },
  'rol:count_usuarios': (params) => [{ total: mockDatabase.usuarios.filter(u => u.rol_id === Number(params[0])).length }],
  'rol_permiso:list_by_rol': (params) => mockDatabase.rol_permisos.filter(rp => rp.rol_id === Number(params[0])).map(rp => ({ permiso_id: rp.permiso_id })),
  'rol_permiso:set': (params) => {
    const [rolId, permisoIds] = params;
    const id = Number(rolId);
    mockDatabase.rol_permisos = mockDatabase.rol_permisos.filter(rp => rp.rol_id !== id);
    (permisoIds || []).forEach(pid => mockDatabase.rol_permisos.push({ rol_id: id, permiso_id: Number(pid) }));
    return { affectedRows: (permisoIds || []).length };
  },
  'permiso:list': () => mockDatabase.permisos,

  // Pestaña "Gestionar Tiendas".
  // analisis_correcciones_15.md #6: se quitó el campo `personal` (ya no se
  // muestra en la tabla — reemplazado por la columna Departamento/Subdivisión;
  // el detalle de personal vive en las acciones "Ver personal"/"Gestionar
  // personal", que consultan `tienda_admin:personal_detalle` aparte). El SQL real
  // nunca lo tuvo tampoco.
  'tienda_admin:list': () => {
    return mockDatabase.tiendas.slice().sort((a, b) => a.orden - b.orden).map(t => {
      const empresa = empresaDeTienda(t);
      const pais = mockDatabase.paises.find(p => p.id === paisIdDeTienda(t));
      const depto = mockDatabase.departamentos.find(d => d.id === t.departamento_id);
      const subdivision = t.subdivision_id ? mockDatabase.subdivisiones.find(s => s.id === t.subdivision_id) : null;
      return {
        ...t,
        nombre: nombreTienda(t),
        empresa_nombre: empresa ? empresa.nombre : null,
        pais_id: paisIdDeTienda(t),
        pais_nombre: pais ? pais.nombre : null,
        departamento_nombre: depto ? depto.nombre : null,
        subdivision_nombre: subdivision ? subdivision.nombre : null
      };
    });
  },
  'tienda_admin:find_by_id': (params) => {
    const t = mockDatabase.tiendas.find(x => x.id === Number(params[0]));
    return t ? [t] : [];
  },
  'tienda_admin:find_by_codigo': (params) => {
    const t = mockDatabase.tiendas.find(x => x.codigo === params[0]);
    return t ? [t] : [];
  },
  'tienda_admin:insert': (params) => {
    const [codigo, empresaId, departamentoId, subdivisionId] = params;
    const maxOrden = mockDatabase.tiendas.reduce((max, t) => Math.max(max, t.orden), 0);
    const row = {
      id: nextId(mockDatabase.tiendas), codigo, empresa_id: Number(empresaId),
      departamento_id: Number(departamentoId), subdivision_id: subdivisionId ? Number(subdivisionId) : null,
      orden: maxOrden + 1, activo: 1
    };
    mockDatabase.tiendas.push(row);
    return { insertId: row.id };
  },
  'tienda_admin:update': (params) => {
    const [codigo, empresaId, departamentoId, subdivisionId, activo, id] = params;
    const t = mockDatabase.tiendas.find(x => x.id === Number(id));
    if (!t) return { affectedRows: 0 };
    t.codigo = codigo; t.empresa_id = Number(empresaId);
    t.departamento_id = Number(departamentoId); t.subdivision_id = subdivisionId ? Number(subdivisionId) : null;
    t.activo = activo ? 1 : 0;
    return { affectedRows: 1 };
  },
  'subdivision:insert': (params) => {
    const [departamentoId, nombre, paisId] = params;
    const row = { id: nextId(mockDatabase.subdivisiones), departamento_id: Number(departamentoId), nombre, pais_id: Number(paisId), activo: 1 };
    mockDatabase.subdivisiones.push(row);
    return { insertId: row.id };
  },
  // analisis_correcciones_19.md #9: departamento nuevo, siempre de un solo país.
  'departamento:insert': (params) => {
    const [nombre, paisId] = params;
    const row = { id: nextId(mockDatabase.departamentos), nombre, pais_id: paisId != null ? Number(paisId) : null, activo: 1 };
    mockDatabase.departamentos.push(row);
    return { insertId: row.id };
  },
  'tienda_admin:set_orden': (params) => {
    const [ordenes] = params;
    (ordenes || []).forEach(({ id, orden }) => {
      const t = mockDatabase.tiendas.find(x => x.id === Number(id));
      if (t) t.orden = Number(orden);
    });
    return { affectedRows: (ordenes || []).length };
  },
  'tienda_admin:asignar_usuario': (params) => {
    const [tiendaId, usuarioId] = params;
    const u = mockDatabase.usuarios.find(x => x.id === Number(usuarioId));
    if (!u) return { affectedRows: 0 };
    u.tienda_id = Number(tiendaId);
    return { affectedRows: 1 };
  },
  'tienda_admin:quitar_usuario': (params) => {
    const u = mockDatabase.usuarios.find(x => x.id === Number(params[0]));
    if (!u) return { affectedRows: 0 };
    u.tienda_id = null;
    return { affectedRows: 1 };
  },
  // analisis_correcciones_18.md #1/#5: un Asesor cuenta como personal "directo"
  // vía `asesores.tienda_id`; Técnico/Encargado de Diseño Local siguen vía
  // `usuarios.tienda_id`; el encargado de un taller COMPARTIDO (Diseño,
  // Diseño UV/3D, Protextil — roles 4/5/9) cuenta vía `encargadoTienda`, así
  // que aparece en MTC y en MTS a la vez; un Supervisor cuenta si tiene esa
  // tienda en `supervisorTiendas` (ya no hay cobertura "heredada" por
  // departamento). El Administrador nunca pertenece a ninguna tienda.
  'tienda_admin:personal_detalle': (params) => {
    const tiendaId = Number(params[0]);
    const t = mockDatabase.tiendas.find(x => x.id === tiendaId);
    if (!t) return [];
    const ROLES_ENCARGADO_TALLER_COMPARTIDO = [4, 5, 9];
    const asesorUsuarioIds = new Set(mockDatabase.asesores.filter(a => a.tienda_id === tiendaId).map(a => a.usuario_id));
    const tallerIdsDeEstaTienda = new Set(mockDatabase.encargadoTienda.filter(et => et.tienda_id === tiendaId).map(et => et.taller_id));
    const encargadoCompartidoUsuarioIds = new Set(
      mockDatabase.talleres.filter(tal => tallerIdsDeEstaTienda.has(tal.id)).map(tal => tal.encargado_id)
    );
    const directo = mockDatabase.usuarios.filter(u =>
      u.activo && u.rol_id !== 1 && (
        asesorUsuarioIds.has(u.id) ||
        encargadoCompartidoUsuarioIds.has(u.id) ||
        (u.rol_id !== 2 && u.rol_id !== 3 && !ROLES_ENCARGADO_TALLER_COMPARTIDO.includes(u.rol_id) && u.tienda_id === tiendaId)
      )
    ).map(u => {
      const rol = mockDatabase.roles.find(r => r.id === u.rol_id);
      return { id: u.id, nombre: u.nombre, email: u.email, rol_nombre: rol ? rol.nombre : null, rol_id: u.rol_id, tipo_vinculo: 'directo' };
    });
    const supervisorUsuarioIds = new Set(mockDatabase.supervisorTiendas.filter(st => st.tienda_id === tiendaId).map(st => st.usuario_id));
    const supervisores = mockDatabase.usuarios.filter(u => u.rol_id === 3 && u.activo && supervisorUsuarioIds.has(u.id))
      .map(u => ({ id: u.id, nombre: u.nombre, email: u.email, rol_nombre: 'Supervisor de Ventas', rol_id: u.rol_id, tipo_vinculo: 'supervisor' }));
    return [...directo, ...supervisores];
  },
  'supervisor_tienda:insert': (params) => {
    const [usuarioId, tiendaId] = params;
    const yaExiste = mockDatabase.supervisorTiendas.some(st => st.usuario_id === Number(usuarioId) && st.tienda_id === Number(tiendaId));
    if (yaExiste) return { insertId: null };
    const row = { id: nextId(mockDatabase.supervisorTiendas), usuario_id: Number(usuarioId), tienda_id: Number(tiendaId) };
    mockDatabase.supervisorTiendas.push(row);
    return { insertId: row.id };
  },
  'supervisor_tienda:delete': (params) => {
    const [usuarioId, tiendaId] = params;
    const antes = mockDatabase.supervisorTiendas.length;
    mockDatabase.supervisorTiendas = mockDatabase.supervisorTiendas.filter(st =>
      !(st.usuario_id === Number(usuarioId) && st.tienda_id === Number(tiendaId))
    );
    return { affectedRows: antes - mockDatabase.supervisorTiendas.length };
  },
  'supervisor_tienda:list_by_usuario': (params) => {
    const usuarioId = Number(params[0]);
    return mockDatabase.supervisorTiendas.filter(st => st.usuario_id === usuarioId).map(st => ({ tienda_id: st.tienda_id }));
  },
  // Filas satélite de Asesor de Ventas / Supervisor de Ventas.
  'asesor:insert': (params) => {
    const [usuarioId, tiendaId, telefono] = params;
    const row = { id: nextId(mockDatabase.asesores), usuario_id: Number(usuarioId), tienda_id: tiendaId ? Number(tiendaId) : null, telefono: telefono || null };
    mockDatabase.asesores.push(row);
    return { insertId: row.id };
  },
  'asesor:update': (params) => {
    const [tiendaId, telefono, usuarioId] = params;
    const a = mockDatabase.asesores.find(x => x.usuario_id === Number(usuarioId));
    if (!a) return { affectedRows: 0 };
    a.tienda_id = tiendaId ? Number(tiendaId) : null;
    a.telefono = telefono || null;
    return { affectedRows: 1 };
  },
  'asesor:find_by_usuario': (params) => {
    const a = mockDatabase.asesores.find(x => x.usuario_id === Number(params[0]));
    return a ? [a] : [];
  },
  'asesor:delete': (params) => {
    const antes = mockDatabase.asesores.length;
    mockDatabase.asesores = mockDatabase.asesores.filter(a => a.usuario_id !== Number(params[0]));
    return { affectedRows: antes - mockDatabase.asesores.length };
  },
  'supervisor:insert': (params) => {
    const [usuarioId, telefono] = params;
    const row = { id: nextId(mockDatabase.supervisores), usuario_id: Number(usuarioId), telefono: telefono || null };
    mockDatabase.supervisores.push(row);
    return { insertId: row.id };
  },
  'supervisor:update': (params) => {
    const [telefono, usuarioId] = params;
    const s = mockDatabase.supervisores.find(x => x.usuario_id === Number(usuarioId));
    if (!s) return { affectedRows: 0 };
    s.telefono = telefono || null;
    return { affectedRows: 1 };
  },
  'supervisor:find_by_usuario': (params) => {
    const s = mockDatabase.supervisores.find(x => x.usuario_id === Number(params[0]));
    return s ? [s] : [];
  },
  'supervisor:delete': (params) => {
    const antes = mockDatabase.supervisores.length;
    mockDatabase.supervisores = mockDatabase.supervisores.filter(s => s.usuario_id !== Number(params[0]));
    return { affectedRows: antes - mockDatabase.supervisores.length };
  },
  'organizacion:departamentos': () => mockDatabase.departamentos.filter(d => d.activo),
  'organizacion:subdivisiones': () => mockDatabase.subdivisiones.filter(s => s.activo),
  'organizacion:empresas': () => mockDatabase.empresas.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)),

  // Pestaña "Modo Mantenimiento".
  'mantenimiento:get': () => mockDatabase.mantenimientoConfig,
  'mantenimiento:set': (params) => {
    const [activo, mensaje, activadoPor] = params;
    const fila = mockDatabase.mantenimientoConfig[0];
    fila.activo = activo ? 1 : 0;
    fila.mensaje = mensaje || null;
    if (activo) { fila.activado_por = activadoPor ? Number(activadoPor) : null; fila.activado_en = ahoraLocal(); }
    return { affectedRows: 1 };
  }
};

// Simulador rudimentario de consultas SQL necesarias para la autenticación y permisos
// (sin tag: se mantiene por compatibilidad con el código de auth existente)
function handleMockQuery(sql, params, tag) {
  if (tag && taggedHandlers[tag]) {
    return taggedHandlers[tag](params);
  }

  const sqlNormalized = sql.toLowerCase().replace(/\s+/g, ' ');

  // Buscar usuario por email: SELECT * FROM usuarios WHERE email = ?
  if (sqlNormalized.includes('from usuarios') && sqlNormalized.includes('email =')) {
    const email = params[0];
    const user = mockDatabase.usuarios.find(u => u.email === email);
    return user ? [user] : [];
  }

  // Obtener permisos de rol: SELECT p.codigo, p.modulo FROM permisos p ... JOIN rol_permisos rp ... WHERE rp.rol_id = ?
  if (sqlNormalized.includes('rol_permisos') && sqlNormalized.includes('rol_id =')) {
    const rolId = params[0];
    const rpList = mockDatabase.rol_permisos.filter(rp => rp.rol_id === Number(rolId));
    const permissionIds = rpList.map(rp => rp.permiso_id);
    const matchedPerms = mockDatabase.permisos.filter(p => permissionIds.includes(p.id));
    return matchedPerms.map(p => ({ codigo: p.codigo, modulo: p.modulo }));
  }

  // Obtener rol por id
  if (sqlNormalized.includes('from roles') && sqlNormalized.includes('id =')) {
    const id = params[0];
    const rol = mockDatabase.roles.find(r => r.id === Number(id));
    return rol ? [rol] : [];
  }

  if (tag) {
    console.warn(`[Database Mock] Tag no reconocido: "${tag}". Devolviendo array vacío.`);
  } else {
    console.warn(`[Database Mock] Consulta no mapeada: "${sql}". Devolviendo array vacío.`);
  }
  return [];
}

const listo = initializeDatabase();

module.exports = {
  query,
  getUseMock: () => useMock,
  isReady: () => pool !== null || useMock,
  // Promesa que resuelve una vez decidido si se usa MySQL real o el mock —
  // para el código que necesita consultar la BD en el mismo tick en que se
  // hace `require()` (p. ej. maintenanceMiddleware, que precarga el estado de
  // mantenimiento al arrancar) y de otro modo correría antes de que
  // `useMock` se determine.
  listo
};
