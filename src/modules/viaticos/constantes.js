// src/modules/viaticos/constantes.js
// Valores fijos del módulo que no deben vivir en la base de datos.

const PERMISOS = Object.freeze({
  VER: 'viaticos.ver',
  GESTIONAR: 'viaticos.gestionar',
  AUTORIZAR: 'viaticos.autorizar',
  LIQUIDAR: 'viaticos.liquidar',
  CONFIGURAR: 'viaticos.configurar',
  VER_HISTORIAL: 'viaticos.ver_historial',
  REPORTES: 'viaticos.reportes'
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
  COMBUSTIBLES: 'combustibles',
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
  max_archivo_mb: Object.freeze({ tipo: 'entero', min: 1, max: 25, etiqueta: 'Tamaño máximo por archivo (MB)' }),
  borrador_vigencia_dias: Object.freeze({ tipo: 'entero', min: 1, max: 365, etiqueta: 'Vigencia de un borrador (días)' }),
  borrador_max_por_usuario: Object.freeze({ tipo: 'entero', min: 1, max: 200, etiqueta: 'Máximo de borradores por usuario' }),
  rechazo_vigencia_horas: Object.freeze({ tipo: 'entero', min: 1, max: 168, etiqueta: 'Horas que una rechazada espera antes de pasar a borrador' })
});

// Solicitud rechazada: su plazo son horas corridas del ajuste; se avisa cuando ya pasó esta fracción (queda el 25 %).
const RECHAZO = Object.freeze({ AJUSTE_VIGENCIA_HORAS: 'rechazo_vigencia_horas', FRACCION_AVISO: 0.75 });

// Borradores: claves de sus ajustes, tope del JSON guardado (cabe holgado en el límite de 200 kb del body) y claves de `datos` que no son contenido del usuario.
const BORRADORES = Object.freeze({
  AJUSTE_VIGENCIA_DIAS: 'borrador_vigencia_dias',
  AJUSTE_MAX_POR_USUARIO: 'borrador_max_por_usuario',
  MAX_BYTES_DATOS: 64 * 1024,
  CLAVES_NO_CONTENIDO: Object.freeze(['modalidad', 'comidasAutoMarcar', 'comidasDesmarcadas'])
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
  MAX_RENGLONES_INSPECCION: 50,
  MOTIVO_RECHAZO: 300
});

// Archivos: el tope duro de multer es el máximo configurable; el tipo y tamaño efectivos salen de viaticos_ajustes.
const ARCHIVOS = Object.freeze({
  CAMPO_DEFECTOS: 'defectos',
  CAMPO_ARCHIVO: 'archivo',
  MAX_MB_DURO: AJUSTES.max_archivo_mb.max,
  MAX_DEFECTOS: LIMITES_SOLICITUD.MAX_DEFECTOS,
  AJUSTE_TIPOS: 'tipos_archivo_permitidos',
  AJUSTE_MAX_MB: 'max_archivo_mb',
  TIPO_NOMBRE_DEFECTO: 'DEFECTO',
  // Storage no sobrescribe: ante un nombre ya usado se prueba el contador siguiente hasta este tope de intentos.
  INTENTOS_NOMBRE: 5,
  PATRON_NOMBRE_DUPLICADO: /already exists|ya existe|HTTP 409/i
});

// Filas de viaticos_tipos_gasto que la liquidación identifica por nombre (la semilla las crea con seleccionable_en_gastos = 0).
const RUBROS_FIJOS = Object.freeze({ HOSPEDAJE: 'Hospedaje', COMBUSTIBLE: 'Combustible' });

// Etapa que se escribe en el nombre del archivo en Storage (como en Vales: creación, corrección previa a la autorización, autorización).
const ETAPAS_DOCUMENTO = Object.freeze({ CREACION: 'CREACION', CORRECCION: 'CORRECCION', AUTORIZACION: 'AUTORIZACION' });

const SENTIDOS_TRAMO = Object.freeze({ IDA: 'ida', VUELTA: 'vuelta' });

// La llave de idempotencia llega del cliente; se acota para caber en idempotency_keys junto al prefijo del usuario.
const IDEMPOTENCIA = Object.freeze({ ENDPOINT_CREAR: 'viaticos:crear', ENDPOINT_COMPROBANTE: 'viaticos:comprobante', ENDPOINT_RECIBO: 'viaticos:recibo', MAX_LLAVE: 64 });

// Recibos firmados de la liquidación: rubros y formas de pago (coinciden con los ENUM de viaticos_recibos), largos de sus textos y la firma (PNG).
const RECIBOS = Object.freeze({
  RUBROS: Object.freeze({ ALIMENTACION: 'alimentacion', DEPRECIACION: 'depreciacion', OTRO: 'otro' }),
  FORMAS_PAGO: Object.freeze({ EFECTIVO: 'efectivo', CHEQUE: 'cheque', TRANSFERENCIA: 'transferencia' }),
  RECIBI_DE: 100,
  CONCEPTO: 100,
  NUMERO_CHEQUE: 30,
  NUMERO_CUENTA: 40,
  CAMPO_DATOS: 'datos',
  CAMPO_FIRMA: 'firma',
  MIME_FIRMA: 'image/png',
  MAX_FIRMA_MB: 2,
  PREFIJO_NUMERO: 'R',
  MIME_PDF: 'application/pdf'
});

// Nombres completos de los meses para los conceptos sugeridos del recibo.
const MESES_COMPLETOS = Object.freeze(['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']);

