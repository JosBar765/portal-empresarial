// src/modules/incidencias/constantes.js
// Vocabulario fijo del módulo. Lo que el administrador puede cambiar (categorías, zonas, prioridades, técnicos…) vive en la base;
// aquí solo está lo que el código necesita para decidir (estados, impactos, tipos de evento y permisos).

const ESTADOS = Object.freeze({
  EN_BUZON: 'en_buzon',
  EN_PROCESO: 'en_proceso',
  EN_ESPERA: 'en_espera',
  EN_VERIFICACION: 'en_verificacion',
  CORRECCION_PEDIDA: 'correccion_pedida',
  CERRADA: 'cerrada',
  DESCARTADA: 'descartada'
});

// Estados en palabras completas, tal como se muestran.
const ETIQUETA_ESTADO = Object.freeze({
  en_buzon: 'En buzón',
  en_proceso: 'En proceso',
  en_espera: 'En espera',
  en_verificacion: 'En verificación',
  correccion_pedida: 'Corrección pedida',
  cerrada: 'Cerrada',
  descartada: 'Descartada'
});

const ABIERTOS = [ESTADOS.EN_BUZON, ESTADOS.EN_PROCESO, ESTADOS.EN_ESPERA, ESTADOS.EN_VERIFICACION, ESTADOS.CORRECCION_PEDIDA];
// El técnico responsable puede trabajar la incidencia en estos dos estados.
const EN_TRABAJO = [ESTADOS.EN_PROCESO, ESTADOS.CORRECCION_PEDIDA];
const TERMINADOS = [ESTADOS.CERRADA, ESTADOS.DESCARTADA];

const IMPACTOS = ['riesgo_personas', 'detiene_operacion', 'trabajo_con_limitaciones', 'molestia_menor'];
// Los cuatro impactos tal como se muestran al reportar (los impactos son fijos; lo que se elige en Configuración es su prioridad).
const IMPACTO_TEXTOS = Object.freeze({
  riesgo_personas: { nombre: 'Riesgo para las personas', ayuda: 'Chispas, cable expuesto, fuga' },
  detiene_operacion: { nombre: 'Detiene la operación', ayuda: 'No se puede trabajar' },
  trabajo_con_limitaciones: { nombre: 'Trabajo con limitaciones', ayuda: 'Hay alternativa pero es lenta' },
  molestia_menor: { nombre: 'Molestia menor', ayuda: 'No afecta el trabajo' }
});
const EVOLUCIONES = ['mejoro', 'sin_cambios', 'empeoro'];

const EVENTO = Object.freeze({
  APERTURA: 'apertura',
  BUZON: 'buzon',
  TOMA: 'toma',
  AVANCE: 'avance',
  ESPERA: 'espera',
  REANUDACION: 'reanudacion',
  A_VERIFICACION: 'a_verificacion',
  CORRECCION_PEDIDA: 'correccion_pedida',
  CIERRE: 'cierre',
  REASIGNACION: 'reasignacion',
  DEVOLUCION_BUZON: 'devolucion_buzon',
  DESCARTE: 'descarte',
  COMENTARIO: 'comentario',
  PRIORIDAD: 'prioridad'
});

const PERMISO = Object.freeze({
  VER: 'incidencias.ver',
  REPORTAR: 'incidencias.reportar',
  RESOLVER: 'incidencias.resolver',
  VERIFICAR: 'incidencias.verificar',
  ASIGNAR: 'incidencias.asignar',
  VER_TODAS: 'incidencias.ver_todas',
  CONFIGURAR: 'incidencias.configurar'
});

const LIMITES = Object.freeze({ titulo: 120, descripcion: 2000, texto: 1000, motivo: 255, comentario: 500, activoTexto: 120 });

module.exports = { ESTADOS, ETIQUETA_ESTADO, ABIERTOS, EN_TRABAJO, TERMINADOS, IMPACTOS, IMPACTO_TEXTOS, EVOLUCIONES, EVENTO, PERMISO, LIMITES };
