// Numeración de roles — debe reflejar exactamente database/schema.sql.
export const ROL_ADMINISTRADOR = 1;
export const ROL_ASESOR = 2;
export const ROL_SUPERVISOR = 3;
export const ROL_DISENADOR = 6;
export const ROL_ENCARGADO_DISENO_LOCAL = 10;

// Mismos roles/tiendas que valida el backend.
export const ROLES_ENCARGADO_UNICO = [4, 5, 9];

// Rol de encargado que corresponde a un taller según su nombre.
export function rolEncargadoDeTaller(taller) {
  if (taller.nombre === 'Diseño') return 4;
  if (taller.nombre === 'Diseño UV/3D') return 5;
  if (taller.nombre === 'Protextil') return 9;
  return ROL_ENCARGADO_DISENO_LOCAL;
}

// Un rol de asistente es el que hereda de un rol de encargado (hereda_de_rol_id).
export function rolPadreDe(rolId, roles) {
  const rol = roles.find(r => Number(r.id) === Number(rolId));
  return rol && rol.hereda_de_rol_id ? Number(rol.hereda_de_rol_id) : null;
}
