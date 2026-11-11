// src/modules/viaticos/mensajes.js
// Catálogo de mensajes explicativos: qué falló, la regla con sus números y cómo corregirlo.
// Sin dependencias: lo cargan también los servicios puros.
const MARCADOR_RE = /\{([A-Za-z_]+)\}/g;

const CATALOGO = Object.freeze({
  // ---- Validación general ----
  'validacion.revisar': 'Hay datos que no son válidos. Corrige los campos marcados e inténtalo de nuevo.',
  'validacion.cuerpo': 'Envía los datos como un objeto JSON en el cuerpo de la petición.',
  'campo.obligatorio': '«{etiqueta}» es obligatorio. Complétalo para continuar.',
  'campo.texto': '«{etiqueta}» debe ser un texto. Escríbelo como texto.',
  'campo.textoLargo': '«{etiqueta}» debe tener entre 1 y {max} caracteres (tiene {largo}). Acórtalo.',
  'campo.formato': '«{etiqueta}» no tiene el formato esperado: {regla} (recibido: {valor}). Corrígelo.',
  'campo.entero': '«{etiqueta}» debe ser un número entero entre {min} y {max} (recibido: {valor}). Escribe un entero dentro del rango.',
  'campo.decimalFormato': '«{etiqueta}» debe ser un número con hasta 2 decimales, escrito con punto (recibido: {valor}). Corrígelo.',
  'campo.decimalRango': '«{etiqueta}» debe ser {condicion} (recibido: {valor}). Escribe un número dentro de ese rango.',
  'campo.fecha': '«{etiqueta}» debe ser una fecha válida con formato AAAA-MM-DD, por ejemplo 2026-03-31 (recibido: {valor}). Corrígela.',
  'campo.booleano': '«{etiqueta}» debe ser verdadero o falso (true o false). Corrige ese valor.',
  'campo.id': '«{etiqueta}» no es un identificador válido (recibido: {valor}). Elige una opción de la lista.',

  // ---- Catálogos simples ----
  'catalogo.noExiste': 'No existe {articulo} con el identificador {id}. Recarga la lista e inténtalo de nuevo.',
  'catalogo.duplicado': 'Ya existe {articulo} con {detalle}. Usa otro valor o edita la que ya existe.',
  'pais.noExiste': 'El país elegido no existe. Elige uno de la lista de países.',

  // ---- Tramos ----
  'tramo.noExiste': 'No existe el tramo con el identificador {id}. Recarga la lista e inténtalo de nuevo.',
  'tramo.ubicacionNoExiste': 'La ubicación elegida como {rol} no existe. Elige una de la lista de ubicaciones.',
  'tramo.mismoLugar': 'El origen y el destino de un tramo deben ser distintos (elegiste «{nombre}» en ambos). Elige otra ubicación como destino.',
  'tramo.duplicado': 'Ya existe el tramo entre «{origen}» y «{destino}»: un tramo sirve en ambos sentidos. Edita el existente en lugar de crear otro.',

  // ---- Valores de comida ----
  'comida.lista': 'Envía «valores» como una lista de objetos con monedaId, tipoComidaId y valor. Corrige el formato y vuelve a guardar.',
  'comida.monedaNoExiste': 'La moneda {id} no existe. Recarga la matriz e inténtalo de nuevo.',
  'comida.tipoNoExiste': 'El tipo de comida {id} no existe. Recarga la matriz e inténtalo de nuevo.',
  'comida.repetido': 'La combinación de moneda {monedaId} y tipo de comida {tipoComidaId} aparece más de una vez. Deja una sola por celda.',

  // ---- Reglas de licencia ----
  'regla.noExiste': 'No existe esa regla de licencia. Recarga la lista e inténtalo de nuevo.',
  'regla.duplicada': 'Ya existe una regla para ese país, tipo de licencia y tipo de placa. Edita sus límites en lugar de crear otra.',
  'regla.tipoLicenciaNoExiste': 'El tipo de licencia elegido no existe. Elige uno de la lista.',
  'regla.tipoPlacaNoExiste': 'El tipo de placa elegido no existe. Elige uno de la lista.',
  'regla.placaOtroPais': 'El tipo de placa elegido pertenece a otro país. Elige un tipo de placa del país de la regla.',

  // ---- Vehículos ----
  'vehiculo.noExiste': 'No existe el vehículo con el identificador {id}. Recarga la lista e inténtalo de nuevo.',
  'vehiculo.duplicado': 'Ya existe un vehículo con la placa «{placa}» en ese país. Revisa la placa o edita el vehículo existente.',
  'vehiculo.placaOtroPais': 'El tipo de placa elegido pertenece a otro país distinto al del vehículo. Elige un tipo de placa del mismo país.',
  'vehiculo.tipoPlacaNoExiste': 'El tipo de placa elegido no existe. Elige uno de la lista.',
  'vehiculo.combustibleNoExiste': 'El combustible elegido no existe. Elige uno de la lista.',
  'vehiculo.propietarioNoExiste': 'El propietario elegido no existe. Elige un usuario de la lista o deja vacío si el vehículo es de la empresa.',
  'vehiculo.polizaIncompleta': 'La póliza necesita número y fecha de vencimiento a la vez. Completa los dos o deja ambos vacíos si el vehículo no tiene póliza.',

  // ---- Personas ----
  'persona.noExiste': 'No existe un usuario activo con el identificador {id}. Recarga la lista e inténtalo de nuevo.',
  'persona.licenciaIncompleta': 'La licencia necesita tipo, número y fecha de vencimiento a la vez. Completa los tres o déjalos vacíos para quitarla.',
  'persona.licenciaObjeto': '«Licencia» debe ser un objeto con tipoLicenciaId, numero y venceEl, o null para quitarla. Corrige el formato.',
  'persona.paisesLista': '«Países» debe ser una lista de identificadores de país, aunque quede vacía. Corrige el formato.',
  'persona.tipoLicenciaNoExiste': 'El tipo de licencia elegido no existe. Elige uno de la lista.',
  'persona.paisNoExiste': 'Uno de los países elegidos no existe. Recarga la lista de países e inténtalo de nuevo.',

  // ---- Ajustes ----
  'ajuste.noExiste': 'No existe el ajuste «{clave}». Elige uno de los ajustes disponibles: {disponibles}.',
  'ajuste.sinValor': 'Envía el nuevo valor del ajuste «{clave}» en el campo «valor».',
  'ajuste.faltante': 'Falta el ajuste «{clave}» en la tabla viaticos_ajustes. Aplica la migración «viaticos_semilla» (en desarrollo: npm run migrate; en staging y producción se aplica al iniciar el servidor).',
  'ajuste.lista': '«{clave}» debe ser una lista con al menos un tipo de archivo, sin repetidos, elegidos entre: {permitidos}. Corrígela.',
  'ajuste.entero': '«{clave}» debe ser un número entero entre {min} y {max} (recibido: {valor}). Escribe un entero dentro del rango.'
});

// Una sola pasada: un valor que contenga «{x}» no se vuelve a interpretar. Un marcador sin valor es un error del programa.
function rellenar(texto, params = {}) {
  return String(texto).replace(MARCADOR_RE, (_, nombre) => {
    if (!Object.prototype.hasOwnProperty.call(params, nombre)) throw new Error(`Falta el valor del marcador {${nombre}}.`);
    return String(params[nombre]);
  });
}

function msg(clave, params = {}) {
  if (!Object.prototype.hasOwnProperty.call(CATALOGO, clave)) throw new Error(`El mensaje «${clave}» no existe en mensajes.js.`);
  try {
    return rellenar(CATALOGO[clave], params);
  } catch (error) {
    throw new Error(`Mensaje «${clave}»: ${error.message}`);
  }
}

module.exports = { msg, rellenar, CATALOGO };
