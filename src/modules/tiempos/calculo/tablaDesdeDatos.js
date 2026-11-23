// src/modules/tiempos/calculo/tablaDesdeDatos.js
// Arma la `tabla` que usa el motor a partir de `datos/tablaV5.js` (la misma forma que arma el repositorio desde la base).
// Sirve para probar el motor sin base de datos.
function tablaDesdeDatos(datos) {
  const etapas = Object.fromEntries(datos.ETAPAS.map(([clave, nombre]) => [clave, { clave, nombre }]));
  const productos = {};
  for (const p of datos.PRODUCTOS) {
    productos[p.clave] = {
      clave: p.clave, nombre: p.nombre, linea: p.linea, grupo: p.grupo, activo: true, permiteMoldes: Boolean(p.moldes), permiteLanyard: Boolean(p.lanyard),
      etapas: p.etapas, avisos: p.aviso ? [p.aviso] : [],
      rangos: p.rangos.map(([desde, hasta, dias]) => ({ desde, hasta, aConvenir: hasta === null, dias: hasta === null ? {} : Object.fromEntries(p.etapas.map((e, i) => [e, dias[i]])) }))
    };
  }
  const extras = Object.fromEntries(datos.UV.map(u => [u.clave, { clave: u.clave, nombre: u.nombre, aviso: u.aviso || null,
    rangos: u.rangos.map(([desde, hasta, dias]) => ({ desde, hasta, aConvenir: hasta === null, dias: hasta === null ? null : dias })) }]));
  return {
    version: { numero: datos.VERSION.numero, fecha: datos.VERSION.fecha }, etapas, productos, extras,
    parametros: Object.fromEntries(datos.PARAMETROS.map(([clave, valor]) => [clave, valor])), avisosGenerales: datos.AVISOS_GENERALES
  };
}

module.exports = { tablaDesdeDatos };
