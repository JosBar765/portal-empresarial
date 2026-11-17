// src/modules/viaticos/catalogos.js
// Definición declarativa de los catálogos simples de /config. El SQL genérico se arma SOLO desde aquí
// (tabla, columnas y orden), nunca con nombres que vengan del cliente.
const { RECURSOS, RUBROS_FIJOS } = require('./constantes');

const NOMBRE_100 = { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto', max: 100 };
const CODIGO_20 = { columna: 'codigo', etiqueta: 'Código', tipo: 'texto', max: 20 };
const PAIS = { columna: 'pais_id', etiqueta: 'País', tipo: 'pais', soloAlta: true }; // cambiarlo dejaría datos ligados al país anterior
const ES_OTROS = { columna: 'es_otros', etiqueta: 'Es «otros»', tipo: 'booleano', soloAlta: true }; // la lógica del módulo depende de esta marca

function congelar(valor) {
  if (valor && typeof valor === 'object' && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    Object.values(valor).forEach(congelar);
  }
  return valor;
}

// orden: expresión ORDER BY con alias `t` para la tabla. unica: columnas de la clave única (para el mensaje de duplicado).
// protegidos: nombres de filas que el módulo busca por nombre; no se renombran ni se desactivan.
const CATALOGOS = congelar({
  [RECURSOS.MONEDAS]: {
    tabla: 'viaticos_monedas',
    articulo: 'la moneda',
    orden: 't.codigo',
    unica: ['codigo'],
    columnas: [
      { columna: 'codigo', etiqueta: 'Código', tipo: 'texto', max: 3, mayusculas: true, formato: /^[A-Z]{3}$/, reglaFormato: '3 letras, por ejemplo GTQ' },
      { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto', max: 50 },
      { columna: 'simbolo', etiqueta: 'Símbolo', tipo: 'texto', max: 5 }
    ]
  },
  [RECURSOS.UBICACIONES]: {
    tabla: 'viaticos_ubicaciones',
    articulo: 'la ubicación',
    orden: 't.pais_id, t.nombre',
    unica: ['pais_id', 'nombre'],
    columnas: [PAIS, NOMBRE_100]
  },
  [RECURSOS.MOTIVOS]: {
    tabla: 'viaticos_motivos',
    articulo: 'el motivo',
    orden: 't.nombre',
    unica: ['nombre'],
    columnas: [NOMBRE_100]
  },
  [RECURSOS.TIPOS_GASTO]: {
    tabla: 'viaticos_tipos_gasto',
    articulo: 'el tipo de gasto',
    orden: 't.nombre',
    unica: ['nombre'],
    protegidos: Object.values(RUBROS_FIJOS),
    columnas: [
      NOMBRE_100,
      ES_OTROS,
      { columna: 'seleccionable_en_gastos', etiqueta: 'Seleccionable en gastos', tipo: 'booleano', soloAlta: true }
    ]
  },
  [RECURSOS.TIPOS_DEFECTO]: {
    tabla: 'viaticos_tipos_defecto',
    articulo: 'el tipo de defecto',
    orden: 't.nombre',
    unica: ['nombre'],
    columnas: [NOMBRE_100, ES_OTROS]
  },
  [RECURSOS.TIPOS_LICENCIA]: {
    tabla: 'viaticos_tipos_licencia',
    articulo: 'el tipo de licencia',
    orden: 't.codigo',
    unica: ['codigo'],
    columnas: [CODIGO_20, NOMBRE_100]
  },
  [RECURSOS.TIPOS_PLACA]: {
    tabla: 'viaticos_tipos_placa',
    articulo: 'el tipo de placa',
    orden: 't.pais_id, t.codigo',
    unica: ['pais_id', 'codigo'],
    columnas: [PAIS, CODIGO_20, NOMBRE_100]
  }
});

module.exports = { CATALOGOS };
