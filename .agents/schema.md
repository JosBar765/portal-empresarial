# CÓDIGO DE UN ESQUEMA SQL

Escrito en `dbdiagram.io` sintaxis.

\---

Enum estado_vale_enum {
  CREADO //
  ASIGNADO //
  EN_PROCESO //
  EN_REVISION //
  APROBADO //
  CONFIRMACION_MODIFICACION //
  MODIFICADO //
  VENDIDO //[cite: 9]
  CANCELADO //[cite: 9]
}

Table Localidad {
  id int [pk, increment]
  codigo varchar(10) [not null, unique, note: 'Ej: GUA']
  nombre varchar(100) [not null]
  activo boolean [default: true]
}

Table Rol {
  id int [pk, increment]
  nombre varchar(50) [not null]
}

Table Usuario {
  id int [pk, increment]
  nombre varchar(100) [not null]
  email varchar(100) [not null, unique]
  telefono varchar(20)
  rol_id int [not null, ref: > Rol.id]
  localidad_id int [ref: > Localidad.id]
  activo boolean [default: true]
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]
}

Table AsesorLimite {
  id int [pk, increment]
  asesor_id int [not null, ref: > Usuario.id]
  limite_diario int [not null, default: 6, note: 'Límite diario dictado por el sistema'] //[cite: 9]
  activo boolean [default: true]
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]
}

Table Vale {
  id int [pk, increment]
  correlativo varchar(60) [not null, unique, note: 'Estructura: [MOD-]LOCALIDAD-ASESOR-0001'] //[cite: 9]
  asesor_id int [not null, ref: > Usuario.id] //[cite: 9]
  fecha_creacion date [not null] //[cite: 9]
  hora_creacion time [not null] //[cite: 9]
  fecha_entrega datetime [not null] //[cite: 9]
  fecha_evento datetime [not null] //[cite: 9]
  urgente boolean [default: false] //[cite: 9]
  cantidad int [not null, note: 'Debe ser > 1'] //[cite: 9]
  cotizacion decimal(10,2) [not null] //[cite: 9]
  url text
  
  // Control de Modificaciones
  modificado int [default: 0, note: 'Max 1 permitida'] //[cite: 9]
  justificacion_modificacion text [note: 'Justificación que evalúa el supervisor'] //[cite: 9]
  
  estado estado_vale_enum [not null, default: 'CREADO'] //[cite: 9]
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]
}

Table asignaciones {
  id int [pk, increment]
  vale_id int [not null, ref: > Vale.id]
  tecnico_id int [not null, ref: > Usuario.id] //[cite: 9]
  encargado_id int [not null, ref: > Usuario.id] //[cite: 9]
  fecha_asignacion datetime [not null]
  activo boolean [default: true, note: 'Determina la asignación vigente para la carga de trabajo'] //[cite: 9]
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]
}

Table propuestas {
  id int [pk, increment]
  vale_id int [not null, ref: > Vale.id]
  tecnico_id int [not null, ref: > Usuario.id]
  url text
  fecha_subida datetime [not null]
  created_at timestamp [default: `now()`]
  updated_at timestamp [default: `now()`]
}

Table historial_vales {
  id int [pk, increment]
  vale_id int [not null, ref: > Vale.id]
  usuario_id int [not null, ref: > Usuario.id]
  estado_anterior varchar(50)
  estado_nuevo varchar(50) [not null] //[cite: 9]
  accion varchar(100) [not null]
  created_at timestamp [default: `now()`] //[cite: 9]
}