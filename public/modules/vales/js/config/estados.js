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
  CONFIRMADO: 'Confirmado'
};

// Subconjuntos usados solo para poblar las opciones del desplegable "Todos los
// estados" del buzón — reflejan exactamente qué rama de `estadoActivo()`
// aplica a cada rol, para no ofrecer una opción que nunca puede matchear nada.
export const CLAVES_ESTADOS_TALLER = ['PENDIENTE_ASIGNACION', 'ASIGNADO', 'EN_PROCESO', 'EN_PAUSA', 'EN_REVISION', 'APROBADO'];
export const CLAVES_ESTADOS_GENERAL = ['ESPERANDO_AUTORIZACION', 'CREADO', 'APROBADO_DEPARTAMENTO', 'PENDIENTE_CONFIRMACION', 'RECIBIDO', 'SOLICITANDO_MODIFICACION', 'MODIFICADO', 'CONFIRMADO'];
// El técnico nunca ve PENDIENTE_ASIGNACION (un vale sin asignar no está en su
// buzón) ni APROBADO en el Buzón (se muda a Trabajo realizado) — se separan
// por vista en poblarFiltroEstado.
export const CLAVES_ESTADOS_TECNICO_BUZON = ['ASIGNADO', 'EN_PROCESO', 'EN_PAUSA', 'EN_REVISION'];
export const CLAVES_ESTADOS_TECNICO_TRABAJO = ['APROBADO'];
