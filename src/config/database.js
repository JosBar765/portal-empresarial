// src/config/database.js
const mysql = require('mysql2/promise');
const config = require('./env');

let pool = null;
let useMock = false;

// -------------------------------------------------------------------------
// Mock de base de datos en memoria si la conexión física falla.
// Refleja 1:1 la estructura y semillas de database/schema.sql.
// -------------------------------------------------------------------------
const mockDatabase = {
  usuarios: [
    { id: 1, nombre: 'Administrador General', email: 'admin@munditrofeos.com', telefono: '+502 5555-0001', password_hash: '$2a$10$0.B9xk21MYppfOd4XbtP3u5mJ6NzlaA6eqlu65Fy5G7xb2VnN2Lwu', rol_id: 1, localidad_id: 1, encargado_id: null, activo: 1 },
    { id: 2, nombre: 'Diseñador Creativo', email: 'diseno@munditrofeos.com', telefono: '+502 5555-0002', password_hash: '$2a$10$SXZEYhhebLnagsNMyFiqFOIn3m4Uwwf45PKHBvEIooMvzfqLXBpaC', rol_id: 2, localidad_id: 1, encargado_id: null, activo: 1 },
    { id: 3, nombre: 'Asesor Comercial', email: 'ventas@munditrofeos.com', telefono: '+502 5555-0003', password_hash: '$2a$10$KrYwD5jW2ApvSCzeE8r75O4OJViry2yLLHnujyPX4ZGw58IJpSnmW', rol_id: 3, localidad_id: 1, encargado_id: null, activo: 1 },
    { id: 4, nombre: 'Supervisor de Ventas', email: 'supervisor@munditrofeos.com', telefono: '+502 5555-0004', password_hash: '$2a$10$1QJZCrH9f/x2h5asWehXD.js8MfglZFLjeUl7NdzpbkpqOjMuUNYC', rol_id: 4, localidad_id: 1, encargado_id: null, activo: 1 },
    { id: 5, nombre: 'Encargado de Diseño', email: 'encargado.diseno@munditrofeos.com', telefono: '+502 5555-0005', password_hash: '$2a$10$DsZ1CMbgsndw990I4xBOLOJ8MmKTcaH8PM4468adlORmh4O8dVlva', rol_id: 5, localidad_id: 1, encargado_id: null, activo: 1 },
    { id: 6, nombre: 'Encargado de Diseño UV/3D', email: 'encargado.uv3d@munditrofeos.com', telefono: '+502 5555-0006', password_hash: '$2a$10$DEPhj4Vnp.cgA6u3w3Leg.FVQ9O3JgKDXizOYCXEbGFlSgEBcb6F6', rol_id: 6, localidad_id: 1, encargado_id: null, activo: 1 },
    { id: 7, nombre: 'Técnico Diseño A', email: 'tecnico.a@munditrofeos.com', telefono: '+502 5555-0007', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 7, localidad_id: 1, encargado_id: 5, activo: 1 },
    { id: 8, nombre: 'Técnico Diseño B', email: 'tecnico.b@munditrofeos.com', telefono: '+502 5555-0008', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 7, localidad_id: 1, encargado_id: 5, activo: 1 },
    { id: 9, nombre: 'Técnico UV/3D C', email: 'tecnico.c@munditrofeos.com', telefono: '+502 5555-0009', password_hash: '$2a$10$cgVsRZgXXFOGwNOH7znc0u.CSfMqcIn4jS3tyhhNPGOCsilb2RfrS', rol_id: 7, localidad_id: 1, encargado_id: 6, activo: 1 }
  ],
  roles: [
    { id: 1, nombre: 'Administrador', descripcion: 'Acceso total a todos los módulos' },
    { id: 2, nombre: 'Diseñador', descripcion: 'Acceso a vales de arte y generador de prompts' },
    { id: 3, nombre: 'Asesor de Ventas', descripcion: 'Crea vales de arte, confirma o cancela ventas y solicita modificaciones' },
    { id: 4, nombre: 'Supervisor de Ventas', descripcion: 'Supervisa el flujo de vales de arte y autoriza modificaciones' },
    { id: 5, nombre: 'Encargado de Diseño', descripcion: 'Asigna vales de arte a técnicos y revisa sus propuestas' },
    { id: 6, nombre: 'Encargado de Diseño UV/3D', descripcion: 'Asigna vales de arte a técnicos UV/3D y revisa sus propuestas' },
    { id: 7, nombre: 'Técnico de Diseño', descripcion: 'Ejecuta los vales de arte que le asigna su encargado' }
  ],
  permisos: [
    { id: 1, codigo: 'vales.ver', nombre: 'Ver Vales', modulo: 'vales' },
    { id: 2, codigo: 'vales.crear', nombre: 'Crear Vales', modulo: 'vales' },
    { id: 3, codigo: 'vales.editar', nombre: 'Editar Vales', modulo: 'vales' },
    { id: 4, codigo: 'prompts.ver', nombre: 'Ver Prompts', modulo: 'prompts' },
    { id: 5, codigo: 'prompts.crear', nombre: 'Crear Prompts', modulo: 'prompts' },
    { id: 6, codigo: 'eventos.ver', nombre: 'Ver Eventos', modulo: 'eventos' },
    { id: 7, codigo: 'eventos.crear', nombre: 'Crear Eventos', modulo: 'eventos' },
    { id: 8, codigo: 'admin.ver', nombre: 'Ver Admin', modulo: 'admin' },
    { id: 9, codigo: 'vales.asignar', nombre: 'Asignar Vales', modulo: 'vales' },
    { id: 10, codigo: 'vales.revisar', nombre: 'Revisar Propuestas', modulo: 'vales' },
    { id: 11, codigo: 'vales.trabajar', nombre: 'Trabajar Vales', modulo: 'vales' },
    { id: 12, codigo: 'vales.confirmar', nombre: 'Confirmar o Cancelar Venta', modulo: 'vales' },
    { id: 13, codigo: 'vales.solicitar_modificacion', nombre: 'Solicitar Modificación', modulo: 'vales' },
    { id: 14, codigo: 'vales.aprobar_modificacion', nombre: 'Aprobar Modificación', modulo: 'vales' },
    { id: 15, codigo: 'vales.supervisar', nombre: 'Supervisar Vales', modulo: 'vales' }
  ],
  rol_permisos: [
    { rol_id: 1, permiso_id: 1 }, { rol_id: 1, permiso_id: 2 }, { rol_id: 1, permiso_id: 3 },
    { rol_id: 1, permiso_id: 4 }, { rol_id: 1, permiso_id: 5 }, { rol_id: 1, permiso_id: 6 },
    { rol_id: 1, permiso_id: 7 }, { rol_id: 1, permiso_id: 8 }, { rol_id: 1, permiso_id: 9 },
    { rol_id: 1, permiso_id: 10 }, { rol_id: 1, permiso_id: 11 }, { rol_id: 1, permiso_id: 12 },
    { rol_id: 1, permiso_id: 13 }, { rol_id: 1, permiso_id: 14 }, { rol_id: 1, permiso_id: 15 },
    { rol_id: 2, permiso_id: 1 }, { rol_id: 2, permiso_id: 3 }, { rol_id: 2, permiso_id: 4 }, { rol_id: 2, permiso_id: 5 },
    { rol_id: 3, permiso_id: 1 }, { rol_id: 3, permiso_id: 2 }, { rol_id: 3, permiso_id: 3 },
    { rol_id: 3, permiso_id: 12 }, { rol_id: 3, permiso_id: 13 }, { rol_id: 3, permiso_id: 6 }, { rol_id: 3, permiso_id: 7 },
    { rol_id: 4, permiso_id: 1 }, { rol_id: 4, permiso_id: 15 }, { rol_id: 4, permiso_id: 14 },
    { rol_id: 5, permiso_id: 1 }, { rol_id: 5, permiso_id: 9 }, { rol_id: 5, permiso_id: 10 },
    { rol_id: 6, permiso_id: 1 }, { rol_id: 6, permiso_id: 9 }, { rol_id: 6, permiso_id: 10 },
    { rol_id: 7, permiso_id: 1 }, { rol_id: 7, permiso_id: 11 }
  ],
  localidades: [
    { id: 1, codigo: 'GUA', nombre: 'Guatemala', pais_id: 1, activo: 1 },
    { id: 2, codigo: 'SAN', nombre: 'San Salvador', pais_id: 2, activo: 1 },
    { id: 3, codigo: 'TEG', nombre: 'Tegucigalpa', pais_id: 3, activo: 1 }
  ],
  paises: [
    { id: 1, codigo: 'GT', nombre: 'Guatemala', codigo_telefono: '+502', moneda_codigo: 'GTQ', moneda_simbolo: 'Q' },
    { id: 2, codigo: 'SV', nombre: 'El Salvador', codigo_telefono: '+503', moneda_codigo: 'USD', moneda_simbolo: '$' },
    { id: 3, codigo: 'HN', nombre: 'Honduras', codigo_telefono: '+504', moneda_codigo: 'HNL', moneda_simbolo: 'L' },
    { id: 4, codigo: 'NI', nombre: 'Nicaragua', codigo_telefono: '+505', moneda_codigo: 'NIO', moneda_simbolo: 'C$' },
    { id: 5, codigo: 'CR', nombre: 'Costa Rica', codigo_telefono: '+506', moneda_codigo: 'CRC', moneda_simbolo: '₡' },
    { id: 6, codigo: 'BZ', nombre: 'Belice', codigo_telefono: '+501', moneda_codigo: 'BZD', moneda_simbolo: 'BZ$' }
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
  valeTecnicas: [
    { id: 1, nombre: 'Grabado Láser', activo: 1 },
    { id: 2, nombre: 'Sublimación', activo: 1 },
    { id: 3, nombre: 'Impresión UV', activo: 1 },
    { id: 4, nombre: 'Vinil de Corte', activo: 1 }
  ],
  valeAcabados: [
    { id: 1, nombre: 'Brillante', activo: 1 },
    { id: 2, nombre: 'Mate', activo: 1 },
    { id: 3, nombre: 'Satinado', activo: 1 }
  ],
  asesorLimites: [
    { id: 1, asesor_id: 3, limite_diario: 6, activo: 1 }
  ],
  vales: [
    { id: 1, correlativo: 'GUA-3-0001', asesor_id: 3, localidad_id: 1, fecha_creacion: '2026-08-19', hora_creacion: '08:30:00', fecha_entrega: '2026-08-22 17:00:00', fecha_evento: '2026-08-25 09:00:00', urgente: 0, cliente_empresa: 'Corporación Deportiva S.A.', cliente_nombre: 'Juan Pérez', cliente_telefono: '+502 5555-1111', cliente_correo: 'juan.perez@corpdeportiva.com', producto_id: 1, material_id: 2, tecnica_id: 1, acabado_id: 1, cantidad: 50, cotizacion: 1500.00, descripcion: 'Trofeos para premiación anual de ventas.', descripcion_original: null, pdf_url: null, modificado: 0, tiene_adjuntos: 0, justificacion_modificacion: null, estado: 'CREADO', creado_en: '2026-08-19 08:30:00', actualizado_en: '2026-08-19 08:30:00' },
    { id: 2, correlativo: 'GUA-3-0002', asesor_id: 3, localidad_id: 1, fecha_creacion: '2026-08-18', hora_creacion: '09:15:00', fecha_entrega: '2026-08-20 17:00:00', fecha_evento: '2026-08-23 09:00:00', urgente: 0, cliente_empresa: 'Liga Guatemalteca', cliente_nombre: 'María López', cliente_telefono: '+502 5555-2222', cliente_correo: 'maria.lopez@liga.gt', producto_id: 2, material_id: 1, tecnica_id: 2, acabado_id: 2, cantidad: 200, cotizacion: 800.00, descripcion: 'Medallas para maratón centroamericano.', descripcion_original: null, pdf_url: null, modificado: 0, tiene_adjuntos: 0, justificacion_modificacion: null, estado: 'ASIGNADO', creado_en: '2026-08-18 09:15:00', actualizado_en: '2026-08-18 09:30:00' },
    { id: 3, correlativo: 'GUA-3-0003', asesor_id: 3, localidad_id: 1, fecha_creacion: '2026-08-17', hora_creacion: '10:00:00', fecha_entrega: '2026-08-21 17:00:00', fecha_evento: '2026-08-24 09:00:00', urgente: 1, cliente_empresa: 'Club Atlético GUA', cliente_nombre: 'Carlos Ruiz', cliente_telefono: '+502 5555-3333', cliente_correo: 'carlos.ruiz@clubgua.com', producto_id: 3, material_id: 3, tecnica_id: 3, acabado_id: 3, cantidad: 30, cotizacion: 950.00, descripcion: 'Placas conmemorativas grabadas en madera.', descripcion_original: null, pdf_url: null, modificado: 0, tiene_adjuntos: 0, justificacion_modificacion: null, estado: 'EN_PROCESO', creado_en: '2026-08-17 10:00:00', actualizado_en: '2026-08-17 10:30:00' },
    { id: 4, correlativo: 'GUA-3-0004', asesor_id: 3, localidad_id: 1, fecha_creacion: '2026-08-14', hora_creacion: '11:20:00', fecha_entrega: '2026-08-18 17:00:00', fecha_evento: '2026-08-20 09:00:00', urgente: 1, cliente_empresa: 'MundiEventos', cliente_nombre: 'Ana Gómez', cliente_telefono: '+502 5555-4444', cliente_correo: 'ana.gomez@mundieventos.com', producto_id: 1, material_id: 4, tecnica_id: 1, acabado_id: 1, cantidad: 15, cotizacion: 2200.00, descripcion: 'Trofeos de cristal para gala anual.', descripcion_original: null, pdf_url: null, modificado: 0, tiene_adjuntos: 0, justificacion_modificacion: null, estado: 'EN_REVISION', creado_en: '2026-08-14 11:20:00', actualizado_en: '2026-08-17 16:00:00' },
    { id: 5, correlativo: 'GUA-3-0005', asesor_id: 3, localidad_id: 1, fecha_creacion: '2026-08-13', hora_creacion: '08:45:00', fecha_entrega: '2026-08-17 17:00:00', fecha_evento: '2026-08-19 09:00:00', urgente: 0, cliente_empresa: 'Federación Nacional', cliente_nombre: 'Luis Herrera', cliente_telefono: '+502 5555-5555', cliente_correo: 'luis.herrera@fednacional.org', producto_id: 4, material_id: 1, tecnica_id: 3, acabado_id: 2, cantidad: 5, cotizacion: 600.00, descripcion: 'Banners UV para evento deportivo.', descripcion_original: null, pdf_url: null, modificado: 0, tiene_adjuntos: 0, justificacion_modificacion: null, estado: 'APROBADO', creado_en: '2026-08-13 08:45:00', actualizado_en: '2026-08-15 12:00:00' },
    { id: 6, correlativo: 'GUA-3-0006', asesor_id: 3, localidad_id: 1, fecha_creacion: '2026-08-10', hora_creacion: '13:00:00', fecha_entrega: '2026-08-15 17:00:00', fecha_evento: '2026-08-16 09:00:00', urgente: 0, cliente_empresa: 'Copa MundiTrofeos', cliente_nombre: 'Diego Alvarado', cliente_telefono: '+502 5555-6666', cliente_correo: 'diego.alvarado@copamt.com', producto_id: 1, material_id: 2, tecnica_id: 1, acabado_id: 1, cantidad: 100, cotizacion: 3200.00, descripcion: 'Trofeos de premiación Copa MundiTrofeos.', descripcion_original: null, pdf_url: null, modificado: 0, tiene_adjuntos: 0, justificacion_modificacion: null, estado: 'VENDIDO', creado_en: '2026-08-10 13:00:00', actualizado_en: '2026-08-12 10:00:00' },
    { id: 7, correlativo: 'GUA-3-0007', asesor_id: 3, localidad_id: 1, fecha_creacion: '2026-08-09', hora_creacion: '15:30:00', fecha_entrega: '2026-08-16 17:00:00', fecha_evento: '2026-08-17 09:00:00', urgente: 0, cliente_empresa: 'Cliente particular', cliente_nombre: 'Sofía Ramírez', cliente_telefono: '+502 5555-7777', cliente_correo: 'sofia.ramirez@correo.com', producto_id: 2, material_id: 1, tecnica_id: 2, acabado_id: 2, cantidad: 40, cotizacion: 450.00, descripcion: 'Medallas para evento escolar (venta no concretada).', descripcion_original: null, pdf_url: null, modificado: 0, tiene_adjuntos: 0, justificacion_modificacion: null, estado: 'CANCELADO', creado_en: '2026-08-09 15:30:00', actualizado_en: '2026-08-09 16:00:00' }
  ],
  valeAsignaciones: [
    { id: 1, vale_id: 2, tecnico_id: 7, encargado_id: 5, fecha_asignacion: '2026-08-18 09:30:00', activo: 1 },
    { id: 2, vale_id: 3, tecnico_id: 7, encargado_id: 5, fecha_asignacion: '2026-08-17 10:30:00', activo: 1 },
    { id: 3, vale_id: 4, tecnico_id: 8, encargado_id: 5, fecha_asignacion: '2026-08-14 11:45:00', activo: 1 },
    { id: 4, vale_id: 5, tecnico_id: 9, encargado_id: 6, fecha_asignacion: '2026-08-13 09:00:00', activo: 1 },
    { id: 5, vale_id: 6, tecnico_id: 7, encargado_id: 5, fecha_asignacion: '2026-08-10 13:20:00', activo: 1 }
  ],
  valePropuestas: [
    { id: 1, vale_id: 4, tecnico_id: 8, url: null, es_cancelacion: 0, fecha_subida: '2026-08-17 16:00:00' },
    { id: 2, vale_id: 5, tecnico_id: 9, url: null, es_cancelacion: 0, fecha_subida: '2026-08-15 12:00:00' },
    { id: 3, vale_id: 6, tecnico_id: 7, url: null, es_cancelacion: 0, fecha_subida: '2026-08-12 10:00:00' }
  ],
  valeDocumentos: [],
  valeHistorial: [
    { id: 1, vale_id: 1, usuario_id: 3, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor', creado_en: '2026-08-19 08:30:00' },
    { id: 2, vale_id: 2, usuario_id: 3, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor', creado_en: '2026-08-18 09:15:00' },
    { id: 3, vale_id: 2, usuario_id: 5, estado_anterior: 'CREADO', estado_nuevo: 'ASIGNADO', accion: 'Asignado al técnico Técnico Diseño A', creado_en: '2026-08-18 09:30:00' },
    { id: 4, vale_id: 3, usuario_id: 3, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor', creado_en: '2026-08-17 10:00:00' },
    { id: 5, vale_id: 3, usuario_id: 5, estado_anterior: 'CREADO', estado_nuevo: 'ASIGNADO', accion: 'Asignado al técnico Técnico Diseño A', creado_en: '2026-08-17 10:30:00' },
    { id: 6, vale_id: 4, usuario_id: 3, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor', creado_en: '2026-08-14 11:20:00' },
    { id: 7, vale_id: 4, usuario_id: 5, estado_anterior: 'CREADO', estado_nuevo: 'ASIGNADO', accion: 'Asignado al técnico Técnico Diseño B', creado_en: '2026-08-14 11:45:00' },
    { id: 8, vale_id: 4, usuario_id: 8, estado_anterior: 'ASIGNADO', estado_nuevo: 'EN_REVISION', accion: 'Técnico entregó propuesta', creado_en: '2026-08-17 16:00:00' },
    { id: 9, vale_id: 5, usuario_id: 3, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor', creado_en: '2026-08-13 08:45:00' },
    { id: 10, vale_id: 5, usuario_id: 6, estado_anterior: 'CREADO', estado_nuevo: 'ASIGNADO', accion: 'Asignado al técnico Técnico UV/3D C', creado_en: '2026-08-13 09:00:00' },
    { id: 11, vale_id: 5, usuario_id: 9, estado_anterior: 'ASIGNADO', estado_nuevo: 'EN_REVISION', accion: 'Técnico entregó propuesta', creado_en: '2026-08-15 12:00:00' },
    { id: 12, vale_id: 5, usuario_id: 6, estado_anterior: 'EN_REVISION', estado_nuevo: 'APROBADO', accion: 'Encargado aprobó la propuesta', creado_en: '2026-08-15 12:30:00' },
    { id: 13, vale_id: 6, usuario_id: 3, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor', creado_en: '2026-08-10 13:00:00' },
    { id: 14, vale_id: 6, usuario_id: 5, estado_anterior: 'CREADO', estado_nuevo: 'ASIGNADO', accion: 'Asignado al técnico Técnico Diseño A', creado_en: '2026-08-10 13:20:00' },
    { id: 15, vale_id: 6, usuario_id: 7, estado_anterior: 'ASIGNADO', estado_nuevo: 'EN_REVISION', accion: 'Técnico entregó propuesta', creado_en: '2026-08-12 10:00:00' },
    { id: 16, vale_id: 6, usuario_id: 5, estado_anterior: 'EN_REVISION', estado_nuevo: 'APROBADO', accion: 'Encargado aprobó la propuesta', creado_en: '2026-08-12 10:30:00' },
    { id: 17, vale_id: 6, usuario_id: 3, estado_anterior: 'APROBADO', estado_nuevo: 'VENDIDO', accion: 'Asesor confirmó la venta', creado_en: '2026-08-12 11:00:00' },
    { id: 18, vale_id: 7, usuario_id: 3, estado_anterior: null, estado_nuevo: 'CREADO', accion: 'Vale de arte creado por el asesor', creado_en: '2026-08-09 15:30:00' },
    { id: 19, vale_id: 7, usuario_id: 3, estado_anterior: 'CREADO', estado_nuevo: 'CANCELADO', accion: 'Asesor canceló el vale de arte', creado_en: '2026-08-09 16:00:00' }
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
  'catalog:localidades': () => mockDatabase.localidades.filter(l => l.activo),
  'catalog:productos': () => mockDatabase.valeProductos.filter(p => p.activo),
  'catalog:materiales': () => mockDatabase.valeMateriales.filter(m => m.activo),
  'catalog:tecnicas': () => mockDatabase.valeTecnicas.filter(t => t.activo),
  'catalog:acabados': () => mockDatabase.valeAcabados.filter(a => a.activo),
  'catalog:paises': () => mockDatabase.paises,

  // Estas consultas nunca deben exponer password_hash: a diferencia de MySQL real (que
  // solo devuelve las columnas listadas en el SELECT), el mock ignora el SQL, así que
  // hay que despojar el hash explícitamente antes de regresar los objetos.
  'usuario:find_by_id': (params) => {
    const u = mockDatabase.usuarios.find(x => x.id === Number(params[0]));
    return u ? [sinPasswordHash(u)] : [];
  },
  'usuario:find_tecnicos_by_encargado': (params) => {
    return mockDatabase.usuarios
      .filter(u => u.rol_id === 7 && u.encargado_id === Number(params[0]) && u.activo)
      .map(sinPasswordHash);
  },
  'usuario:find_encargados': () => {
    return mockDatabase.usuarios.filter(u => (u.rol_id === 5 || u.rol_id === 6) && u.activo).map(sinPasswordHash);
  },
  'usuario:find_by_rol': (params) => {
    return mockDatabase.usuarios.filter(u => u.rol_id === Number(params[0]) && u.activo).map(sinPasswordHash);
  },

  'asesor_limite:get': (params) => {
    const limite = mockDatabase.asesorLimites.find(l => l.asesor_id === Number(params[0]) && l.activo);
    return limite ? [limite] : [];
  },

  'vale:insert': (params) => {
    const [correlativo, asesorId, localidadId, fechaCreacion, horaCreacion, fechaEntrega, fechaEvento, urgente,
      clienteEmpresa, clienteNombre, clienteTelefono, clienteCorreo, productoId, materialId, tecnicaId, acabadoId,
      cantidad, cotizacion, descripcion] = params;
    const now = ahoraLocal();
    const row = {
      id: nextId(mockDatabase.vales), correlativo, asesor_id: Number(asesorId), localidad_id: Number(localidadId),
      fecha_creacion: fechaCreacion, hora_creacion: horaCreacion, fecha_entrega: fechaEntrega, fecha_evento: fechaEvento,
      urgente: urgente ? 1 : 0, cliente_empresa: clienteEmpresa || null, cliente_nombre: clienteNombre,
      cliente_telefono: clienteTelefono, cliente_correo: clienteCorreo, producto_id: productoId || null,
      material_id: materialId || null, tecnica_id: tecnicaId || null, acabado_id: acabadoId || null,
      cantidad: Number(cantidad), cotizacion: Number(cotizacion), descripcion: descripcion || null,
      descripcion_original: null, pdf_url: null, modificado: 0, tiene_adjuntos: 0, justificacion_modificacion: null,
      estado: 'CREADO', creado_en: now, actualizado_en: now
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
  'vale:count_por_asesor': (params) => {
    const count = mockDatabase.vales.filter(v => v.asesor_id === Number(params[0])).length;
    return [{ total: count }];
  },
  'vale:count_por_fecha': (params) => {
    const [asesorId, fecha] = params;
    const count = mockDatabase.vales.filter(v => v.asesor_id === Number(asesorId) && v.fecha_creacion === fecha).length;
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
  'vale:update_tiene_adjuntos': (params) => {
    const [valor, id] = params;
    const v = mockDatabase.vales.find(x => x.id === Number(id));
    if (v) v.tiene_adjuntos = valor ? 1 : 0;
    return { affectedRows: v ? 1 : 0 };
  },
  'vale:solicitar_modificacion': (params) => {
    const [descripcionOriginal, descripcionNueva, correlativoNuevo, justificacion, estado, id] = params;
    const v = mockDatabase.vales.find(x => x.id === Number(id));
    if (v) {
      v.descripcion_original = descripcionOriginal;
      v.descripcion = descripcionNueva;
      v.correlativo = correlativoNuevo;
      v.justificacion_modificacion = justificacion;
      v.modificado = 1;
      v.estado = estado;
      v.actualizado_en = ahoraLocal();
    }
    return { affectedRows: v ? 1 : 0 };
  },

  'asignacion:insert': (params) => {
    const [valeId, tecnicoId, encargadoId, fechaAsignacion] = params;
    const row = {
      id: nextId(mockDatabase.valeAsignaciones), vale_id: Number(valeId), tecnico_id: Number(tecnicoId),
      encargado_id: Number(encargadoId), fecha_asignacion: fechaAsignacion, activo: 1
    };
    mockDatabase.valeAsignaciones.push(row);
    return { insertId: row.id };
  },
  'asignacion:deactivate_by_vale': (params) => {
    mockDatabase.valeAsignaciones.filter(a => a.vale_id === Number(params[0])).forEach(a => { a.activo = 0; });
    return { affectedRows: 1 };
  },
  'asignacion:list_by_vale': (params) => {
    return mockDatabase.valeAsignaciones
      .filter(a => a.vale_id === Number(params[0]))
      .sort((a, b) => a.id - b.id);
  },
  'asignacion:list_activas_by_tecnico': (params) => {
    return mockDatabase.valeAsignaciones.filter(a => a.tecnico_id === Number(params[0]) && a.activo);
  },
  'asignacion:list_activas_by_encargado': (params) => {
    return mockDatabase.valeAsignaciones.filter(a => a.encargado_id === Number(params[0]) && a.activo);
  },

  'propuesta:insert': (params) => {
    const [valeId, tecnicoId, url, esCancelacion, fechaSubida] = params;
    const row = {
      id: nextId(mockDatabase.valePropuestas), vale_id: Number(valeId), tecnico_id: Number(tecnicoId),
      url: url || null, es_cancelacion: esCancelacion ? 1 : 0, fecha_subida: fechaSubida
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

  'historial:insert': (params) => {
    const [valeId, usuarioId, estadoAnterior, estadoNuevo, accion] = params;
    const row = {
      id: nextId(mockDatabase.valeHistorial), vale_id: Number(valeId), usuario_id: Number(usuarioId),
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

initializeDatabase();

module.exports = {
  query,
  getUseMock: () => useMock,
  isReady: () => pool !== null || useMock
};
