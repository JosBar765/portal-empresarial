-- Datos de demostración

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO `vales` (`id`, `correlativo`, `asesor_id`, `tienda_id`, `vale_original_id`, `fecha_creacion`, `hora_creacion`, `fecha_entrega`, `fecha_evento`, `urgente`, `cliente_empresa`, `cliente_nombre`, `cliente_telefono`, `cliente_correo`, `producto_id`, `material_id`, `tecnica`, `acabado`, `cantidad`, `cotizacion`, `descripcion`, `modificado`, `estado`) VALUES
(1,  'GUA-3-0001', 49, 1, NULL, '2026-08-19', '08:30:00', '2026-08-22 17:00:00', '2026-08-25 09:00:00', 0, 'Corporación Deportiva S.A.', 'Juan Pérez', '+502 5555-1111', 'juan.perez@corpdeportiva.com', 1, 2, 'Grabado Láser', 'Brillante', 50, 1500.00, 'Trofeos para premiación anual de ventas.', 0, 'CREADO'),
(2,  'GUA-3-0002', 49, 1, NULL, '2026-08-18', '09:15:00', '2026-08-20 17:00:00', '2026-08-23 09:00:00', 0, 'Liga Guatemalteca', 'María López', '+502 5555-2222', 'maria.lopez@liga.gt', 2, 1, 'Sublimación', 'Mate', 200, 800.00, 'Medallas para maratón centroamericano.', 0, 'CREADO'),
(3,  'GUA-3-0003', 49, 1, NULL, '2026-08-17', '10:00:00', '2026-08-21 17:00:00', '2026-08-24 09:00:00', 1, 'Club Atlético GUA', 'Carlos Ruiz', '+502 5555-3333', 'carlos.ruiz@clubgua.com', 3, 3, 'Impresión UV', 'Satinado', 30, 950.00, 'Placas conmemorativas grabadas en madera.', 0, 'CREADO'),
(4,  'GUA-3-0004', 49, 1, NULL, '2026-08-14', '11:20:00', '2026-08-18 17:00:00', '2026-08-20 09:00:00', 1, 'MundiEventos', 'Ana Gómez', '+502 5555-4444', 'ana.gomez@mundieventos.com', 1, 4, 'Grabado Láser', 'Brillante', 15, 2200.00, 'Trofeos de cristal para gala anual.', 0, 'CREADO'),
(5,  'GUA-3-0005', 49, 1, NULL, '2026-08-13', '08:45:00', '2026-08-17 17:00:00', '2026-08-19 09:00:00', 0, 'Federación Nacional', 'Luis Herrera', '+502 5555-5555', 'luis.herrera@fednacional.org', 4, 1, 'Impresión UV', 'Mate', 5, 600.00, 'Banners UV + trofeos para evento deportivo (dos talleres).', 0, 'CREADO'),
(6,  'GUA-3-0006', 49, 1, NULL, '2026-08-10', '13:00:00', '2026-08-15 17:00:00', '2026-08-16 09:00:00', 0, 'Copa MundiTrofeos', 'Diego Alvarado', '+502 5555-6666', 'diego.alvarado@copamt.com', 1, 2, 'Grabado Láser', 'Brillante', 100, 3200.00, 'Trofeos + banners UV de premiación Copa MundiTrofeos.', 0, 'APROBADO_DEPARTAMENTO'),
(7,  'GUA-3-0007', 49, 1, NULL, '2026-08-09', '15:30:00', '2026-08-16 17:00:00', '2026-08-17 09:00:00', 0, 'Cliente particular', 'Sofía Ramírez', '+502 5555-7777', 'sofia.ramirez@correo.com', 2, 1, 'Sublimación', 'Mate', 40, 450.00, 'Medallas para evento escolar.', 0, 'PENDIENTE_CONFIRMACION'),
(8,  'GUA-3-0008', 49, 1, NULL, '2026-08-05', '10:00:00', '2026-08-12 17:00:00', '2026-08-13 09:00:00', 0, 'Torneo Regional', 'Pedro Sandoval', '+502 5555-8888', 'pedro.sandoval@torneoreg.com', 1, 3, 'Grabado Láser', 'Satinado', 60, 1800.00, 'Trofeos de torneo regional, entregados.', 1, 'RECIBIDO'),
(9,  'GUA-3-0009', 49, 1, NULL, '2026-08-04', '14:00:00', '2026-08-11 17:00:00', '2026-08-12 09:00:00', 0, 'Cliente particular', 'Elena Castillo', '+502 5555-9999', 'elena.castillo@correo.com', 3, 2, 'Impresión UV', 'Mate', 20, 700.00, 'Placas — el cliente pidió ajustar el grabado, asesor solicitó modificación.', 0, 'SOLICITANDO_MODIFICACION'),
(10, 'GUA-3-0010', 49, 1, NULL, '2026-07-30', '09:00:00', '2026-08-08 17:00:00', '2026-08-09 09:00:00', 0, 'Club Deportivo Antigua', 'Roberto Mejía', '+502 5555-1010', 'roberto.mejia@cdantigua.com', 1, 1, 'Grabado Láser', 'Brillante', 80, 2500.00, 'Trofeos de campeonato — modificación de acabado en curso.', 0, 'SOLICITANDO_MODIFICACION'),
(11, 'GUA-3-0011', 49, 1, NULL, '2026-08-06', '16:00:00', '2026-08-14 17:00:00', '2026-08-15 09:00:00', 0, 'Asociación Escolar', 'Marta Solís', '+502 5555-1111', 'marta.solis@asocescolar.edu', 2, 4, 'Sublimación', 'Satinado', 25, 620.00, 'Medallas — el logo quedó descentrado, asesor solicitó modificación.', 0, 'SOLICITANDO_MODIFICACION'),
(12, 'MOD-GUA-3-0008', 49, 1, 8, '2026-08-20', '11:00:00', '2026-08-27 17:00:00', '2026-08-28 09:00:00', 0, 'Torneo Regional', 'Pedro Sandoval', '+502 5555-8888', 'pedro.sandoval@torneoreg.com', 1, 3, 'Grabado Láser', 'Brillante', 60, 1800.00, 'El cliente solicitó cambiar el acabado de satinado a brillante para hacer juego con el resto del set de premiación.', 0, 'MODIFICADO');

