import { ROL } from './roles.js';

const PERMISO_FUSION = 'vales.aprobar_general';

// "Atrasados" para asesor, supervisor y encargados es un contador COMBINABLE
// (`atrasadosGlobal: true`) — renderContadores() lo trata como un interruptor
// aparte (state.soloAtrasados) que puede activarse junto con cualquier otro
// filtro de contador. El técnico queda afuera: su "Asignados con atraso" es
// su propio filtro fijo.
export const CONTADORES_CONFIG = {
  [ROL.ASESOR]: {
    buzon: [
      { key: 'rechazados', label: 'Rechazados', filtro: 'rechazados', alerta: true },
      { key: 'esperandoAutorizacion', label: 'Esperando autorización', filtro: 'esperandoAutorizacion' },
      { key: 'valesPorRevisar', label: 'Pend. confirmación', filtro: 'valesPorRevisar' },
      { key: 'valesPendientesModificacion', label: 'Solicitando modificación', filtro: 'valesPendientesModificacion' },
      { key: 'atrasados', label: 'Atrasados', alerta: true, atrasadosGlobal: true }
    ],
    trabajo: [
      { key: 'recibidosHoy', label: 'Recibidos hoy', filtro: 'recibidosHoy' },
      { key: 'totalRecibidos', label: 'Total recibidos', filtro: 'totalRecibidos' }
    ]
  },
  [ROL.SUPERVISOR]: {
    buzon: [
      // Contador colectivo "autorizados/asesores" — lo calcula el servidor.
      { key: 'valesAutorizadosHoy', label: 'Autorizados hoy (equipo)', esTexto: true },
      { key: 'pendientesAutorizacion', label: 'Por autorizar creación', filtro: 'pendientesAutorizacion' },
      { key: 'pendientesConfirmarModificacion', label: 'Por autorizar modificación', filtro: 'pendientesConfirmarModificacion' },
      { key: 'modificados', label: 'Modificados', filtro: 'modificados' },
      { key: 'pendientesConfirmacion', label: 'Pend. confirmación asesor', filtro: 'pendientesConfirmacion' },
      { key: 'atrasados', label: 'Atrasados', alerta: true, atrasadosGlobal: true }
    ],
    // Dos grupos — lo que él autorizó, y lo que sus asesores confirmaron de recibido.
    trabajo: [
      { key: 'autorizadosHoy', label: 'Autorizados hoy', filtro: 'autorizadosHoy' },
      { key: 'totalAutorizados', label: 'Total autorizados', filtro: 'totalAutorizados' },
      { key: 'confirmadosHoy', label: 'Confirmados hoy', filtro: 'confirmadosHoy' },
      { key: 'totalConfirmados', label: 'Total confirmados', filtro: 'totalConfirmados' }
    ]
  },
  // Encargado de un taller (cualquiera de los roles de encargado). Las
  // tarjetas con `permiso` solo se muestran a quien lo tiene: la cola de
  // fusión (pendientesFusion/fusionadosHoy/totalFusionados) la ve quien tenga
  // vales.aprobar_general, sea cual sea su rol. "Aprobados hoy" no está en el
  // buzón: un vale aprobado sale de ahí y pasa a Trabajo Realizado.
  [ROL.ENCARGADO_DISENO]: {
    buzon: [
      { key: 'pendientesAsignacion', label: 'Pend. asignación', filtro: 'pendientesAsignacion' },
      { key: 'asignados', label: 'Asignados', filtro: 'asignados' },
      { key: 'enProceso', label: 'En proceso', filtro: 'enProceso' },
      { key: 'enPausa', label: 'En pausa', filtro: 'enPausa' },
      { key: 'enRevision', label: 'En revisión', filtro: 'enRevision' },
      { key: 'pendientesFusion', label: 'Vales por fusionar', filtro: 'pendientesFusion', permiso: PERMISO_FUSION },
      { key: 'atrasados', label: 'Atrasados', alerta: true, atrasadosGlobal: true }
    ],
    trabajo: [
      { key: 'aprobadosHoy', label: 'Aprobados hoy', filtro: 'aprobadosHoy' },
      { key: 'totalAprobados', label: 'Total aprobados', filtro: 'totalAprobados' },
      { key: 'fusionadosHoy', label: 'Fusionados hoy', filtro: 'fusionadosHoy', permiso: PERMISO_FUSION },
      { key: 'totalFusionados', label: 'Total fusionados', filtro: 'totalFusionados', permiso: PERMISO_FUSION }
    ]
  },
  [ROL.TECNICO]: {
    buzon: [
      { key: 'asignados', label: 'Asignados sin atraso', filtro: 'asignados' },
      { key: 'asignadosAtrasados', label: 'Asignados con atraso', alerta: true, filtro: 'asignadosAtrasados' },
      { key: 'enProceso', label: 'Vale en proceso', esTexto: true }
    ],
    trabajo: [
      { key: 'totalAprobados', label: 'Total aprobados' },
      { key: 'aprobadosHoy', label: 'Aprobados hoy', filtro: 'aprobadosHoy' }
    ]
  }
};
CONTADORES_CONFIG[ROL.ENCARGADO_UV3D] = CONTADORES_CONFIG[ROL.ENCARGADO_DISENO];
CONTADORES_CONFIG[ROL.ASISTENTE_DISENO] = CONTADORES_CONFIG[ROL.ENCARGADO_DISENO];
CONTADORES_CONFIG[ROL.ENCARGADO_PROTEXTIL] = CONTADORES_CONFIG[ROL.ENCARGADO_DISENO];
CONTADORES_CONFIG[ROL.ENCARGADO_DISENO_LOCAL] = CONTADORES_CONFIG[ROL.ENCARGADO_DISENO];
CONTADORES_CONFIG[ROL.ADMINISTRADOR] = [ // vista de control general
  { key: 'total', label: 'Total vales' },
  { key: 'pendientesConfirmacion', label: 'Pend. confirmación', filtro: 'pendientesConfirmacion' },
  { key: 'aprobadoDepartamento', label: 'Por fusionar', filtro: 'aprobadoDepartamento' },
  { key: 'atrasados', label: 'Atrasados', alerta: true, filtro: 'atrasados' }
];
