// src/modules/viaticos/utilidades.js
// Las columnas de MySQL llegan en snake_case; la API habla camelCase.
const BOOLEANAS = new Set(['activo', 'esOtros', 'seleccionableEnGastos']);
const NUMERICAS = new Set(['km', 'horas', 'valor', 'tonelaje', 'tonelajeMax']); // mysql2 devuelve los DECIMAL como texto

function aCamel(nombre) {
  return nombre.replace(/_([a-z])/g, (_, letra) => letra.toUpperCase());
}

function filaACamel(fila) {
  const salida = {};
  for (const [clave, valor] of Object.entries(fila)) {
    const campo = aCamel(clave);
    if (BOOLEANAS.has(campo)) salida[campo] = Boolean(valor);
    else if (NUMERICAS.has(campo) && valor !== null) salida[campo] = Number(valor);
    else salida[campo] = valor;
  }
  return salida;
}

function filasACamel(filas) {
  return filas.map(filaACamel);
}

// Los JSON pueden llegar ya parseados o como texto, según el motor de MySQL.
function parsearJson(valor) {
  if (typeof valor !== 'string') return valor;
  try {
    return JSON.parse(valor);
  } catch {
    return valor;
  }
}

module.exports = { aCamel, filaACamel, filasACamel, parsearJson };
