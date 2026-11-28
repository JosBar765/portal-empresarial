// src/modules/tiempos/calculo/tablaDesdeDatos.js
// Arma la `tabla` que usa el motor a partir de `datos/tablaV5.js` (la misma forma que arma el repositorio desde la base).
// Sirve para la carga inicial y para probar el motor sin base de datos.
const { aClave } = require('./validacion');

// Clave estable de una categoría: línea + nombre («produccion-piezas-fundidas»), así «3D» de dos líneas no choca.
const claveCategoria = (linea, nombre) => `${linea}-${aClave(nombre)}`;

// Categorías en el orden en que aparecen en la tabla impresa: [{ clave, linea, nombre }].
function categoriasDesdeDatos(datos) {
  const lista = [];
  for (const p of datos.PRODUCTOS) {
    if (!p.grupo) continue;
    const clave = claveCategoria(p.linea, p.grupo);
    if (!lista.some(c => c.clave === clave)) lista.push({ clave, linea: p.linea, nombre: p.grupo });
  }
  return lista;
}

// Un extra de los datos en la forma de la tabla. Las categorías de los datos vienen por nombre: se pasan a clave.
function extraDesdeDatos(e, categorias) {
  const alcance = e.alcance
    ? { todos: false, lineas: e.alcance.lineas || [], productos: e.alcance.productos || [],
      categorias: (e.alcance.categorias || []).flatMap(n => categorias.filter(c => c.nombre === n).map(c => c.clave)) }
    : { todos: true, lineas: [], categorias: [], productos: [] };
  return {
    clave: e.clave, tipo: e.tipo, nombre: e.nombre, etiqueta: e.etiqueta, ayuda: e.ayuda || null, aviso: e.aviso || null, activo: true,
    diasFijos: e.tipo === 'si_no' ? e.diasFijos : null,
    unidades: e.tipo === 'por_unidades' ? { ...e.unidades } : null,
    opciones: e.tipo === 'por_cantidad' ? e.opciones.map(o => ({ clave: o.clave, nombre: o.nombre, aviso: o.aviso || null,
      rangos: o.rangos.map(([desde, hasta, dias]) => ({ desde, hasta, aConvenir: hasta === null, dias: hasta === null ? null : dias })) })) : [],
    alcance
  };
}

function tablaDesdeDatos(datos) {
  const categorias = categoriasDesdeDatos(datos);
  const etapas = Object.fromEntries(datos.ETAPAS.map(([clave, nombre]) => [clave, { clave, nombre }]));
  const productos = {};
  for (const p of datos.PRODUCTOS) {
    productos[p.clave] = {
      clave: p.clave, nombre: p.nombre, linea: p.linea, categoria: p.grupo ? claveCategoria(p.linea, p.grupo) : null, grupo: p.grupo, activo: true,
      etapas: p.etapas, avisos: p.aviso ? [p.aviso] : [],
      rangos: p.rangos.map(([desde, hasta, dias]) => ({ desde, hasta, aConvenir: hasta === null, dias: hasta === null ? {} : Object.fromEntries(p.etapas.map((e, i) => [e, dias[i]])) }))
    };
  }
  return {
    version: { numero: datos.VERSION.numero, fecha: datos.VERSION.fecha },
    lineas: datos.LINEAS.map(([clave, nombre]) => ({ clave, nombre, activo: true })),
    categoriasLista: categorias.map(c => ({ ...c, activo: true })),
    etapasLista: datos.ETAPAS.map(([clave, nombre]) => ({ clave, nombre, activo: true })),
    etapas, productos,
    extras: datos.EXTRAS.map(e => extraDesdeDatos(e, categorias)),
    parametros: Object.fromEntries(datos.PARAMETROS.map(([clave, valor, texto]) => [clave, texto !== null ? texto : valor])),
    avisosGenerales: datos.AVISOS_GENERALES
  };
}

module.exports = { tablaDesdeDatos, categoriasDesdeDatos, extraDesdeDatos, claveCategoria };
