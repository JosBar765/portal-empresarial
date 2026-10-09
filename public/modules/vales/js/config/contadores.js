import { ROL } from './roles.js';

const PERMISO_FUSION = 'vales.aprobar_general';

// "Atrasados" y "Modificados" (asesor y supervisor) y "Atrasados" (encargados) son contadores COMBINABLES
// (`atrasadosGlobal` / `modificadosGlobal`) — renderContadores() los trata como interruptores aparte
// (state.soloAtrasados / state.soloModificados) que pueden activarse junto con cualquier otro filtro de
// contador. El diseñador queda afuera: su "Mis asignaciones (con atraso)" es su propio filtro fijo.
// `quien` es quién tiene que actuar en ese paso; se muestra pequeño bajo la etiqueta.
const CONTADORES_POR_PASO = [
  { key: 'porAutorizar', label: 'Por autorizar', quien: 'Gerencia', filtro: 'porAutorizar' },
  { key: 'porAsignar', label: 'Por asignar', quien: 'Encargado de taller', filtro: 'porAsignar' },
  { key: 'enProceso', label: 'En proceso', quien: 'Diseñador', filtro: 'enProceso' },
  { key: 'enRevision', label: 'En revisión', quien: 'Encargado de taller', filtro: 'enRevision' },
  { key: 'porRecibir', label: 'Por recibir', quien: 'Asesor', filtro: 'porRecibir' },
  { key: 'modificados', label: 'Modificados', modificadosGlobal: true },
  { key: 'atrasados', label: 'Atrasados', alerta: true, atrasadosGlobal: true }
];

export const CONTADORES_CONFIG = {
  [ROL.ASESOR]: {
    buzon: CONTADORES_POR_PASO,
    trabajo: [
      { key: 'recibidosHoy', label: 'Recibidos hoy', filtro: 'recibidosHoy' },
      { key: 'totalRecibidos', label: 'Total recibidos', filtro: 'totalRecibidos' }
    ]
  },
  [ROL.SUPERVISOR]: {
    buzon: [
      ...CONTADORES_POR_PASO
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
      { key: 'porAsignar', label: 'Por asignar', filtro: 'porAsignar' },
      { key: 'asignadosDisenadores', label: 'Asignado', quien: 'Diseñadores', filtro: 'asignadosDisenadores' },
      { key: 'misAsignaciones', label: 'Mis asignaciones', filtro: 'misAsignaciones' },
      { key: 'porRevisar', label: 'Por revisar', filtro: 'porRevisar' },
      { key: 'pendientesFusion', label: 'Por fusionar', filtro: 'pendientesFusion', permiso: PERMISO_FUSION },
      { key: 'atrasados', label: 'Atrasados', alerta: true, atrasadosGlobal: true }
    ],
    trabajo: [
      { key: 'aprobadosHoy', label: 'Aprobados hoy', filtro: 'aprobadosHoy' },
      { key: 'totalAprobados', label: 'Total aprobados', filtro: 'totalAprobados' },
      { key: 'fusionadosHoy', label: 'Fusionados hoy', filtro: 'fusionadosHoy', permiso: PERMISO_FUSION },
      { key: 'totalFusionados', label: 'Total fusionados', filtro: 'totalFusionados', permiso: PERMISO_FUSION }
    ]
  },
  [ROL.DISENADOR]: {
    buzon: [
      { key: 'asignados', label: 'Mis asignaciones (Sin retraso)', filtro: 'asignados' },
      { key: 'asignadosAtrasados', label: 'Mis asignaciones (Con atraso)', alerta: true, filtro: 'asignadosAtrasados' },
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
CONTADORES_CONFIG[ROL.GERENTE] = CONTADORES_CONFIG[ROL.ADMINISTRADOR]; // solo lectura, misma vista general
