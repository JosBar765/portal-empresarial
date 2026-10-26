// src/modules/prompts/mensajes.js
// Catálogo de mensajes explicativos: qué falló, la regla con sus números y cómo corregirlo.
// Sin dependencias: lo cargan también los servicios puros.
const MARCADOR_RE = /\{([A-Za-z_]+)\}/g; // los marcadores del catálogo pueden ir en camelCase

const CATALOGO = Object.freeze({
  // ---- Ajustes ----
  'ajuste.noExiste': 'No existe el ajuste «{clave}». Ajustes disponibles: {disponibles}.',
  'ajuste.sinValor': 'Envía el nuevo valor del ajuste «{clave}» en el campo «valor».',
  'ajuste.faltante': 'Falta el ajuste «{clave}» en la tabla prompt_ajustes. Aplica la migración «prompts_ajustes» (en desarrollo: npm run migrate; en staging y producción se aplica al iniciar el servidor).',
  'ajuste.texto': 'El texto «{clave}» debe tener entre 1 y {max} caracteres.',
  'ajuste.objeto': '«{clave}» debe ser un objeto con estos textos: {claves}.',
  'ajuste.subtextoFalta': 'Falta el texto «{subclave}» dentro de «{clave}». Agrégalo para poder guardar.',
  'ajuste.subtextoDesconocido': '«{clave}» trae «{subclave}», que no existe. Valores válidos: {validas}.',
  'ajuste.subtextoTipo': '«{clave}.{subclave}» debe ser un texto de 1 a {max} caracteres.',
  'ajuste.subtextoTipoVacio': '«{clave}.{subclave}» debe ser un texto (puede quedar vacío).',
  'ajuste.marcadorFalta': 'El texto «{subclave}» debe incluir el marcador {marcador}.',
  'ajuste.marcadorDesconocido': 'El texto «{subclave}» usa el marcador {marcador}, que no existe. Marcadores válidos: {validos}.',
  'ajuste.llaveSuelta': 'El texto «{subclave}» tiene una llave «{» o «}» sin cerrar o mal escrita. Un marcador va con llaves simples y solo minúsculas o guion bajo (marcadores válidos: {validos}).',
  'ajuste.limiteDesconocido': '«limites» trae «{subclave}», que no existe. Límites válidos: {validas}.',
  'ajuste.limiteFalta': 'Falta el límite «{subclave}» dentro de «limites».',
  'ajuste.limiteEntero': 'El límite «{subclave}» debe ser un número entero de 1 en adelante (recibido: {valor}).',
  'ajuste.limiteTope': 'El límite «{defecto}» ({valorDefecto}) no puede superar «{tope}» ({valorTope}).',
  'ajuste.limiteMaximo': 'El límite «{subclave}» ({valor}) no puede superar {maximo}: {motivo}.',
  'ajuste.limiteRango': 'El límite «{subclave}» debe estar entre {min} y {max} (recibido: {valor}).',
  'ajuste.formatosVacio': '«formatos_imagen» debe tener al menos un formato de imagen.',
  'ajuste.formatoClave': 'La clave de formato «{formato}» no es válida: usa de 2 a 10 minúsculas o números.',
  'ajuste.formatoExtensiones': 'El formato «{formato}» necesita una lista «extensiones» con al menos una extensión en minúsculas y sin punto (por ejemplo: jpg).',
  'ajuste.formatoMime': 'El formato «{formato}» necesita un «mime» que empiece por image/ (por ejemplo: image/png); se recibió «{valor}».',

  // ---- Parámetros ----
  'param.maxLargo': '{parametro}: «max_largo» debe ser un entero entre 1 y {tope} (recibido: {valor}).',
  'param.separador': '{parametro}: «separador» debe ser un texto de 1 a {max} caracteres.',
  'param.imagenesMax': '{parametro}: «max» debe ser un entero entre 1 y {tope}.',
  'param.imagenesMb': '{parametro}: «max_mb» debe estar entre 1 y {tope}.',
  'param.formatos': '{parametro}: «formatos» debe ser una lista con valores de: {validos}.',
  'param.lista': '{parametro}: «{campo}» debe ser una lista de hasta {max} textos.',
  'param.listaElemento': '{parametro}: cada elemento de «{campo}» debe tener entre 1 y {max} caracteres.',
  'param.listaRepetido': '{parametro}: «{campo}» tiene el texto «{texto}» repetido. Quita el duplicado.',

  // ---- Recursos fijos ----
  'recurso.lista': '«recursos» debe ser una lista de hasta {max} recursos; este producto tiene {total}. Quita los que no uses o aumenta el límite «recursos_max» en los ajustes.',
  'recurso.invalido': 'El recurso {numero} no es válido: debe tener clave, etiqueta, URL, posición y «activo».',
  'recurso.claveInvalida': 'La clave del recurso {numero} no es válida. Usa minúsculas, números y guion bajo, de 2 a 60 caracteres, empezando con letra.',
  'recurso.claveReservada': 'La clave «{clave}» del recurso «{recurso}» es una variable reservada del sistema. Elige otra clave.',
  'recurso.claveRepetida': 'La clave «{clave}» del recurso «{recurso}» ya la usa un parámetro u otro recurso. Cada clave debe ser única en el producto; cámbiala por otra.',
  'recurso.choqueVariable': 'El parámetro «{variable}» usa el nombre de la variable que genera el recurso «{recurso}». Cambia la clave del parámetro o la del recurso.',
  'recurso.etiqueta': 'El recurso «{recurso}» necesita una etiqueta de 1 a {max} caracteres.',
  'recurso.descripcion': 'La descripción del recurso «{recurso}» debe ser un texto de hasta {max} caracteres; se escribe en la lista de imágenes del prompt.',
  'recurso.posicion': 'La posición del recurso «{recurso}» debe ser «inicio» (antes de las imágenes del asesor) o «fin» (después); se recibió «{valor}».',
  'recurso.activoTipo': 'El campo «activo» del recurso «{recurso}» debe ser verdadero o falso.',
  'recurso.urlTipo': 'La URL del recurso «{recurso}» debe ser un texto (déjala vacía si aún no la tienes y desactiva el recurso).',
  'recurso.activoSinUrl': 'El recurso «{recurso}» está activo pero no tiene URL. Pega la URL pública de la imagen en Supabase o desactívalo.',
  'recurso.activoUrlInvalida': 'El recurso «{recurso}» está activo pero su URL «{url}» no es válida. Usa una dirección que empiece por https:// o por /assets/, o desactiva el recurso.',

  // ---- Plantilla y producto ----
  'plantilla.recursoDesconocido': 'La variable «{variable}» no existe: el producto no tiene un recurso con la clave «{clave}». Recursos disponibles: {disponibles}. Agrega el recurso en la pestaña Recursos o corrige el nombre.',
  'plantilla.larga': 'La plantilla no puede superar {max} caracteres (tiene {largo}). Acórtala.',
  'producto.nombre': 'El nombre del producto es obligatorio y no puede superar {max} caracteres (tiene {largo}).',
  'producto.descripcion': 'La descripción del producto no puede superar {max} caracteres (tiene {largo}).',

  // ---- Valores del asesor ----
  'valor.textoLargo': '{etiqueta} no puede superar {max} caracteres (tiene {largo}). Acórtalo.',
  'valor.imagenesMax': '«{etiqueta}» admite hasta {max} imágenes y enviaste {total}. Quita {sobran}.',
  'valor.imagenNombre': 'Cada nombre de imagen de «{etiqueta}» debe tener entre 1 y {max} caracteres.',
  'valor.imagenFormato': 'La imagen «{nombre}» de «{etiqueta}» tiene un formato no permitido. Usa uno de estos: {permitidas}.',
  'valor.imagenDescripcion': 'La descripción de la imagen «{nombre}» no puede superar {max} caracteres (tiene {largo}). Acórtala.',

  // ---- Lectura de recursos ----
  'recursoLectura.productoNoDisponible': 'El producto no está disponible.',
  'recursoLectura.noExiste': 'El producto no tiene un recurso activo con la clave «{clave}».',
  'recursoLectura.sinAlmacenamiento': 'El almacenamiento (Supabase) no está configurado en el servidor, así que no se puede leer el recurso «{recurso}». Avisa al administrador del sistema.',
  'recursoLectura.urlInvalida': 'La URL del recurso «{recurso}» no es una dirección válida. Corrígela en la pestaña Recursos del producto.',
  'recursoLectura.protocolo': 'La URL del recurso «{recurso}» no usa https. Usa la dirección pública https:// de la imagen en Supabase, en la pestaña Recursos del producto.',
  'recursoLectura.hostNoPermitido': 'La URL del recurso «{recurso}» apunta a {host}, que no es el almacenamiento configurado ({hostPermitido}). Corrige la URL en la pestaña Recursos del producto.',
  'recursoLectura.timeout': 'El almacenamiento tardó más de {segundos} segundos en responder al leer el recurso «{recurso}». Inténtalo de nuevo; si persiste, revisa la URL en la pestaña Recursos.',
  'recursoLectura.sinConexion': 'No se pudo conectar con el almacenamiento para leer el recurso «{recurso}». Revisa la URL en la pestaña Recursos del producto.',
  'recursoLectura.respuestaHttp': 'El almacenamiento respondió {estado} al leer el recurso «{recurso}». Comprueba que la imagen exista y sea pública, y corrige la URL en la pestaña Recursos.',
  'recursoLectura.noImagen': 'El recurso «{recurso}» no es una imagen: el almacenamiento devolvió «{tipo}». Sube una imagen y corrige la URL en la pestaña Recursos.',
  'recursoLectura.grande': 'El recurso «{recurso}» pesa más de {maxMb} MB, el máximo permitido. Sube una versión más liviana y corrige la URL.'
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
