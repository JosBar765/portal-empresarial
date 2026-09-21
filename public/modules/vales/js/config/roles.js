// Numeración de roles — debe reflejar exactamente database/schema.sql / mockDatabase.roles.
export const ROL = {
  ADMINISTRADOR: 1,
  ASESOR: 2,
  SUPERVISOR: 3,
  ENCARGADO_DISENO: 4,
  ENCARGADO_UV3D: 5,
  TECNICO: 6,
  ASISTENTE_DISENO: 7,
  GERENTE: 8,
  ENCARGADO_PROTEXTIL: 9,
  ENCARGADO_DISENO_LOCAL: 10
};

export const ROLES_ENCARGADO_TALLER = [ROL.ENCARGADO_DISENO, ROL.ENCARGADO_UV3D, ROL.ASISTENTE_DISENO, ROL.ENCARGADO_PROTEXTIL, ROL.ENCARGADO_DISENO_LOCAL];
export const ROLES_TALLER_Y_TECNICO = [...ROLES_ENCARGADO_TALLER, ROL.TECNICO];

// Roles con sidebar Buzón / Trabajo realizado (el Gerente reusa el mismo
// sidebar con su propio par Rendimiento/Encontrar vale — ver layout/sidebar.js).
export const ROLES_CON_SIDEBAR = [ROL.ASESOR, ROL.SUPERVISOR, ...ROLES_TALLER_Y_TECNICO, ROL.GERENTE];
