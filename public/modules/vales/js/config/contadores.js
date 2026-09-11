import { ROL } from './roles.js';

// "Atrasados" para asesor, supervisor y encargados es un contador COMBINABLE
// (`atrasadosGlobal: true`) — renderContadores() lo trata como un interruptor
// aparte (state.soloAtrasados) que puede activarse junto con cualquier otro
// filtro de contador. El técnico queda afuera: su "Asignados con atraso" es
// su propio filtro fijo.
export const CONTADORES_CONFIG = {
  [ROL.ASESOR]: {
    buzon: [
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
      // Contador colectivo ascendente "autorizados/asesores" — se calcula
      // aparte, ver views/buzon.js (cargarBuzon).
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
  [ROL.ENCARGADO_DISENO]: { // Encargado de un taller, con sidebar
    // "Aprobados hoy" no está: un vale aprobado sale del buzón y pasa a
    // Trabajo Realizado. Este rol también fusiona (vales.aprobar_general), así
    // que su buzón/trabajo mezclan la cola de fusión (pendientesFusion/
    // fusionadosHoy/totalFusionados).
    buzon: [
      { key: 'pendientesAsignacion', label: 'Pend. asignación', filtro: 'pendientesAsignacion' },
      { key: 'asignados', label: 'Asignados', filtro: 'asignados' },
      { key: 'enProceso', label: 'En proceso', filtro: 'enProceso' },
      { key: 'enPausa', label: 'En pausa', filtro: 'enPausa' },
      { key: 'enRevision', label: 'En revisión', filtro: 'enRevision' },
      { key: 'pendientesFusion', label: 'Vales por fusionar', filtro: 'pendientesFusion' },
      { key: 'atrasados', label: 'Atrasados', alerta: true, atrasadosGlobal: true }
    ],
    trabajo: [
      { key: 'aprobadosHoy', label: 'Aprobados hoy', filtro: 'aprobadosHoy' },
      { key: 'totalAprobados', label: 'Total aprobados', filtro: 'totalAprobados' },
      { key: 'fusionadosHoy', label: 'Fusionados hoy', filtro: 'fusionadosHoy' },
      { key: 'totalFusionados', label: 'Total fusionados', filtro: 'totalFusionados' }
    ]
  },
  // Encargado de un taller SIN fusión (Diseño UV/3D, Protextil, Diseño
  // Local): misma forma que el Encargado de Diseño pero sin las tarjetas de
  // fusión (el backend nunca les manda esas claves).
  [ROL.ENCARGADO_UV3D]: {
    buzon: [
      { key: 'pendientesAsignacion', label: 'Pend. asignación', filtro: 'pendientesAsignacion' },
      { key: 'asignados', label: 'Asignados', filtro: 'asignados' },
      { key: 'enProceso', label: 'En proceso', filtro: 'enProceso' },
      { key: 'enPausa', label: 'En pausa', filtro: 'enPausa' },
      { key: 'enRevision', label: 'En revisión', filtro: 'enRevision' },
      { key: 'atrasados', label: 'Atrasados', alerta: true, atrasadosGlobal: true }
    ],
    trabajo: [
      { key: 'aprobadosHoy', label: 'Aprobados hoy', filtro: 'aprobadosHoy' },
      { key: 'totalAprobados', label: 'Total aprobados', filtro: 'totalAprobados' }
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
// Asistente de Diseño: clon operativo COMPLETO del Encargado de Diseño —
// mismas tarjetas, incluida la fusión.
CONTADORES_CONFIG[ROL.ASISTENTE_DISENO] = CONTADORES_CONFIG[ROL.ENCARGADO_DISENO];
// Encargado de taller de Protextil / Diseño Local: misma forma que Diseño UV/3D — sin fusión.
CONTADORES_CONFIG[ROL.ENCARGADO_PROTEXTIL] = CONTADORES_CONFIG[ROL.ENCARGADO_UV3D];
CONTADORES_CONFIG[ROL.ENCARGADO_DISENO_LOCAL] = CONTADORES_CONFIG[ROL.ENCARGADO_UV3D];
CONTADORES_CONFIG[ROL.ADMINISTRADOR] = [ // vista de control general
  { key: 'total', label: 'Total vales' },
  { key: 'pendientesConfirmacion', label: 'Pend. confirmación', filtro: 'pendientesConfirmacion' },
  { key: 'aprobadoDepartamento', label: 'Por fusionar', filtro: 'aprobadoDepartamento' },
  { key: 'atrasados', label: 'Atrasados', alerta: true, filtro: 'atrasados' }
];
// Gerente (Vista Gerencia): mismo resumen que el administrador para su vista
// "Vales de Arte" — es de solo lectura, respeta la misma jerarquía.
CONTADORES_CONFIG[ROL.GERENTE] = CONTADORES_CONFIG[ROL.ADMINISTRADOR];

// "Modificados" funciona igual que "Atrasados" — un interruptor combinable
// (`modificadosGlobal`, ver state.soloModificados) que se puede activar
// junto con "Recibidos" o "En Progreso", no una cuarta categoría mutuamente
// excluyente — de ahí que ninguno de los dos tenga `filtro` propio.
export const DASHBOARD_CONTADORES = [
  { key: 'total', label: 'Total de vales' },
  { key: 'recibidos', label: 'Recibidos', filtro: 'recibidos', pctKey: 'porcentajeRecibidos' },
  { key: 'enProgreso', label: 'En progreso', filtro: 'enProgreso', pctKey: 'porcentajeEnProgreso' },
  { key: 'modificados', label: 'Modificados', modificadosGlobal: true, pctKey: 'porcentajeModificados' },
  { key: 'atrasados', label: 'Atrasados', alerta: true, atrasadosGlobal: true, pctKey: 'porcentajeAtrasados' }
];