const NOTIFICACION = Object.freeze({
  MODULO: 'viaticos',
  NIVEL: 'info',
  TIPO_NUEVA: 'solicitud_nueva',
  TIPO_MODIFICADA: 'solicitud_modificada',
  TIPO_AUTORIZADA: 'solicitud_autorizada',
  TIPO_RECHAZADA: 'solicitud_rechazada',
  TIPO_LIQUIDADA: 'solicitud_liquidada',
  TIPO_POR_VENCER: 'solicitud_por_vencer',
  TIPO_VENCIDA: 'solicitud_vencida',
  NIVEL_RECHAZO: 'alerta'
});

// Sala de quienes gestionan y evento que avisa que una solicitud cambió (el cliente refresca su lista).
const TIEMPO_REAL = Object.freeze({
  SALA_GESTION: 'viaticos:gestion',
  EVENTO_ACTUALIZADA: 'viaticos_actualizada',
  ACCION_CREADA: 'creada',
  ACCION_MODIFICADA: 'modificada',
  ACCION_DADA_DE_BAJA: 'dada_de_baja',
  ACCION_AUTORIZADA: 'autorizada',
  ACCION_RECHAZADA: 'rechazada',
  ACCION_LIQUIDADA: 'liquidada',
  ACCION_VENCIDA: 'vencida',
  EVENTO_BORRADORES_NUEVOS: 'viaticos_borradores_nuevos'
});

const ROL_ADMINISTRADOR_ID = 1;

// Correlativo: VIA-<código país>-<número sin ceros a la izquierda>; arranca en 1 por país.
const CORRELATIVO = Object.freeze({ PREFIJO: 'VIA' });

// Estados guardados en los que la solicitud todavía se modifica o se da de baja (coinciden con las acciones del pipeline).
const ESTADOS_EDITABLES = Object.freeze([ESTADOS.ESPERANDO_AUTORIZACION, ESTADOS.RECHAZADA]);

// Nombre del nivel «no aplica» de viaticos_niveles (solo lo admiten los fluidos con permite_no_aplica).
const NIVEL_NO_APLICA = 'N/A';

// Niveles de fluido que el PDF resalta en color (nombres de viaticos_niveles).
const NIVELES_RESALTADOS = Object.freeze({ '1/4': 'amarillo', E: 'rojo' });

// Tipos de imagen que el PDF puede incrustar.
const MIME_IMAGEN_PDF = Object.freeze({ PNG: 'image/png', JPEG: 'image/jpeg' });

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
  AUTORIZAR: 'autorizar',
  RECHAZAR: 'rechazar',
  LIQUIDAR: 'liquidar',
  HISTORIAL: 'historial'
});

// Claves de viaticos_movimientos.tipo (el historial permanente de cada solicitud); se consultan directo en la base.
const MOVIMIENTOS = Object.freeze({
  CREADA: 'creada',
  MODIFICADA: 'modificada',
  REVISADA: 'revisada',
  AUTORIZADA: 'autorizada',
  RECHAZADA: 'rechazada',
  RECIBO_CREADO: 'recibo_creado',
  RECIBO_QUITADO: 'recibo_quitado',
  COMPROBANTE_AGREGADO: 'comprobante_agregado',
  COMPROBANTE_QUITADO: 'comprobante_quitado',
  LIQUIDADA: 'liquidada',
  VENCIDA: 'vencida',
  DADA_DE_BAJA: 'dada_de_baja'
});

// Actor de un movimiento hecho por el servidor (el vencimiento): sin usuario; su nombre sale de mensajes.js.
const SISTEMA = Object.freeze({ USUARIO_ID: null, MENSAJE_NOMBRE: 'movimiento.actorSistema' });

// Reportes: categorías del reparto (clave estable; su nombre sale de mensajes.js), en el orden en que se muestran.
const REPORTES = Object.freeze({
  CATEGORIAS: Object.freeze({ HOSPEDAJE: 'hospedaje', COMBUSTIBLE: 'combustible', ALIMENTACION: 'alimentacion', DEPRECIACION: 'depreciacion', OTROS: 'otros' }),
  ORDEN_CATEGORIAS: Object.freeze(['hospedaje', 'combustible', 'alimentacion', 'depreciacion', 'otros']),
  // Los porcentajes se guardan en décimas (1 decimal) y suman 1000 = 100.0 %.
  DECIMAS_TOTAL: 1000,
  PDF_MAX_BARRAS: 10,
  PDF_NOMBRE_ARCHIVO: 'reporte-viaticos'
});

// Abreviaturas fijas para no depender del idioma del servidor.
const MESES_ABREVIADOS = Object.freeze(['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']);

module.exports = {
  PERMISOS, PREFIJO_PERMISOS, ESTADOS, MODALIDADES, RECURSOS, AJUSTES, RECHAZO, BORRADORES, MIME_PERMITIDOS, LIMITES,
  LIMITES_SOLICITUD, ARCHIVOS, RUBROS_FIJOS, ETAPAS_DOCUMENTO, SENTIDOS_TRAMO, IDEMPOTENCIA, RECIBOS, MESES_COMPLETOS, NOTIFICACION, TIEMPO_REAL, ROL_ADMINISTRADOR_ID, CORRELATIVO, ESTADOS_EDITABLES, NIVEL_NO_APLICA, NIVELES_RESALTADOS, MIME_IMAGEN_PDF, SALVEDADES, FASES, ORDEN_FASES, PASOS, ESTADOS_PASO, ACCIONES, MESES_ABREVIADOS, MOVIMIENTOS, SISTEMA, REPORTES
};
