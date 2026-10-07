// Estados REALES: nivel general del vale (vales.estado) + nivel de taller
// (vale_talleres.estado). No colisionan entre sí, así que comparten un solo
// diccionario de etiquetas.
export const ESTADOS_LABEL = {
  // Generales
  ESPERANDO_AUTORIZACION: 'Esperando Autorización',
  CREADO: 'Creado',
  APROBADO_DEPARTAMENTO: 'Aprobado por Talleres',
  PENDIENTE_CONFIRMACION: 'Pendiente Confirmación',
  RECIBIDO: 'Recibido',
  SOLICITANDO_MODIFICACION: 'Solicitando Modificación',
  MODIFICADO: 'Modificado',
  CONFIRMADO: 'Confirmado',
  RECHAZADO: 'Rechazado',
  // Por taller
  PENDIENTE_ASIGNACION: 'Pendiente Asignación',
  ASIGNADO: 'Asignado',
  EN_PROCESO: 'En Proceso',
  EN_PAUSA: 'En Pausa',
  EN_REVISION: 'En Revisión',
  APROBADO: 'Aprobado'
};

// El asesor no ve el estado real de la máquina de estados, ve una versión
// "lógica" colapsada. Nunca se usa para autorización.
export const ESTADOS_VISIBLES_LABEL = {
  ESPERANDO_AUTORIZACION: 'Esperando Autorización',
  CREADO: 'Creado',
  SOLICITANDO_MODIFICACION: 'Solicitando Modificación',
  MODIFICADO: 'Modificado',
  PENDIENTE_CONFIRMACION: 'Pendiente Confirmación',
  CONFIRMADO: 'Confirmado',
  RECHAZADO: 'Rechazado'
};
