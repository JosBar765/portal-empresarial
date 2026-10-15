// Numeración de roles — debe reflejar exactamente database/schema.sql / mockDatabase.roles.
export const ROL = {
  ADMINISTRADOR: 1,
  ASESOR: 2,
  SUPERVISOR: 3,
  ENCARGADO_DISENO: 4,
  ENCARGADO_UV3D: 5,
  DISENADOR: 6,
  ASISTENTE_DISENO: 7,
  GERENTE: 8,
  ENCARGADO_PROTEXTIL: 9,
  ENCARGADO_DISENO_LOCAL: 10
};

// Roles de encargado de taller. Un asistente se evalúa por el rol del que hereda.
export const ROLES_ENCARGADO_TALLER = [ROL.ENCARGADO_DISENO, ROL.ENCARGADO_UV3D, ROL.ENCARGADO_PROTEXTIL, ROL.ENCARGADO_DISENO_LOCAL];

// Rol del encargado cuya vista usa el usuario (el propio rol si no es asistente).
// Tokens viejos sin heredaDeRolId: el rol 7 hereda del 4.
export function rolEncargadoDe(user) {
  if (user.heredaDeRolId) return user.heredaDeRolId;
  return user.rolId === ROL.ASISTENTE_DISENO ? ROL.ENCARGADO_DISENO : user.rolId;
}

export function esAsistente(user) {
  return rolEncargadoDe(user) !== user.rolId;
}
export const ROLES_TALLER_Y_DISENADOR = [...ROLES_ENCARGADO_TALLER, ROL.DISENADOR];

// Roles con sidebar (Buzón, Trabajo realizado y Reportes según el rol y sus permisos — ver layout/sidebar.js).
export const ROLES_CON_SIDEBAR = [ROL.ADMINISTRADOR, ROL.ASESOR, ROL.SUPERVISOR, ...ROLES_TALLER_Y_DISENADOR, ROL.GERENTE];
