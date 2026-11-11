// src/modules/viaticos/constantes.js
// Valores fijos del módulo que no deben vivir en la base de datos.

const PERMISOS = Object.freeze({
  VER: 'viaticos.ver',
  GESTIONAR: 'viaticos.gestionar',
  AUTORIZAR: 'viaticos.autorizar',
  LIQUIDAR: 'viaticos.liquidar',
  CONFIGURAR: 'viaticos.configurar'
});

const PREFIJO_PERMISOS = 'viaticos.';

// Deben coincidir con viaticos_estados (los carga la migración de semilla).
const ESTADOS = Object.freeze({
  ESPERANDO_AUTORIZACION: 'esperando autorización',
  RECHAZADA: 'rechazada',
  AUTORIZADA: 'autorizada',
  LIQUIDADA: 'liquidada'
});

const MODALIDADES = Object.freeze({
  HASTA_UN_DIA: 'hasta_un_dia',
  MAS_DE_UN_DIA: 'mas_de_un_dia'
});

// Recursos de /config (el segmento de la URL).
const RECURSOS = Object.freeze({
  PAISES: 'paises',
  MONEDAS: 'monedas',
  VALORES_COMIDA: 'valores-comida',
  UBICACIONES: 'ubicaciones',
  TRAMOS: 'tramos',
  MOTIVOS: 'motivos',
  TIPOS_GASTO: 'tipos-gasto',
  TIPOS_DEFECTO: 'tipos-defecto',
  TIPOS_LICENCIA: 'tipos-licencia',
  TIPOS_PLACA: 'tipos-placa',
  REGLAS_LICENCIA: 'reglas-licencia',
  VEHICULOS: 'vehiculos',
  PERSONAS: 'personas',
  AJUSTES: 'ajustes'
});

// Ajustes editables de viaticos_ajustes y la forma de su valor.
const MIME_PERMITIDOS = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const AJUSTES = Object.freeze({
  tipos_archivo_permitidos: Object.freeze({ tipo: 'lista', permitidos: MIME_PERMITIDOS, etiqueta: 'Tipos de archivo permitidos' }),
  max_archivo_mb: Object.freeze({ tipo: 'entero', min: 1, max: 25, etiqueta: 'Tamaño máximo por archivo (MB)' })
});

// Topes de las columnas DECIMAL de la base.
const LIMITES = Object.freeze({
  KM_MAX: 99999999.99,
  HORAS_MAX: 999.99,
  VALOR_MAX: 99999999.99,
  TONELAJE_MAX: 99999999.99,
  ENTERO_MAX: 2147483647,
  ANIO_MIN: 1950
});

// Estructura de una solicitud: largos de texto y topes de las listas del payload.
const LIMITES_SOLICITUD = Object.freeze({
  HOTEL: 50,
  LUGAR: 50,
  DESCRIPCION: 100,
  MAX_TRAMOS: 60,
  MAX_HOSPEDAJES: 30,
  MAX_COMIDAS: 400,
  MAX_GASTOS: 60,
  MAX_DEFECTOS: 20,
  MAX_NOCHES: 365,
  MAX_RENGLONES_INSPECCION: 50
});

// Nombre del nivel «no aplica» de viaticos_niveles (solo lo admiten los fluidos con permite_no_aplica).
const NIVEL_NO_APLICA = 'N/A';

// Nombres de viaticos_salvedades (los carga la semilla).
const SALVEDADES = Object.freeze({
  LICENCIA: 'licencia',
  TARJETA_CIRCULACION: 'tarjeta de circulación',
  SEGURO: 'seguro'
});

// Fases derivadas del estado guardado y las fechas; el orden de la lista de solicitudes sigue ORDEN_FASES.
const FASES = Object.freeze({
  ESPERANDO: 'esperando',
  VENCIDA: 'vencida',
  RECHAZADA: 'rechazada',
  AUTORIZADA: 'autorizada',
  EN_CURSO: 'en_curso',
  TERMINADA: 'terminada',
  LIQUIDADA: 'liquidada'
});
const ORDEN_FASES = Object.freeze({
  [FASES.VENCIDA]: 0,
  [FASES.RECHAZADA]: 0,
  [FASES.ESPERANDO]: 0,
  [FASES.AUTORIZADA]: 1,
  [FASES.EN_CURSO]: 2,
  [FASES.TERMINADA]: 3,
  [FASES.LIQUIDADA]: 4
});

const PASOS = Object.freeze({
  AUTORIZACION: 'autorizacion',
  AUTORIZADO: 'autorizado',
  VIAJE: 'viaje',
  LIQUIDADO: 'liquidado'
});
const ESTADOS_PASO = Object.freeze({
  PENDIENTE: 'pendiente',
  ACTUAL: 'actual',
  COMPLETADO: 'completado',
  RECHAZADO: 'rechazado'
});

const ACCIONES = Object.freeze({
  VER: 'ver',
  MODIFICAR: 'modificar',
  DAR_DE_BAJA: 'darDeBaja',
  LIQUIDAR: 'liquidar'
});

// Abreviaturas fijas para no depender del idioma del servidor.
const MESES_ABREVIADOS = Object.freeze(['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']);

module.exports = {
  PERMISOS, PREFIJO_PERMISOS, ESTADOS, MODALIDADES, RECURSOS, AJUSTES, MIME_PERMITIDOS, LIMITES,
  LIMITES_SOLICITUD, NIVEL_NO_APLICA, SALVEDADES, FASES, ORDEN_FASES, PASOS, ESTADOS_PASO, ACCIONES, MESES_ABREVIADOS
};
