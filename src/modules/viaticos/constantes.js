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

module.exports = { PERMISOS, PREFIJO_PERMISOS, ESTADOS, MODALIDADES, RECURSOS, AJUSTES, MIME_PERMITIDOS, LIMITES };
