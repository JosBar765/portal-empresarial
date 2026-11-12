// Constantes puras del módulo; los nombres de permisos, fases y acciones coinciden con src/modules/viaticos/constantes.js.
export const PERMISOS = Object.freeze({
  VER: 'viaticos.ver',
  GESTIONAR: 'viaticos.gestionar',
  AUTORIZAR: 'viaticos.autorizar',
  LIQUIDAR: 'viaticos.liquidar',
  CONFIGURAR: 'viaticos.configurar'
});

export const TABS = Object.freeze({
  SOLICITUDES: 'solicitudes',
  GESTIONES: 'gestiones',
  CONFIGURACION: 'configuracion'
});

export const PERMISO_POR_TAB = Object.freeze({
  [TABS.SOLICITUDES]: PERMISOS.VER,
  [TABS.GESTIONES]: PERMISOS.GESTIONAR,
  [TABS.CONFIGURACION]: PERMISOS.CONFIGURAR
});

export const CLAVES_LOCALES = Object.freeze({
  TAB_ACTIVA: 'viaticos:tabActiva',
  SIDEBAR_COLAPSADO: 'viaticos:sidebarColapsado'
});

export const MODALIDADES = Object.freeze({
  HASTA_UN_DIA: 'hasta_un_dia',
  MAS_DE_UN_DIA: 'mas_de_un_dia'
});

export const FASES = Object.freeze({
  ESPERANDO: 'esperando',
  VENCIDA: 'vencida',
  RECHAZADA: 'rechazada',
  AUTORIZADA: 'autorizada',
  EN_CURSO: 'en_curso',
  TERMINADA: 'terminada',
  LIQUIDADA: 'liquidada'
});

// Nombres completos, iguales a los de pipelineService (`pipeline.estado.*`); nunca siglas.
export const ETIQUETA_FASE = Object.freeze({
  [FASES.ESPERANDO]: 'Esperando autorización',
  [FASES.VENCIDA]: 'Vencida',
  [FASES.RECHAZADA]: 'Rechazada',
  [FASES.AUTORIZADA]: 'Autorizado',
  [FASES.EN_CURSO]: 'En curso',
  [FASES.TERMINADA]: 'Terminado',
  [FASES.LIQUIDADA]: 'Liquidado'
});

export const ESTADOS_PASO = Object.freeze({
  PENDIENTE: 'pendiente',
  ACTUAL: 'actual',
  COMPLETADO: 'completado',
  RECHAZADO: 'rechazado'
});

// Claves de `pipeline.acciones`: las de Solicitudes y las de Gestiones.
export const ACCIONES = Object.freeze({
  VER: 'ver',
  MODIFICAR: 'modificar',
  DAR_DE_BAJA: 'darDeBaja',
  AUTORIZAR: 'autorizar',
  RECHAZAR: 'rechazar',
  LIQUIDAR: 'liquidar'
});

export const ETIQUETA_ACCION = Object.freeze({
  [ACCIONES.VER]: 'Ver',
  [ACCIONES.MODIFICAR]: 'Modificar',
  [ACCIONES.DAR_DE_BAJA]: 'Dar de baja',
  [ACCIONES.AUTORIZAR]: 'Autorizar',
  [ACCIONES.RECHAZAR]: 'Rechazar',
  [ACCIONES.LIQUIDAR]: 'Liquidar'
});

// Recursos del segmento de la URL de /config.
export const RECURSOS = Object.freeze({
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

export const TIEMPO_REAL = Object.freeze({
  SALA_GESTION: 'viaticos:gestion',
  EVENTO_ACTUALIZADA: 'viaticos_actualizada',
  ESPERA_RECARGA_MS: 400,
  // Una acción propia suprime su aviso durante esta ventana; el servidor emite el evento justo tras el commit.
  VENTANA_ACCION_PROPIA_MS: 8000
});

// Acciones que merecen aviso según la pestaña abierta: Gestiones ve todo lo que entra; Solicitudes, las decisiones sobre lo suyo.
export const ACCIONES_AVISABLES = Object.freeze({
  [TABS.GESTIONES]: Object.freeze(['creada', 'modificada', 'dada_de_baja', 'autorizada', 'rechazada', 'liquidada']),
  [TABS.SOLICITUDES]: Object.freeze(['autorizada', 'rechazada'])
});