INSERT INTO `vale_talleres` (`vale_id`, `taller_id`, `tecnico_id`, `estado`, `fecha_asignacion`, `activo`) VALUES
(1,  1, NULL, 'PENDIENTE_ASIGNACION', NULL, 1),
(2,  1, 7,    'ASIGNADO',    '2026-08-18 09:30:00', 1),
(3,  1, 7,    'EN_PROCESO',  '2026-08-17 10:30:00', 1),
(4,  1, 8,    'EN_REVISION', '2026-08-14 11:45:00', 1),
(5,  1, 7,    'EN_PROCESO',  '2026-08-13 09:15:00', 1),   
(5,  2, 9,    'APROBADO',    '2026-08-13 09:00:00', 1),   
(6,  1, 7,    'APROBADO',    '2026-08-10 13:20:00', 1),   
(6,  2, 9,    'APROBADO',    '2026-08-10 13:25:00', 1),
(7,  1, 8,    'APROBADO',    '2026-08-09 16:00:00', 1),
(8,  1, 7,    'APROBADO',    '2026-08-05 12:00:00', 1),
(9,  1, 8,    'APROBADO',    '2026-08-04 15:00:00', 1),
(10, 1, 7,    'APROBADO',    '2026-07-30 10:00:00', 1),
(11, 1, 8,    'APROBADO',    '2026-08-13 15:00:00', 1),   
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
(10, 49, '2026-08-08 17:00:00', '2026-08-09 09:00:00', 0, 'Club Deportivo Antigua', 'Roberto Mejía', '+502 5555-1010', 'roberto.mejia@cdantigua.com', 1, 1, 'Grabado Láser', 'Mate', 80, 2500.00, '1', 'El cliente pidió cambiar el acabado de brillante a mate.', 'PENDIENTE'),
(9, 49, '2026-08-11 17:00:00', '2026-08-12 09:00:00', 0, 'Cliente particular', 'Elena Castillo', '+502 5555-9999', 'elena.castillo@correo.com', 3, 2, 'Impresión UV', 'Mate', 20, 700.00, '1', 'El cliente pidió ajustar el grabado.', 'PENDIENTE'),
(11, 49, '2026-08-14 17:00:00', '2026-08-15 09:00:00', 0, 'Asociación Escolar', 'Marta Solís', '+502 5555-1111', 'marta.solis@asocescolar.edu', 2, 4, 'Sublimación', 'Satinado', 25, 620.00, '1', 'El logo quedó descentrado.', 'PENDIENTE');

