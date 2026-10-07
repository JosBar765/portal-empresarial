import { state } from './state.js';
import { ROL, ROLES_ENCARGADO_TALLER, ROLES_TALLER_Y_TECNICO } from './config/roles.js';
import { ESTADOS_LABEL, ESTADOS_VISIBLES_LABEL } from './config/estados.js';

export function tienePermiso(codigo) {
  return (state.user.permissions || []).includes(codigo);
}

export function puede(accion) {
  const r = state.user.rolId;
  const admin = r === ROL.ADMINISTRADOR;
  switch (accion) {
    case 'crear': return admin || r === ROL.ASESOR;
    case 'asignar': return admin || ROLES_ENCARGADO_TALLER.includes(r);
    case 'revisar': return admin || ROLES_ENCARGADO_TALLER.includes(r);
    // Un encargado de taller también puede trabajar un vale — pero SOLO si se
    // lo autoasignó (ver esAccionDeTrabajoVisible).
    case 'trabajar': return admin || ROLES_TALLER_Y_TECNICO.includes(r);
    case 'confirmar': return admin || r === ROL.ASESOR;
    case 'solicitarModificacion': return admin || r === ROL.ASESOR;
    case 'aprobarModificacion': return admin || r === ROL.SUPERVISOR;
    case 'autorizarCreacion': return admin || r === ROL.SUPERVISOR;
    // La fusión depende del permiso, no del rol.
    case 'corregir': return r === ROL.ASESOR && tienePermiso('vales.corregir');
    case 'darDeBaja': return r === ROL.ASESOR && tienePermiso('vales.dar_de_baja');
    case 'aprobarGeneral': return admin || tienePermiso('vales.aprobar_general');
    default: return false;
  }
}

// Un encargado de taller ve en su buzón TODOS los vales de su taller,
// incluidos los asignados a sus propios diseñadores — las acciones de diseñador
// (Comenzar/Entregar/Pausar/Cancelar) solo deben mostrarse cuando el vale es
// el que ÉL MISMO se autoasignó. El Diseñador y el Administrador siempre ven
// su/cualquier vale asignado, sin este filtro.
export function esAccionDeTrabajoVisible(v) {
  if (state.user.rolId === ROL.TECNICO || state.user.rolId === ROL.ADMINISTRADOR) return true;
  return Number(v.tecnico_id) === Number(state.user.id);
}

// El supervisor también usa el estado "lógico" (estado_visible), pero solo en
// su vista de Trabajo realizado.
export function usaEstadosVisibles() {
  return state.user.rolId === ROL.ASESOR || (state.user.rolId === ROL.SUPERVISOR && state.vista === 'trabajo');
}

// El estado que corresponde MOSTRAR depende del rol: el asesor ve su versión
// lógica; encargados y diseñadores ven el progreso DENTRO de su taller
// (v.estado_taller); el resto ve el estado general del vale (v.estado).
export function estadoActivo(v) {
  if (usaEstadosVisibles()) return v.estado_visible;
  if (ROLES_TALLER_Y_TECNICO.includes(state.user.rolId)) return v.estado_taller || v.estado;
  return v.estado;
}

export function claseEstado(v) {
  return `estado-${estadoActivo(v)}`;
}

export function etiquetaEstado(v) {
  if (usaEstadosVisibles()) return ESTADOS_VISIBLES_LABEL[v.estado_visible] || v.estado_visible;
  const clave = estadoActivo(v);
  return ESTADOS_LABEL[clave] || clave;
}

// El Asistente de Diseño opera el taller "Diseño" como si fuera su propio
// encargado_id, sin serlo — mismo clon operativo que resuelve el backend
// (_idEncargadoEfectivo).
export function miTaller() {
  const talleres = state.catalogos.talleres || [];
  if (state.user.rolId === ROL.ASISTENTE_DISENO) return talleres.find(t => t.nombre === 'Diseño') || null;
  return talleres.find(t => t.encargado_id === state.user.id) || null;
}

function salasPorRol(user) {
  switch (user.rolId) {
    case ROL.ADMINISTRADOR: return ['vales:admin'];
    case ROL.ASESOR: return [`asesor:${user.id}`];
    case ROL.SUPERVISOR: return [`supervisor:${user.id}`];
    case ROL.ENCARGADO_DISENO:
    case ROL.ENCARGADO_UV3D:
    case ROL.ASISTENTE_DISENO: // se une a la sala del taller "Diseño"
    case ROL.ENCARGADO_PROTEXTIL:
    case ROL.ENCARGADO_DISENO_LOCAL: {
      const taller = miTaller();
      return taller ? [`taller:${taller.id}`] : [];
    }
    case ROL.TECNICO: return [`tecnico:${user.id}`];
    // Gerente: rol de solo lectura sin ninguna acción sobre los vales — no
    // recibe ninguna notificación en tiempo real, ni siquiera las de
    // Administrador vía `vales:admin`.
    case ROL.GERENTE: return [];
    default: return [];
  }
}

// Quien puede fusionar vales multi-taller recibe además la sala de fusión,
// sea cual sea su rol o taller: el aviso sigue al permiso.
export function roomsParaUsuario(user) {
  const salas = salasPorRol(user);
  if ((user.permissions || []).includes('vales.aprobar_general')) salas.push('vales:fusion');
  return salas;
}