INSERT INTO `vale_historial` (`vale_id`, `usuario_id`, `taller_id`, `estado_anterior`, `estado_nuevo`, `accion`) VALUES
(1, 49, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(2, 49, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(2, 5, 1, 'PENDIENTE_ASIGNACION', 'ASIGNADO', 'Encargado de Diseño asignó a Técnico Diseño A'),
(3, 49, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(3, 5, 1, 'PENDIENTE_ASIGNACION', 'ASIGNADO', 'Encargado de Diseño asignó a Técnico Diseño A'),
(3, 7, 1, 'ASIGNADO', 'EN_PROCESO', 'Técnico marcó el vale como en proceso'),
(4, 49, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(4, 5, 1, 'PENDIENTE_ASIGNACION', 'ASIGNADO', 'Encargado de Diseño asignó a Técnico Diseño B'),
(4, 8, 1, 'ASIGNADO', 'EN_PROCESO', 'Técnico marcó el vale como en proceso'),
(4, 8, 1, 'EN_PROCESO', 'EN_REVISION', 'Técnico entregó propuesta'),
(5, 49, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (talleres: Diseño, Diseño UV/3D)'),
(5, 6, 2, 'PENDIENTE_ASIGNACION', 'ASIGNADO', 'Encargado UV/3D asignó a Técnico UV/3D C'),
(5, 9, 2, 'EN_PROCESO', 'EN_REVISION', 'Técnico UV/3D entregó propuesta'),
(5, 6, 2, 'EN_REVISION', 'APROBADO', 'Encargado UV/3D aprobó la propuesta de su taller'),
(6, 49, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (talleres: Diseño, Diseño UV/3D)'),
(6, 5, 1, 'EN_REVISION', 'APROBADO', 'Encargado de Diseño aprobó la propuesta de su taller'),
(6, 6, 2, 'EN_REVISION', 'APROBADO', 'Encargado UV/3D aprobó la propuesta de su taller'),
(6, 49, NULL, 'CREADO', 'APROBADO_DEPARTAMENTO', 'Ambos talleres aprobaron — pendiente de fusión'),
(7, 49, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(7, 5, 1, 'EN_REVISION', 'APROBADO', 'Encargado de Diseño aprobó la propuesta'),
(7, 49, NULL, 'CREADO', 'PENDIENTE_CONFIRMACION', 'Único taller aprobado — pasa directo a confirmación del asesor'),
(8, 49, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(8, 5, 1, 'EN_REVISION', 'APROBADO', 'Encargado de Diseño aprobó la propuesta'),
(8, 49, NULL, 'CREADO', 'PENDIENTE_CONFIRMACION', 'Único taller aprobado — pasa directo a confirmación del asesor'),
(8, 49, NULL, 'PENDIENTE_CONFIRMACION', 'RECIBIDO', 'Asesor confirmó de recibido el vale de arte'),
(9, 49, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(9, 5, 1, 'EN_REVISION', 'APROBADO', 'Encargado de Diseño aprobó la propuesta'),
(9, 49, NULL, 'CREADO', 'PENDIENTE_CONFIRMACION', 'Único taller aprobado — pasa directo a confirmación del asesor'),
(9, 49, NULL, 'PENDIENTE_CONFIRMACION', 'SOLICITANDO_MODIFICACION', 'Asesor solicitó modificación'),
(10, 49, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(10, 5, 1, 'EN_REVISION', 'APROBADO', 'Encargado de Diseño aprobó la propuesta'),
(10, 49, NULL, 'CREADO', 'PENDIENTE_CONFIRMACION', 'Único taller aprobado — pasa directo a confirmación del asesor'),
(10, 49, NULL, 'PENDIENTE_CONFIRMACION', 'RECIBIDO', 'Asesor confirmó de recibido el vale de arte'),
(10, 49, NULL, 'RECIBIDO', 'SOLICITANDO_MODIFICACION', 'Asesor solicitó modificación de acabado'),
(11, 49, NULL, NULL, 'CREADO', 'Vale de arte creado por el asesor (taller: Diseño)'),
(11, 5, 1, 'EN_REVISION', 'APROBADO', 'Encargado de Diseño aprobó la propuesta'),
(11, 49, NULL, 'CREADO', 'PENDIENTE_CONFIRMACION', 'Único taller aprobado — pasa directo a confirmación del asesor'),
(11, 49, NULL, 'PENDIENTE_CONFIRMACION', 'SOLICITANDO_MODIFICACION', 'Asesor solicitó modificación'),
(12, 13, NULL, NULL, 'MODIFICADO', 'Supervisor aprobó la solicitud de modificación — se creó el vale MOD-GUA-3-0008');

INSERT INTO `vales` (`id`, `correlativo`, `asesor_id`, `tienda_id`, `vale_original_id`, `fecha_creacion`, `hora_creacion`, `fecha_entrega`, `fecha_evento`, `urgente`, `cliente_empresa`, `cliente_nombre`, `cliente_telefono`, `cliente_correo`, `producto_id`, `material_id`, `tecnica`, `acabado`, `cantidad`, `cotizacion`, `descripcion`, `talleres_solicitados`, `modificado`, `estado`) VALUES
(13, 'GUA-3-0012', 49, 1, NULL, '2026-08-26', '08:00:00', '2026-08-30 17:00:00', '2026-08-31 09:00:00', 0, 'Cliente particular', 'Fernando Ixchop', '+502 5555-1212', 'fernando.ixchop@correo.com', 1, 1, 'Grabado Láser', 'Brillante', 10, 900.00, 'Trofeos recién creados, esperando autorización del Supervisor.', '1', 0, 'ESPERANDO_AUTORIZACION');

INSERT INTO `vale_historial` (`vale_id`, `usuario_id`, `taller_id`, `estado_anterior`, `estado_nuevo`, `accion`) VALUES
(13, 49, NULL, NULL, 'ESPERANDO_AUTORIZACION', 'Vale de arte creado por el asesor — esperando autorización del Supervisor (taller solicitado: Diseño)');

UPDATE `vales` SET `autorizado_por` = 13, `autorizado_en` = '2026-08-05 09:30:00', `autorizacion_tipo` = 'CREACION' WHERE `id` = 8;
UPDATE `vales` SET `confirmado_en` = '2026-08-12 17:00:00' WHERE `id` = 8;
UPDATE `vales` SET `autorizado_por` = 13, `autorizado_en` = '2026-08-20 11:00:00', `autorizacion_tipo` = 'MODIFICACION' WHERE `id` = 12;

SET FOREIGN_KEY_CHECKS = 1;
